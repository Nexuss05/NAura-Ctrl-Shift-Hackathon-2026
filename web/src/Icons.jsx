// Inline Lucide-style icons (consistent 2px stroke, accessible by default)
const base = {
  fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true
};
const make = (path) => (props) => (
  <svg viewBox="0 0 24 24" {...base} {...props}>{path}</svg>
);

export const Leaf = make(<><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></>);
export const Eye = make(<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>);
export const Arrow = make(<><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>);
export const Pin = make(<><path d="M20 10c0 4.4-8 12-8 12s-8-7.6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>);
export const Vault = make(<><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/></>);
export const Globe = make(<><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/></>);
export const Check = make(<path d="M20 6 9 17l-5-5"/>);
export const Shield = make(<><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/><path d="m9 12 2 2 4-4"/></>);
export const Coins = make(<><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></>);
export const Hand = make(<><path d="M11 14h2a2 2 0 0 0 2-2v0a2 2 0 0 0-2-2H9.5a3.5 3.5 0 0 0 0 7H13"/><path d="M12 2v20"/></>);
export const GripH = make(<><path d="m9 7-5 5 5 5"/><path d="m15 7 5 5-5 5"/></>);
export const Cursor = make(<><path d="m4 4 7.07 17 2.51-7.39L21 11.07Z"/></>);
