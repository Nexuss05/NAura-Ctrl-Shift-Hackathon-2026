import { motion } from "framer-motion";
import { Vault, Globe, Check } from "../Icons.jsx";

const STEPS = [
  { Icon: Vault, title: "1. Money is set aside", text: "Funds for a forest are locked safely in advance — kept aside until the work is proven, not before." },
  { Icon: Globe, title: "2. Satellites watch from space", text: "Every few weeks, satellites measure how green and healthy the land has become. Machines check the photos — no one can fake it." },
  { Icon: Check, title: "3. Real growth gets paid", text: "When the trees genuinely grow back, the money is released to the people planting them. Proof first, payment second." }
];

export default function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="wrap">
        <div className="section-head">
          <h2>How it works, in three steps</h2>
          <p>Simple enough for anyone. Strong enough to trust.</p>
        </div>
        <div className="steps">
          {STEPS.map(({ Icon, title, text }, i) => (
            <motion.div className="step" key={title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
            >
              <span className="step-num"><Icon /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
