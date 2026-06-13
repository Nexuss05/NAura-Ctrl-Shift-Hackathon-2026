import { useEffect, useState } from "react";
import { Leaf } from "../Icons.jsx";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#forests", label: "Forests" },
  { href: "#globe", label: "Map" },
  { href: "#trust", label: "Trust" }
];

export default function Header({ onSignIn }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`nav${scrolled ? " scrolled" : ""}`} aria-label="Main">
      <div className="nav-inner">
        <a className="brand" href="#main" aria-label="NAura home">
          <span className="brand-mark"><Leaf /></span>
          <strong>NAura</strong>
        </a>
        <div className="nav-links">
          {LINKS.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
        </div>
        <button className="nav-cta" onClick={onSignIn}>Start planting</button>
      </div>
    </nav>
  );
}
