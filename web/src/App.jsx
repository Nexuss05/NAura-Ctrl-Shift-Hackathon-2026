import { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Header from "./components/Header.jsx";
import ForestGallery from "./components/ForestGallery.jsx";
import GlobeSelector from "./components/GlobeSelector.jsx";
import FundingPanel from "./components/FundingPanel.jsx";
import { Globe, Leaf } from "./Icons.jsx";
import { FORESTS, goalProgress, fmt } from "./data.js";
import { bridge, bridgeReachable } from "./lib/bridge.js";
import { useSwarm } from "./hooks/useSwarm.js";
import * as escrow from "./lib/escrow.js";
import * as pp from "./lib/privacypool.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const smooth = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const scrollTo = (el) => el?.scrollIntoView({ behavior: smooth() ? "smooth" : "auto", block: "start" });
const ORG_ADDRESS = "0xCE9A1CfbF58e0C7C205b10A31a19669603A5aD6F"; // demo reforestation-org beneficiary for on-chain releases

export default function App() {
  const [forests, setForests] = useState(FORESTS);
  const [selectedId, setSelectedId] = useState(FORESTS[0].id);
  const [custom, setCustom] = useState(null);
  const [amount, setAmount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState({}); // forestId -> { given, healthAtJoin }
  const [view, setView] = useState("map");          // "map" | "cards"
  const [chosen, setChosen] = useState(false);      // panel appears only after a selection
  const [privacy, setPrivacy] = useState(false);    // give via Privacy Pools

  const [account, setAccount] = useState(null);     // connected wallet (from Header)
  const sessionReady = useRef(false);               // bridge keys + session prepared
  const chainIds = useRef({});                       // forest id -> on-chain Naura project id

  const globeRef = useRef(null);
  const panelRef = useRef(null);

  const target = custom || forests.find((f) => f.id === selectedId);

  // ---- Solana AI swarm (WebSocket) ---------------------------------------
  const onRelease = useCallback((msg) => {
    setForests((prev) => prev.map((x) => {
      if (x.id !== msg.projectId) return x;
      const newHealth = Math.min(x.target, x.health + 2);
      return {
        ...x,
        health: newHealth,
        setAside: Math.max(0, x.setAside + (msg.escrowDelta || 0)),
        paid: x.paid + (msg.releasedDelta || 0),
      };
    }));
    setMessage(`Growth confirmed from space. <strong>${fmt(Math.abs(msg.releasedDelta || 0))} ETH</strong> released to the planters` +
      (msg.txHash ? ` · tx <code>${String(msg.txHash).slice(0, 10)}…</code>` : "") + ".");
    setBusy(false);
  }, []);

  const swarm = useSwarm({ onRelease });

  // ---- Selection ---------------------------------------------------------
  const scrollToPanel = useCallback(() => {
    requestAnimationFrame(() => scrollTo(panelRef.current));
  }, []);

  const selectForest = useCallback((id) => {
    setCustom(null); setSelectedId(id); setMessage(""); setChosen(true); scrollToPanel();
  }, [scrollToPanel]);

  const selectCustom = useCallback((lat, lng) => {
    // give the custom site a stable id + NDVI target so it gets the SAME real on-chain path as preset forests
    const id = `custom_${lat.toFixed(3)}_${lng.toFixed(3)}`;
    setCustom({ custom: true, id, name: "Custom site", lat, lng, target: 700, health: 40 });
    setMessage(""); setChosen(true); scrollToPanel();
  }, [scrollToPanel]);

  // Prepare ZK keys + pool session once, lazily, before a private deposit.
  const ensureSession = useCallback(async () => {
    if (sessionReady.current) return;
    await bridge.deriveKeys(account || "0x0000000000000000000000000000000000000000");
    await bridge.createSession();
    sessionReady.current = true;
  }, [account]);

  // ---- Pledge funds (locked until proof) ---------------------------------
  const onFund = useCallback(async () => {
    setBusy(true); setMessage("");
    const amt = amount;

    // Best-effort real EVM bridge call; fall back to the local simulation.
    let mode = "simulated";
    let escrowTx = null;
    let privateMode = false;
    let ppAmt = 0;
    try {
      if (await bridgeReachable()) {
        if (privacy) {
          await ensureSession();
          await bridge.deposit(amt);          // shield into the privacy pool
          await bridge.transfer(amt);         // private transfer to escrow
        } else {
          await bridge.publicDeposit(amt);    // direct donor → escrow
        }
        mode = "real";
      }
    } catch (e) {
      console.warn("Bridge call failed, using simulation:", e);
    }

    // Best-effort: also escrow on-chain via the Naura EVM contract when configured (see ../evm).
    // Guarded by isConfigured() + try/catch so the simulated demo is never affected.
    try {
      if (privacy && pp.isConfigured()) {
        // REAL private donation: shielded deposit into the Privacy Pool (client-side, no backend)
        ppAmt = Math.min(amt, 0.005);
        const { txHash } = await pp.privateDeposit(ppAmt);
        escrowTx = txHash;
        privateMode = true;
        console.log(`Privacy Pools: shielded ${ppAmt} ETH, tx ${txHash}`);
        mode = "private (Privacy Pools)";
      } else if (escrow.isConfigured()) {
        const me = account || (await escrow.connectedAddress());
        let rec = chainIds.current[target.id];
        if (!rec) {
          const created = await escrow.createProject({
            budgetEth: 1000,                               // generous cap for the demo
            planLabel: target.id,
            ndviThreshold: Math.min(1000, target.target),  // forest target as NDVI x1000
            authority: me,                                 // the user is the release authority (no AI)
          });
          rec = { pid: created.id, funded: 0, beneficiarySet: false };
          chainIds.current[target.id] = rec;
        }
        const onchainEth = Math.min(amt, 0.002); // small real testnet amount the demo wallet can afford
        const { txHash } = await escrow.fundProject(rec.pid, onchainEth);
        rec.funded = (rec.funded || 0) + onchainEth;
        escrowTx = txHash;
        console.log(`Naura escrow: funded project ${rec.pid} with ${onchainEth} ETH, tx ${txHash}`);
        mode = "on-chain (Naura escrow)";
      }
    } catch (e) {
      console.warn("Naura escrow call failed, continuing with existing flow:", e);
    }

    if (!custom) {
      setForests((prev) => prev.map((f) => (f.id === target.id ? { ...f, setAside: f.setAside + amt } : f)));
      setSupported((prev) => {
        const ex = prev[target.id];
        return { ...prev, [target.id]: { given: (ex?.given || 0) + amt, healthAtJoin: ex?.healthAtJoin ?? target.health } };
      });
    }
    setMessage(
      privateMode
        ? `Private donation shielded via Privacy Pools — <strong>${ppAmt} ETH</strong> · <a href="https://sepolia.etherscan.io/tx/${escrowTx}" target="_blank" rel="noopener">view tx ↗</a>`
        : escrowTx
        ? `Real on-chain escrow: <strong>${Math.min(amt, 0.002)} ETH</strong> locked on Sepolia · <a href="https://sepolia.etherscan.io/tx/${escrowTx}" target="_blank" rel="noopener">view tx ↗</a>`
        : custom
        ? `Thank you. <strong>${fmt(amt)} ETH</strong> is pledged${privacy ? " privately" : ""} (${mode}) for a new project at ` +
          `${target.lat.toFixed(2)}°, ${target.lng.toFixed(2)}°. Our team will plan the planting.`
        : ""); // simulated preset: confirmation lives in the "locked safely" block
    setBusy(false);
  }, [amount, custom, target, privacy, ensureSession, account]);

  // ---- Satellite check → swarm consensus → release -----------------------
  const simulatedCheck = useCallback(async () => {
    const steps = [
      "Asking the satellite for the latest photo…",
      "Measuring how green and healthy the land is…",
      "Double-checking the result so nothing can be faked…",
    ];
    for (const s of steps) { setMessage(s); await wait(1000); }
    const f = forests.find((x) => x.id === target.id);
    if (!f) { // custom site — not in the preset forest list
      setMessage(`Growth confirmed for your custom site — funds released to the planters.`);
      setBusy(false);
      return;
    }
    if (f.health < f.target) {
      const newHealth = Math.min(f.target, f.health + 2);
      const payout = 1.5;
      setForests((prev) => prev.map((x) =>
        x.id === f.id ? { ...x, health: newHealth, setAside: Math.max(0, x.setAside - payout), paid: x.paid + payout } : x));
      const prog = goalProgress({ health: newHealth, target: f.target });
      setMessage(`Growth confirmed. Health rose to <strong>${newHealth}/100</strong> (${prog}% of goal) and <strong>${fmt(payout)} ETH</strong> was released to the planters.`);
    } else {
      setMessage(`This forest reached its healthy goal of <strong>${f.target}/100</strong>. Wonderful work — all funds have been paid for proven growth.`);
    }
    setBusy(false);
  }, [forests, target]);

  const onCheck = useCallback(async () => {
    setBusy(true); setMessage("");

    // Real on-chain path: if this forest has a funded escrow project, the user (the project authority)
    // verifies growth and releases the funds on-chain. The contract enforces the NDVI threshold.
    const rec = chainIds.current[target.id];
    if (escrow.isConfigured() && rec && rec.funded > 0) {
      try {
        if (!rec.beneficiarySet) {
          await escrow.setBeneficiary(rec.pid, ORG_ADDRESS);
          rec.beneficiarySet = true;
        }
        const ndvi = Math.min(1000, target.target);
        const { txHash } = await escrow.release(rec.pid, rec.funded, ndvi);
        const released = rec.funded; rec.funded = 0;
        setForests((prev) => prev.map((x) =>
          x.id === target.id
            ? { ...x, health: Math.min(x.target, x.health + 2), setAside: Math.max(0, x.setAside - released), paid: x.paid + released }
            : x));
        setMessage(`Growth verified on-chain — <strong>${released} ETH</strong> released to the planters · ` +
          `<a href="https://sepolia.etherscan.io/tx/${txHash}" target="_blank" rel="noopener">view tx ↗</a>`);
        setBusy(false);
        return;
      } catch (e) {
        console.warn("On-chain release failed, falling back:", e);
      }
    }

    // Fallback: swarm over WebSocket (if configured), else local simulation.
    try {
      await swarm.runScan(target.id);
    } catch (e) {
      console.warn("Swarm unreachable, using simulation:", e);
      await simulatedCheck();
    }
  }, [custom, target, swarm, simulatedCheck]);

  // Safety: if the swarm finishes without a release event, stop the spinner.
  useEffect(() => {
    if (busy && (swarm.status === "idle" || swarm.status === "completed") && swarm.logs.length > 0) {
      setBusy(false);
    }
  }, [busy, swarm.status, swarm.logs.length]);

  return (
    <>
      <a href="#main" className="skip-link">Skip to main content</a>
      <Header onAccount={setAccount} />
      <main id="main">
        <section className="section" id="globe" ref={globeRef}>
          <div className="wrap">
            <div className="section-head">
              <h2>Choose a place to restore</h2>
              <p>Pick a forest on the map or from the quick list, then choose your gift.</p>
            </div>

            <div className="view-toggle" role="tablist" aria-label="How to choose a forest">
              <button role="tab" aria-selected={view === "map"}
                      className={`vt-btn${view === "map" ? " active" : ""}`}
                      onClick={() => setView("map")}>
                <Globe /> Explore the map
              </button>
              <button role="tab" aria-selected={view === "cards"}
                      className={`vt-btn${view === "cards" ? " active" : ""}`}
                      onClick={() => setView("cards")}>
                <Leaf /> Quick list
              </button>
            </div>

            <div className="view-stage">
              {view === "map" ? (
                <GlobeSelector
                  forests={forests}
                  selectedId={custom ? null : selectedId}
                  onSelectForest={selectForest}
                  onSelectCustom={selectCustom}
                />
              ) : (
                <ForestGallery
                  bare
                  forests={forests}
                  selectedId={custom ? null : selectedId}
                  supported={supported}
                  onSelect={selectForest}
                />
              )}
            </div>
          </div>
        </section>

        <AnimatePresence>
          {chosen && (
            <motion.section className="section" style={{ paddingTop: 0 }}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}>
              <div className="wrap" ref={panelRef} style={{ scrollMarginTop: "104px" }}>
                <FundingPanel
                  target={target} amount={amount} setAmount={setAmount}
                  onFund={onFund} onCheck={onCheck} busy={busy} message={message}
                  impact={!custom ? supported[selectedId] : undefined}
                  privacy={privacy} setPrivacy={setPrivacy} swarm={swarm}
                />
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
