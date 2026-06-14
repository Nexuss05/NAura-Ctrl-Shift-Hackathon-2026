import { useEffect, useState, useCallback } from "react";
import { Coins } from "../Icons.jsx";

// Read the rendered background colour directly under the topbar and pick the
// text theme from its luminance, so contrast always matches the real backdrop.
function bgLuminanceAt(x, y) {
  let node = document.elementFromPoint(x, y);
  while (node) {
    const c = getComputedStyle(node).backgroundColor;
    const m = c && c.match(/[\d.]+/g);
    if (m && m.length >= 3 && (m.length < 4 || +m[3] > 0.1)) {
      const [r, g, b] = m.map(Number);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }
    node = node.parentElement;
  }
  return 1; // assume light if nothing found
}

const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function Header({ onAccount }) {
  const [behindDark, setBehindDark] = useState(false);
  const [account, setAccountState] = useState(null);
  const [connecting, setConnecting] = useState(false);

  // keep a single setter that also notifies the parent (App) of wallet changes
  const setAccount = (a) => { setAccountState(a); onAccount?.(a); };

  // Dynamic contrast against whatever sits under the bar.
  useEffect(() => {
    let raf = 0;
    const probe = () => {
      raf = 0;
      setBehindDark(bgLuminanceAt(window.innerWidth / 2, 28) < 0.5);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(probe); };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Reflect wallet changes coming from the extension.
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    eth.request?.({ method: "eth_accounts" })
      .then((a) => a?.[0] && setAccount(a[0]))
      .catch(() => {});
    const onAccounts = (a) => setAccount(a?.[0] ?? null);
    eth.on?.("accountsChanged", onAccounts);
    return () => eth.removeListener?.("accountsChanged", onAccounts);
  }, []);

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) {
      window.open("https://metamask.io/download/", "_blank", "noopener");
      return;
    }
    try {
      setConnecting(true);
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      setAccount(accounts?.[0] ?? null);
    } catch {
      // user rejected or request failed — keep current state
    } finally {
      setConnecting(false);
    }
  }, []);

  const theme = behindDark ? "behind-dark" : "behind-light";

  return (
    <header className={`topbar ${theme}`}>
      <a className="brand glass-chip" href="#main" aria-label="NAura home">
        <img className="brand-logo" src="/naura-logo.png" alt="NAura" />
      </a>

      <button className="wallet-btn glass-chip" onClick={connect}
              disabled={connecting} aria-live="polite"
              aria-label={account ? `Wallet connected ${account}` : "Connect your crypto wallet"}>
        <Coins />
        <span>{account ? shortAddr(account) : connecting ? "Connecting…" : "Connect wallet"}</span>
        {account && <span className="wallet-dot" aria-hidden="true" />}
      </button>
    </header>
  );
}
