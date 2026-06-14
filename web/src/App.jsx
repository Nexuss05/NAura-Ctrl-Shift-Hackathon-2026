import { useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Header from "./components/Header.jsx";
import ForestGallery from "./components/ForestGallery.jsx";
import GlobeSelector from "./components/GlobeSelector.jsx";
import FundingPanel from "./components/FundingPanel.jsx";
import { Globe, Leaf } from "./Icons.jsx";
import { FORESTS, goalProgress, fmt } from "./data.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const smooth = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const scrollTo = (el) => el?.scrollIntoView({ behavior: smooth() ? "smooth" : "auto", block: "start" });

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

  const globeRef = useRef(null);
  const panelRef = useRef(null);

  const target = custom || forests.find((f) => f.id === selectedId);

  const scrollToPanel = useCallback(() => {
    requestAnimationFrame(() => scrollTo(panelRef.current));
  }, []);

  const selectForest = useCallback((id) => {
    setCustom(null); setSelectedId(id); setMessage(""); setChosen(true); scrollToPanel();
  }, [scrollToPanel]);

  const selectCustom = useCallback((lat, lng) => {
    setCustom({ custom: true, lat, lng }); setMessage(""); setChosen(true); scrollToPanel();
  }, [scrollToPanel]);

  // Pledge funds (locked until proof)
  const onFund = useCallback(async () => {
    setBusy(true); setMessage("");
    await wait(900);
    if (!custom) {
      setForests((prev) => prev.map((f) => (f.id === target.id ? { ...f, setAside: f.setAside + amount } : f)));
      setSupported((prev) => {
        const ex = prev[target.id];
        return { ...prev, [target.id]: { given: (ex?.given || 0) + amount, healthAtJoin: ex?.healthAtJoin ?? target.health } };
      });
      setMessage(""); // confirmation now lives in the Step 4 "locked safely" block
    } else {
      setMessage(`Thank you. <strong>${fmt(amount)} ETH</strong> is pledged for a new project at ${target.lat.toFixed(2)}°, ${target.lng.toFixed(2)}°. Our team will plan the planting.`);
    }
    setBusy(false);
  }, [amount, custom, target]);

  // Satellite check → growth → release payment
  const onCheck = useCallback(async () => {
    if (custom) return;
    setBusy(true);
    const steps = [
      "Asking the satellite for the latest photo…",
      "Measuring how green and healthy the land is…",
      "Double-checking the result so nothing can be faked…"
    ];
    for (const s of steps) { setMessage(s); await wait(1000); }
    const f = forests.find((x) => x.id === target.id);
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
  }, [custom, forests, target]);

  return (
    <>
      <a href="#main" className="skip-link">Skip to main content</a>
      <Header />
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
                />
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
