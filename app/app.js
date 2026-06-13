/* ============================================================
   NAura — Accessible Public Interface (vanilla JS, no build)
   Plain-language layer over the climate-finance data.
   ============================================================ */

// ---- Data (jargon translated to everyday words) ----
const FORESTS = [
  {
    id: "maremma",
    name: "Maremma Woodland",
    place: "Grosseto, Tuscany — Italy",
    flag: "Italy",
    story: "Old mining land brought back to life with native Mediterranean trees and shrubs, planted by local hands.",
    health: 38, target: 52,           // forest-health score 0–100 (from NDVI)
    setAside: 15.0, paid: 0.0,        // funds (ETH)
    hue: 150
  },
  {
    id: "mau",
    name: "Mau Forest",
    place: "Rift Valley — Kenya",
    flag: "Kenya",
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
    story: "Reconnecting broken patches of Amazon rainforest so wildlife can move freely between them again.",
    health: 51, target: 60,
    setAside: 120.0, paid: 40.0,
    hue: 160
  }
];

let activeId = FORESTS[0].id;

// ---- Helpers ----
const $ = (sel, root = document) => root.querySelector(sel);
const get = (id) => FORESTS.find(f => f.id === id);
const pct = (f) => Math.max(0, Math.min(100, Math.round(((f.health - 0) / f.target) * 100))); // share of goal
const goalProgress = (f) => Math.min(100, Math.round((f.health / f.target) * 100));
const fmt = (n) => n.toFixed(2);

