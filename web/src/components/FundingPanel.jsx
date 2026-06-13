import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { goalProgress, fmt, impactOf, projIntensity } from "../data.js";
import { Coins, Eye, Check, Pin, Leaf } from "../Icons.jsx";
import SatelliteCompare from "./SatelliteCompare.jsx";

const CHIPS = [0.5, 1, 2.5, 5];

export default function FundingPanel({ target, amount, setAmount, onFund, onCheck, busy, message, impact }) {
  const [preview, setPreview] = useState(false);
  const isForest = target ? !target.custom : false;
  const key = target ? (target.id || `${target.lat},${target.lng}`) : "none";

  // Start each site on the real satellite view, not the projection.
  useEffect(() => { setPreview(false); }, [key]);

  if (!target) return null;

  const imp = impactOf(amount, isForest ? target : null);
  const gained = impact ? Math.max(0, target.health - impact.healthAtJoin) : 0;
  const pledged = Boolean(impact);

  return (
    <motion.article className="panel" tabIndex={-1} aria-live="polite"
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="panel-grid">
        <div className="sat-col">
          <SatelliteCompare key={key} lat={target.lat} lng={target.lng}
            projected={preview} gap={projIntensity(amount)} />
          <p className="sat-caption">
            {preview
              ? <span>Simulated preview of full restoration — for illustration only.</span>
              : <span>Real Sentinel-2 satellite imagery — drag the slider to compare 2017 with today.</span>}
          </p>
        </div>

        <div className="panel-info">
          <h2>{isForest ? target.name : "Protect a new area"}</h2>
          <p className="panel-loc"><Pin /> {isForest ? target.place : `${target.lat.toFixed(2)}° , ${target.lng.toFixed(2)}°`}</p>
          <p className="desc">
            {isForest
              ? target.story
              : "You picked this spot on the map. Your gift starts a brand-new restoration project here, watched by satellites just like the others."}
          </p>

          {isForest && (
            <div className="stats">
              <div className="stat-tile">
                <span className="label">Health today</span>
                <span className="value">
                  {target.health}<small style={{ fontSize: "1rem" }}>/100</small>
                  {gained > 0 && <span className="delta-chip">+{gained}</span>}
                </span>
              </div>
              <div className="stat-tile">
                <span className="label">Healthy goal</span>
                <span className="value">{target.target}<small style={{ fontSize: "1rem" }}>/100</small></span>
              </div>
              <div className="stat-tile gold">
                <span className="label">Reached so far</span>
                <span className="value">{goalProgress(target)}%</span>
              </div>
            </div>
          )}

          {/* STEP 1 — choose the gift */}
          <div className="fund">
            <span className="step-tag">Step 1 · Choose your gift</span>
            <div className="fund-label">
              <label htmlFor="amount">How much would you like to give?</label>
              <b>{fmt(amount)} <span style={{ fontSize: "1rem" }}>ETH</span></b>
            </div>
            <input id="amount" className="amount-range" type="range" min="0.1" max="10" step="0.1"
                   value={amount} onChange={(e) => setAmount(+e.target.value)} />
            <div className="chips">
              {CHIPS.map((c) => (
                <button key={c} className="chip" aria-pressed={amount === c} onClick={() => setAmount(c)}>{c} ETH</button>
              ))}
            </div>
            <p className="fund-help">
              <Leaf /> Funds about <strong>{imp.trees.toLocaleString()} trees</strong> over <strong>{imp.hectares} hectares</strong>.
            </p>
          </div>

          {/* STEP 2 — preview the growth this gift creates */}
          {isForest && (
            <button className={`btn btn-outline btn-block step-btn${preview ? " active" : ""}`}
                    aria-pressed={preview} onClick={() => setPreview((p) => !p)}>
              <Eye /> {preview ? "Hide the preview" : "Step 2 · Preview the growth your gift creates"}
            </button>
          )}
          <AnimatePresence>
            {preview && isForest && (
              <motion.p className="preview-note"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                With <strong>{fmt(amount)} ETH</strong>, {target.name} could grow from {target.health}/100 to about{" "}
                <strong>{imp.projHealth}/100 health</strong> — roughly {imp.trees.toLocaleString()} new trees across{" "}
                {imp.hectares} hectares. The map on the left shows how the land could look once restored.
              </motion.p>
            )}
          </AnimatePresence>

          {/* STEP 3 — pledge */}
          <button className="btn btn-lime btn-block step3" onClick={onFund} disabled={busy}>
            <Coins /> Step 3 · Pledge {fmt(amount)} ETH
          </button>

          {/* STEP 4 — appears only after pledging, so the order is unmistakable */}
          <AnimatePresence>
            {pledged && isForest && (
              <motion.div className="after-pledge"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="ap-head"><Check /> Your gift is locked safely</div>
                <p>
                  Your <strong>{fmt(impact.given)} ETH</strong> is set aside for {target.name}. It is released to
                  the local planters only when satellites confirm real new growth — never before.
                  {gained > 0 && <> Since you joined, its health has grown <strong>+{gained} points</strong>.</>}
                </p>
                <button className="btn btn-ghost btn-block" onClick={onCheck} disabled={busy}>
                  <Eye /> Step 4 · Verify growth from space
                </button>
              </motion.div>
            )}
          </AnimatePresence>

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
