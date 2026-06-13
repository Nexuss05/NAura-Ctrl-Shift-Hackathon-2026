import { motion } from "framer-motion";
import { Eye, Arrow, ChevronDown } from "../Icons.jsx";

const HERO_PHOTO =
  "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&w=2000&q=75";

export default function Hero({ onStart, onLearn }) {
  return (
    <section className="hero">
      <img className="hero-bg" src={HERO_PHOTO} alt="" aria-hidden="true" />
      <motion.div
        className="hero-content"
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <span className="hero-eyebrow"><Eye /> Honest climate funding</span>
        <h1>Help nurture land and <em>fight climate change.</em></h1>
        <p className="lead">
          Pick a forest anywhere on Earth and choose how much to give. Satellites
          watch from space — and the money is released only when the trees truly grow back.
        </p>
        <div className="hero-actions">
          <button className="btn btn-lime" onClick={onStart}>
            <Arrow /> Start planting land
          </button>
          <button className="btn btn-glass" onClick={onLearn}>Learn how it works</button>
        </div>
      </motion.div>

      <button className="scroll-cue" onClick={onLearn} aria-label="Scroll to learn more">
        <ChevronDown />
      </button>
    </section>
  );
}