// ---- SVG forest scene generator (before = sparse, after = lush) ----
function scene(hue, lush) {
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

// ---- Render project cards ----
function renderCards() {
  const list = $("#project-list");
  list.innerHTML = FORESTS.map(f => `
    <button class="project-card" role="listitem" data-id="${f.id}"
            aria-pressed="${f.id === activeId}"
            aria-label="${f.name}, ${f.place}. Forest health ${f.health} out of 100. Open details.">
      <div class="project-photo">
        <img src="${scene(f.hue, true)}" alt="" aria-hidden="true">
        <span class="project-flag">${f.flag}</span>
      </div>
      <div class="project-body">
        <h3>${f.name}</h3>
        <p class="project-loc">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.4-8 12-8 12s-8-7.6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          ${f.place}
        </p>
        <div class="health-row">
          <p class="health-label"><span>Forest health</span> <b>${f.health}<span style="font-size:1rem;color:var(--text-soft)">/100</span></b></p>
          <div class="bar"><div class="bar-fill" style="width:${goalProgress(f)}%"></div></div>
        </div>
      </div>
    </button>
  `).join("");

  list.querySelectorAll(".project-card").forEach(btn => {
    btn.addEventListener("click", () => selectForest(btn.dataset.id));
  });
}

// ---- Render detail panel ----
function renderDetail() {
  const f = get(activeId);
  const detail = $("#detail");
  detail.innerHTML = `
    <div class="detail-grid">
      <div class="compare" id="compare">
        <img class="compare-img compare-before" src="${scene(f.hue, false)}" alt="Before: sparse, damaged land at ${f.name}.">
        <img class="compare-img compare-after"  src="${scene(f.hue, true)}"  alt="After: recovered green forest at ${f.name}." style="clip-path:inset(0 0 0 50%)">
        <span class="compare-tag before">Before</span>
        <span class="compare-tag after">Now</span>
        <div class="compare-handle" id="handle">
          <div class="compare-grip" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 7-5 5 5 5"/><path d="m15 7 5 5-5 5"/></svg>
          </div>
        </div>
        <input type="range" id="compare-range" min="0" max="100" value="50"
               aria-label="Drag to compare the forest before and now">
      </div>

      <div class="detail-info">
        <h2>${f.name}</h2>
        <p class="detail-loc">${f.place}</p>
        <p class="desc">${f.story}</p>

        <div class="stats">
          <div class="stat-tile">
            <span class="label">Forest health now</span>
            <span class="value" id="stat-health">${f.health}<small style="font-size:1rem">/100</small></span>
          </div>
          <div class="stat-tile">
            <span class="label">Healthy goal</span>
            <span class="value">${f.target}<small style="font-size:1rem">/100</small></span>
          </div>
          <div class="stat-tile gold">
            <span class="label">Toward goal</span>
            <span class="value" id="stat-goal">${goalProgress(f)}%</span>
          </div>
        </div>

        <div class="money">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>
          <div>
            <b id="money-paid">${fmt(f.paid)} <span style="font-size:1rem">ETH</span></b>
            <span>already paid for proven growth — out of ${fmt(f.setAside + f.paid)} ETH set aside.</span>
          </div>
        </div>

        <button class="btn btn-primary" id="check-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          Check this forest now
        </button>
        <p class="live-msg" id="live-msg" role="status" hidden></p>
      </div>
    </div>
  `;

  setupCompare();
  $("#check-btn").addEventListener("click", checkForest);
}

// ---- Before/After slider ----
function setupCompare() {
  const range = $("#compare-range");
  const after = $(".compare-after");
  const handle = $("#handle");
  const move = (v) => {
    after.style.clipPath = `inset(0 0 0 ${v}%)`;
    handle.style.left = `${v}%`;
  };
  range.addEventListener("input", () => move(range.value));
}

// ---- "Check the forest" simulation (plain-language swarm scan) ----
let busy = false;
function checkForest() {
  if (busy) return;
  const f = get(activeId);
  const btn = $("#check-btn");
  const msg = $("#live-msg");
  busy = true;
  btn.disabled = true;
  msg.hidden = false;

  const steps = [
    "Asking the satellite for the latest photo…",
    "Measuring how green and healthy the land is…",
    "Double-checking the result so nothing can be faked…"
  ];
  let i = 0;
  msg.innerHTML = spinnerSvg() + steps[0];
  const tick = setInterval(() => {
    i++;
    if (i < steps.length) {
      msg.innerHTML = spinnerSvg() + steps[i];
    } else {
      clearInterval(tick);
      finishCheck(f, btn, msg);
    }
  }, 1100);
}

function finishCheck(f, btn, msg) {
  const grew = f.health < f.target;
  if (grew) {
    f.health = Math.min(f.target, f.health + 2);   // real growth measured
    const payout = 1.5;
    f.setAside = Math.max(0, f.setAside - payout);
    f.paid += payout;
    $("#stat-health").innerHTML = `${f.health}<small style="font-size:1rem">/100</small>`;
    $("#stat-goal").textContent = `${goalProgress(f)}%`;
    $("#money-paid").innerHTML = `${fmt(f.paid)} <span style="font-size:1rem">ETH</span>`;
    msg.innerHTML = checkSvg() + `Growth confirmed. Health rose to <strong>${f.health}/100</strong> and <strong>${fmt(payout)} ETH</strong> was paid to the planters.`;
    // refresh the matching card bar
    const card = document.querySelector(`.project-card[data-id="${f.id}"] .bar-fill`);
    if (card) card.style.width = goalProgress(f) + "%";
    const cardHealth = document.querySelector(`.project-card[data-id="${f.id}"] .health-label b`);
    if (cardHealth) cardHealth.innerHTML = `${f.health}<span style="font-size:1rem;color:var(--text-soft)">/100</span>`;
  } else {
    msg.innerHTML = checkSvg() + `This forest has reached its healthy goal of <strong>${f.target}/100</strong>. Wonderful work — all funds have been paid for proven growth.`;
  }
  busy = false;
  btn.disabled = false;
}

function spinnerSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="animation:rise 0s"><path d="M21 12a9 9 0 1 1-6.2-8.5"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite"/></path></svg>`;
}
function checkSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;
}

// ---- Select a forest ----
function selectForest(id) {
  activeId = id;
  document.querySelectorAll(".project-card").forEach(c =>
    c.setAttribute("aria-pressed", String(c.dataset.id === id)));
  renderDetail();
  const detail = $("#detail");
  detail.focus({ preventScroll: true });
  detail.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---- Init ----
renderCards();
renderDetail();
