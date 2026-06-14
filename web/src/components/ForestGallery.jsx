import { motion } from "framer-motion";
import { goalProgress, photoFor } from "../data.js";
import { Pin, Check } from "../Icons.jsx";

export default function ForestGallery({ forests, selectedId, supported = {}, onSelect, bare = false }) {
  const grid = (
    <div className="gallery" role="list">
      {forests.map((f, i) => (
        <motion.button
          key={f.id}
          className="fcard"
          role="listitem"
          aria-pressed={f.id === selectedId}
          aria-label={`${f.name}, ${f.place}. Forest health ${f.health} out of 100. Choose this forest.`}
          onClick={() => onSelect(f.id)}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
        >
          <img src={photoFor(f, 700)} alt={`Aerial view of ${f.name}.`} loading="lazy" />
          <span className="fcard-flag">{f.flag}</span>
          {supported[f.id] && <span className="fcard-supported"><Check /> You support this</span>}
          <span className="fcard-body">
            <h3>{f.name}</h3>
            <span className="fcard-loc"><Pin /> {f.place}</span>
            <span className="fcard-health">
              <span className="fcard-bar"><i style={{ width: `${goalProgress(f)}%` }} /></span>
              <b>{f.health}/100</b>
            </span>
          </span>
        </motion.button>
      ))}
    </div>
  );

  if (bare) return grid;

  return (
    <section className="section" id="forests" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="section-head">
          <h2>Or quick-select a featured forest</h2>
          <p>Twelve real restoration sites, on six continents. Tap one to load its proof below.</p>
        </div>
        {grid}
      </div>
    </section>
  );
}
