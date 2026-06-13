// NAura forests — plain-language data with map coordinates
export const FORESTS = [
  {
    id: "maremma",
    name: "Maremma Woodland",
    place: "Grosseto, Tuscany — Italy",
    flag: "Italy",
    lat: 42.716, lng: 11.114,
    story: "Old mining land brought back to life with native Mediterranean trees and shrubs, planted by local hands.",
    health: 38, target: 52,
    setAside: 15.0, paid: 0.0,
    hue: 150
  },
  {
    id: "mau",
    name: "Mau Forest",
    place: "Rift Valley — Kenya",
    flag: "Kenya",
    lat: -0.633, lng: 35.833,
    story: "Replanting a vital water forest, led by the local communities who depend on the rivers it feeds.",
    health: 48, target: 55,
    setAside: 45.0, paid: 12.5,
    hue: 130
  },
  {
    id: "xingu",
    name: "Xingu River Forest",
    place: "Mato Grosso — Brazil",
    flag: "Brazil",
    lat: -11.524, lng: -53.189,
    story: "Reconnecting broken patches of Amazon rainforest so wildlife can move freely between them again.",
    health: 51, target: 60,
    setAside: 120.0, paid: 40.0,
    hue: 160
  }
];

export const goalProgress = (f) => Math.min(100, Math.round((f.health / f.target) * 100));
export const fmt = (n) => Number(n).toFixed(2);

// Inline SVG forest scene (before = sparse/brown, after = lush/green)
export function scene(hue = 150, lush = true) {
  const sky = lush ? `hsl(${hue},45%,82%)` : "#D9CBB6";
  const ground = lush ? `hsl(${hue},40%,40%)` : "#B59B78";
  const ground2 = lush ? `hsl(${hue},45%,30%)` : "#9C815F";
  const trees = lush ? 9 : 3;
  const tFill = lush ? `hsl(${hue},50%,24%)` : "#7A6A4F";
  let t = "";
  for (let i = 0; i < trees; i++) {
    const x = 30 + (i * 360) / trees + (i % 2) * 14;
    const y = 240 + (i % 3) * 18;
    const r = lush ? 26 + (i % 3) * 6 : 14;
    t += `<path d="M${x} ${y + 40} L${x - 3} ${y} Q${x} ${y - 8} ${x + 3} ${y} Z" fill="${tFill}"/><circle cx="${x}" cy="${y - 6}" r="${r}" fill="${tFill}"/>`;
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'>
      <rect width='400' height='300' fill='${sky}'/>
      <circle cx='330' cy='60' r='34' fill='${lush ? "#FCD34D" : "#E9DCC0"}'/>
      <path d='M0 220 Q120 190 240 215 T400 205 V300 H0Z' fill='${ground}'/>
      <path d='M0 255 Q140 230 260 250 T400 245 V300 H0Z' fill='${ground2}'/>
      ${t}
    </svg>`
  )}`;
}
