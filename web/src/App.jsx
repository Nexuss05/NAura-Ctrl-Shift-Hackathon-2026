import { useState, useRef, useCallback } from "react";
import Header from "./components/Header.jsx";
import Hero from "./components/Hero.jsx";
import HowItWorks from "./components/HowItWorks.jsx";
import GlobeSelector from "./components/GlobeSelector.jsx";
import FundingPanel from "./components/FundingPanel.jsx";
import Trust from "./components/Trust.jsx";
import { FORESTS, goalProgress, fmt } from "./data.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const smooth = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function App() {
  const [forests, setForests] = useState(FORESTS);
  const [selectedId, setSelectedId] = useState(FORESTS[0].id);
  const [custom, setCustom] = useState(null);
  const [amount, setAmount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const globeRef = useRef(null);
  const panelRef = useRef(null);

  const target = custom || forests.find((f) => f.id === selectedId);

  const scrollToPanel = useCallback(() => {
    requestAnimationFrame(() =>
      panelRef.current?.scrollIntoView({ behavior: smooth() ? "smooth" : "auto", block: "start" })
    );
  }, []);

  const selectForest = useCallback((id) => {
    setCustom(null);
    setSelectedId(id);
    setMessage("");
    scrollToPanel();
  }, [scrollToPanel]);

  const selectCustom = useCallback((lat, lng) => {
    setCustom({ custom: true, lat, lng });
    setMessage("");
    scrollToPanel();
  }, [scrollToPanel]);

  const goToGlobe = useCallback(() => {
    globeRef.current?.scrollIntoView({ behavior: smooth() ? "smooth" : "auto", block: "start" });
  }, []);

  // Pledge funds (locked / "set aside" until proof)
  const onFund = useCallback(async () => {
    setBusy(true);
    setMessage("");
    await wait(900);
    if (!custom) {
      setForests((prev) =>
        prev.map((f) => (f.id === target.id ? { ...f, setAside: f.setAside + amount } : f))
      );
      setMessage(
        `Thank you. <strong>${fmt(amount)} ETH</strong> is now set aside for ${target.name}. It will only be released when satellites prove new growth.`
      );
    } else {
      setMessage(
        `Thank you. <strong>${fmt(amount)} ETH</strong> is pledged for a new project at ${target.lat.toFixed(2)}°, ${target.lng.toFixed(2)}°. Our team will plan the planting.`
      );
    }
    setBusy(false);
  }, [amount, custom, target]);

  // Satellite check → measure growth → release payment on real growth
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
      setForests((prev) =>
        prev.map((x) =>
          x.id === f.id
            ? { ...x, health: newHealth, setAside: Math.max(0, x.setAside - payout), paid: x.paid + payout }
            : x
        )
      );
      const prog = goalProgress({ health: newHealth, target: f.target });
      setMessage(
        `Growth confirmed. Health rose to <strong>${newHealth}/100</strong> (${prog}% of goal) and <strong>${fmt(payout)} ETH</strong> was released to the planters.`
      );
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
        <Hero onStart={goToGlobe} />
        <HowItWorks />

        <section className="section" style={{ paddingTop: 0 }} ref={globeRef}>
          <div className="wrap">
            <div className="section-head">
              <h2>Choose a place on the globe</h2>
              <p>Spin the Earth, then click a forest — or any patch of land you care about.</p>
            </div>
            <GlobeSelector
              forests={forests}
              selectedId={custom ? null : selectedId}
              onSelectForest={selectForest}
              onSelectCustom={selectCustom}
            />
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap" ref={panelRef} style={{ scrollMarginTop: "90px" }}>
            <FundingPanel
              target={target}
              amount={amount}
              setAmount={setAmount}
              onFund={onFund}
              onCheck={onCheck}
              busy={busy}
              message={message}
            />
          </div>
        </section>

        <Trust />
      </main>
    </>
  );
}
