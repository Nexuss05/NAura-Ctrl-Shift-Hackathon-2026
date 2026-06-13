import { Leaf } from "../Icons.jsx";

export default function Header() {
  return (
    <header className="site-header">
      <div className="wrap">
        <div className="brand">
          <span className="brand-mark"><Leaf /></span>
          <span className="brand-text">
            <strong>NAura</strong>
            <span>Proof you can see</span>
          </span>
        </div>
        <p className="lang-status"><span className="dot" aria-hidden="true" /> Live &amp; verified</p>
      </div>
    </header>
  );
}
