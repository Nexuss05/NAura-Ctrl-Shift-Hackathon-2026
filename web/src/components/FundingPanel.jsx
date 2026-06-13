import { motion, AnimatePresence } from "framer-motion";
import { goalProgress, fmt } from "../data.js";
import { Coins, Eye, Check, Pin } from "../Icons.jsx";
import SatelliteCompare from "./SatelliteCompare.jsx";

const CHIPS = [0.5, 1, 2.5, 5];

export default function FundingPanel({ target, amount, setAmount, onFund, onCheck, busy, message }) {
  if (!target) return null;
  const isForest = !target.custom;

  return (
    <motion.article className="panel" tabIndex={-1} aria-live="polite"
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="panel-grid">
        <div className="sat-col">
          <SatelliteCompare key={target.id || `${target.lat},${target.lng}`} lat={target.lat} lng={target.lng} />
          <p className="sat-caption">
            Real Sentinel-2 satellite imagery — drag to compare 2017 with 2024.
          </p>
        </div>

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
