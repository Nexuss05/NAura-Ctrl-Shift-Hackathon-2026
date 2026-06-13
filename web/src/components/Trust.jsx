import { Shield, Eye, Hand } from "../Icons.jsx";

const ITEMS = [
  { Icon: Shield, title: "Nothing to fake", text: "Payment is tied to real satellite evidence, checked by independent machines — not by promises on paper." },
  { Icon: Eye, title: "You can see it", text: "Every forest shows a before and after photo and a clear health score. The proof is open to everyone." },
  { Icon: Hand, title: "Money goes direct", text: "Funds reach the local planters automatically the moment growth is proven. No middle layers taking a cut." }
];

export default function Trust() {
  return (
    <section className="trust">
      <div className="wrap">
        <div className="trust-grid">
          {ITEMS.map(({ Icon, title, text }) => (
            <div className="trust-item" key={title}>
              <Icon />
              <div><h3>{title}</h3><p>{text}</p></div>
            </div>
          ))}
        </div>
      </div>
      <div className="foot">
        <div className="wrap">
          <span>© NAura — verified climate funding</span>
          <span>Forests measured with Sentinel-2 satellite data</span>
        </div>
      </div>
    </section>
  );
}
