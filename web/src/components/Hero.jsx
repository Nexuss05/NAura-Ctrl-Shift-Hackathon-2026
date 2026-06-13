import { motion } from "framer-motion";
import { Eye, Arrow } from "../Icons.jsx";

export default function Hero({ onStart }) {
  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <span className="eyebrow"><Eye /> Honest climate funding</span>
          <h1>Your help only pays out when the trees <em>actually grow.</em></h1>
          <p className="lead">
            Spin the globe, choose a forest, and decide how much to give.
            Satellites watch from space — and the money is released only when the
            trees truly grow back. You can see the before and after with your own eyes.
          </p>
          <div className="btn-row">
            <button className="btn btn-primary" style={{ width: "auto" }} onClick={onStart}>
              <Arrow /> Choose a place on the globe
            </button>
            <a href="#how" className="btn btn-ghost">How it works</a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          aria-hidden="true"
          style={{
            borderRadius: 28, overflow: "hidden", border: "6px solid #fff",
            boxShadow: "var(--shadow-lg)", aspectRatio: "4 / 5",
            background: "linear-gradient(160deg,#10B981,#065F46)", position: "relative"
          }}
        >
          <svg viewBox="0 0 320 400" preserveAspectRatio="xMidYMid slice"
               style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <circle cx="250" cy="70" r="42" fill="#FCD34D" opacity="0.9" />
            <path d="M0 300 Q80 250 160 290 T320 280 V400 H0Z" fill="#10B981" />
            <path d="M0 340 Q90 300 180 330 T320 320 V400 H0Z" fill="#047857" />
            <g fill="#064E3B">
              <path d="M70 360 L60 300 Q70 270 80 300 Z" /><circle cx="70" cy="300" r="26" />
              <path d="M150 380 L138 290 Q150 250 162 290 Z" /><circle cx="150" cy="285" r="34" />
              <path d="M240 370 L232 310 Q240 280 248 310 Z" /><circle cx="240" cy="305" r="28" />
            </g>
          </svg>
        </motion.div>
      </div>
    </section>
  );
}
