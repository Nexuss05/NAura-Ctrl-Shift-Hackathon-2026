import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { goalProgress, fmt, photoFor } from "../data.js";
import { GripH, Coins, Eye, Check, Pin } from "../Icons.jsx";

const CHIPS = [0.5, 1, 2.5, 5];

// Photo before/after: "before" is the same aerial photo desaturated/dried out.
function Compare({ photo, name }) {
  const [v, setV] = useState(50);
  return (
    <div className="compare">
      <img className="compare-img compare-before" src={photo} alt={`Before restoration at ${name}: dry, bare land.`} />
      <img className="compare-img compare-after" src={photo} alt={`After restoration at ${name}: healthy green forest.`}
           style={{ clipPath: `inset(0 0 0 ${v}%)` }} />
      <span className="compare-tag before">Before</span>
      <span className="compare-tag after">Now</span>
      <div className="compare-handle" style={{ left: `${v}%` }}>
        <div className="compare-grip"><GripH /></div>
      </div>
      <input type="range" min="0" max="100" value={v}
             onChange={(e) => setV(+e.target.value)}
             aria-label="Drag to compare the land before and now" />
    </div>
  );
}

export default function FundingPanel({ target, amount, setAmount, onFund, onCheck, busy, message }) {
  if (!target) return null;
  const isForest = !target.custom;

  return (
    <motion.article className="panel" tabIndex={-1} aria-live="polite"
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="panel-grid">
        {isForest ? (
          <Compare photo={photoFor(target, 1000)} name={target.name} />
        ) : (
          <div className="compare" style={{ display: "grid", placeItems: "center", color: "#fff", textAlign: "center", padding: "2rem" }}>
            <div>
              <Pin />
              <h3 style={{ color: "#fff", marginTop: "1rem" }}>A new place to protect</h3>
              <p style={{ color: "var(--green-200)", margin: 0 }}>
                {target.lat.toFixed(2)}°, {target.lng.toFixed(2)}°<br />
                Pledge here and our team will plan a forest for this land.
              </p>
            </div>
          </div>
        )}

        <div className="panel-info">
          <h2>{isForest ? target.name : "Protect a new area"}</h2>
          <p className="panel-loc"><Pin /> {isForest ? target.place : `${target.lat.toFixed(2)}° , ${target.lng.toFixed(2)}°`}</p>
          <p className="desc">
            {isForest ? target.story : "You picked a spot on the map. Your pledge starts a brand-new restoration project here, watched by satellites just like the others."}
          </p>

          {isForest && (
            <div className="stats">
              <div className="stat-tile">
                <span className="label">Forest health now</span>
                <span className="value">{target.health}<small style={{ fontSize: "1rem" }}>/100</small></span>
              </div>
              <div className="stat-tile">
                <span className="label">Healthy goal</span>
                <span className="value">{target.target}<small style={{ fontSize: "1rem" }}>/100</small></span>
              </div>
              <div className="stat-tile gold">
                <span className="label">Toward goal</span>
                <span className="value">{goalProgress(target)}%</span>
              </div>
            </div>
          )}

          <div className="fund">
            <div className="fund-label">
              <label htmlFor="amount" style={{ fontWeight: 600 }}>How much would you like to give?</label>
              <b>{fmt(amount)} <span style={{ fontSize: "1rem" }}>ETH</span></b>
            </div>
            <input id="amount" className="amount-range" type="range" min="0.1" max="10" step="0.1"
                   value={amount} onChange={(e) => setAmount(+e.target.value)} />
            <div className="chips">
              {CHIPS.map((c) => (
                <button key={c} className="chip" aria-pressed={amount === c} onClick={() => setAmount(c)}>{c} ETH</button>
              ))}
            </div>
          </div>

          <button className="btn btn-lime btn-block" onClick={onFund} disabled={busy}>
            <Coins /> Pledge {fmt(amount)} ETH to this forest
          </button>

          {isForest && (
            <button className="btn btn-ghost btn-block" style={{ marginTop: "0.75rem" }} onClick={onCheck} disabled={busy}>
              <Eye /> Check growth from space now
            </button>
          )}

          <AnimatePresence>
            {message && (
              <motion.p className="live-msg" role="status"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <Check /> <span dangerouslySetInnerHTML={{ __html: message }} />
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.article>
  );
}
