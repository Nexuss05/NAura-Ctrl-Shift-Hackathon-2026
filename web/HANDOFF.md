# NAura — Frontend Handoff

_Last updated: 2026-06-13 · Branch: `feature/accessible-ui`_

This document captures where the UI work stands and everything needed to keep
building. Read it top to bottom before touching code.

---

## 1. What NAura is

**NAura** = verified climate-finance protocol. Donors fund forest-restoration
sites; money is held in escrow and **released only when satellite imagery proves
the trees actually grew** (NDVI / AI swarm: Observer → Auditor → Treasurer, on
Solana Devnet). The new UI makes this honest, simple, and visible to anyone —
including non-technical and elderly users.

Tagline in use: **"Proof you can see."**

---

## 2. Repo layout (two frontends — don't confuse them)

| Path | What | Status |
|------|------|--------|
| `index.html`, `model.js`, `view.js`, `viewmodel.js`, `styles.css` (root) | Original dark "agent swarm console" (MVVM, globe.gl). | Legacy / demo of the backend swarm. Leave as-is. |
| `app/` | First accessible rewrite, **vanilla HTML/CSS/JS**. | Superseded by `web/`. Keep as a no-build fallback. |
| **`web/`** | **Current React app. All new work happens here.** | Active. |
| `backend/` | Python FastAPI/WebSocket swarm, NDVI, Solana treasurer. | Not wired to `web/` yet. |
| `anchor/` | Solana Anchor escrow program (Rust). | Not wired to `web/` yet. |

---

## 3. Running `web/`

```bash
cd web
npm install            # if cache errors: add  --cache /tmp/naura-npm-cache
npm run dev            # http://localhost:5173 (Vite, auto-opens)
npm run build          # production build to web/dist
npm run preview        # serve the build
```

Node 22, npm 10. Needs **internet** at runtime: Google Fonts, Unsplash photos,
react-globe.gl Earth textures (unpkg), and EOX Sentinel-2 tiles.

---

## 4. Tech stack (`web/`)

- **Vite + React 18** (no TS, plain JSX).
- **framer-motion** — entrance / scroll / presence animations.
- **react-globe.gl** (+ three.js) — interactive 3D Earth selector.
- **leaflet** + **leaflet-side-by-side** — real satellite before/after swipe.
- No state library — local `useState` in `App.jsx`, props down. Fine at this size.

Bundle is ~2.9 MB (three.js). Acceptable for hackathon; code-split later
(`manualChunks` for three / globe) if it matters.

---

## 5. File map (`web/src/`)

```
main.jsx              React root
App.jsx               State owner + page composition + fund/check logic
data.js               FORESTS data + helpers (impactOf, projIntensity, scene, photoFor)
styles.css            All styles (design tokens at top). No CSS modules.
Icons.jsx             Inline Lucide-style SVG icons (make() factory)
components/
  Header.jsx          Floating glass nav pill (scroll-aware)
  Hero.jsx            Full-bleed photo hero
  HowItWorks.jsx      3 steps (set aside → satellites watch → growth pays)
  ForestGallery.jsx   12 photo cards, "You support this" badge
  GlobeSelector.jsx   3D globe, click marker OR any land
  FundingPanel.jsx    The core: numbered donor flow + satellite + projection
  SatelliteCompare.jsx Leaflet swipe (EOX Sentinel-2) + restored projection overlay
  Trust.jsx           Trust trio + footer
```

---

## 6. Design system (source of truth = top of `styles.css`)

Direction: **glassmorphic, PATANI-inspired**, full-bleed forest photography,
warm nature palette, large readable type. Accessible (WCAG AA+).

- **Colors:** forest greens `#06281F → #10B981`, **lime accent `#A3E635 / #B6F36B`**,
  cream/sand surfaces, gold `#B45309`. Tokens: `--green-*`, `--lime-*`, `--glass*`.
- **Fonts:** **Sora** (display, geometric) + **Lexend** (body, reading-tuned).
- **Glass:** `--glass`, `--glass-border`, `--glass-blur` (backdrop-filter).
- **Radius/shadow/pill** tokens defined. Reuse tokens, never raw hex in components.
- **Accessibility baked in:** 18px base, 44px+ targets, lime focus rings,
  `prefers-reduced-motion` block, `aria-pressed`/`aria-live`, skip link, scrims
  for text-on-photo contrast. Nav `z-index:1500` (above Leaflet panes).

⚠️ Lime on white fails small-text AA — only use lime on dark bg or large/bold text.

---

## 7. Data model (`data.js`)

`FORESTS` = 12 sites worldwide. Each:

```js
{ id, name, place, flag, lat, lng,
  health, target,        // 0–100 "forest health" (NDVI in plain words)
  setAside, paid,        // ETH escrow numbers
  hue, photo, story }
```

Helpers:
- `goalProgress(f)` → % of goal reached.
- `impactOf(amount, f)` → `{ trees, hectares, points, projHealth }` — **everything the donor sees scales from ETH** (~120 trees & ~0.8 ha per ETH; ~1.5 health pts/ETH capped to target).
- `projIntensity(amount)` → 0.25→1, drives green strength of the projection.
- `photoFor(f, w)` → Unsplash URL at width.

**Maremma is tuned** to coords `42.92, 10.92` (Colline Metallifere ex-mining) —
real Sentinel-2 shows brown 2017 → green 2024. Other 11 use representative
regional coords (change can be subtle). To hero more sites, inspect real tiles
(see §9) and adjust lat/lng/zoom.

---

## 8. The donor flow (FundingPanel) — current UX

Left = satellite. Right = numbered steps:

1. **Step 1 · Choose your gift** — ETH slider + chips. Live helper: trees/hectares.
2. **Step 2 · Preview the growth your gift creates** — toggles the **projection-only**
   restored view on the map; live text: from `health` to `projHealth`, trees, ha.
3. **Step 3 · Pledge {amount} ETH** — records support in `App.supported`.
4. **Step 4 · Verify growth from space** — **appears only after pledging** (order is
   intentional/clear). Simulates a satellite check: health +2, releases 1.5 ETH,
   shows `+N` delta chip and updates the gallery badge.

`App.supported` = `{ forestId: { given, healthAtJoin } }`. "Gained" = current
health − healthAtJoin → shown as `+N`.

All check/pledge logic is **simulated** in `App.jsx` (`onFund`, `onCheck` with
`setTimeout`). No real chain calls yet.

---

## 9. Satellite imagery (SatelliteCompare)

- Source: **EOX `s2cloudless`** yearly mosaics — real Sentinel-2, ~10m, **free, no API key**.
  URL: `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-{YEAR}_3857/default/g/{z}/{y}/{x}.jpg`
  Years confirmed working: 2016–2024, up to z14. Currently **2017 vs 2024**.
- Leaflet side-by-side swipe; `ResizeObserver` + `invalidateSize` fixes the
  stretched-grid empty-strip bug; `tileerror` retries the tile 3×.
- **Projection overlay** (`.sat-projection`): `backdrop-filter` saturate+hue-rotate
  on the real imagery + `mix-blend-mode:multiply` green canopy dots. It's a
  **simulation / artist's impression**, labelled as such — not an AI prediction.

Inspect tiles for a candidate before changing coords:
```bash
# compute tile x/y from lat/lng/z, curl 2017 & 2024 jpgs, open them to eyeball change
```
(Script used during dev lived at `/tmp/tiles.mjs` — recreate as needed.)

---

## 10. Known gaps / cleanups

- [ ] `app/` legacy still references dead `file://` image paths from another machine — irrelevant if we drop it.
- [ ] framer-motion height-animations don't auto-respect reduced-motion (CSS block covers the rest).
- [ ] Bundle not code-split.
- [ ] Custom map-click ("protect a new area") has no Step 2 preview / stats — minimal by design; flesh out if kept.
- [ ] No wallet, no real chain, no backend wiring (all simulated).
- [ ] No mobile hamburger menu (nav links hidden < 900px — add a drawer).
- [ ] No tests.

---

## 11. NEXT: Landing page

Goal: a marketing landing (the funnel **before** the app). Could be built as a
no-code site (Webflow / Framer / "sitelab") **or** as a React route in `web/`
(`react-router`, `/` = landing, `/app` = current tool). Recommendation: keep one
codebase — add the landing as the top sections, "Start planting" scrolls/links
into the tool. Reuse the existing design tokens & components.

### Sections to include (in order)

1. **Hero** (reuse `Hero.jsx` look) — full-bleed aerial forest, glass nav, big
   Sora headline, lime CTA "Start planting" + ghost "How it works". One line of
   proof: *"Funded by results, verified from space."*
2. **The problem** — short: traditional carbon/reforestation funding is unverifiable,
   audits are corruptible, donors can't see impact. 2–3 stat cards.
3. **How NAura works** (reuse `HowItWorks.jsx`) — 3 steps. Add a 4th visual:
   the satellite before/after swipe as a teaser.
4. **Live proof / globe** — embed the 3D globe with the 12 sites; "Explore the map".
5. **Featured forests** — reuse `ForestGallery.jsx` (maybe 3–6 highlighted).
6. **Why it's trustworthy** (reuse `Trust.jsx`) — satellites, open proof, direct
   payment. Add: "Powered by Sentinel-2, Solana escrow, zk-private funding."
7. **Impact numbers** — counters: total ETH set aside, ETH released, hectares,
   trees, sites, countries. (Animate on scroll.)
8. **For donors / For NGOs** — two-column value props (account abstraction: NGOs
   need no seed phrase; donors can give privately via Privacy Pools).
9. **The technology** — brief, credible: AI swarm (Observer/Auditor/Treasurer),
   NDVI, Solana Devnet, zk-privacy. Logos/badges.
10. **FAQ** — accordion: "How do you know trees really grew?", "What is NDVI?",
    "Where does my money go?", "What's ETH / do I need crypto?", "Can I stay
    anonymous?", "What if a forest fails?".
11. **Final CTA** — "Fund a forest you can watch grow." → into the app.
12. **Footer** — links, socials, the Sentinel-2 / Solana credits, legal.

### Copy guidelines
- Plain language, short sentences. Avoid jargon (NDVI → "forest health",
  escrow → "set aside", zk → "private giving"). Keep the **"proof first, payment
  second"** spine.
- Tone: honest, warm, confident — not greenwashing. Always pair claims with how
  they're verified.

### Assets needed for the landing
- High-res aerial forest hero photo (licensed — currently Unsplash hotlinks;
  **replace with owned/licensed assets for production**).
- Real before/after satellite stills for 2–3 hero sites (can screenshot EOX).
- Logos: Sentinel-2 / ESA, Solana, Privacy Pools, partner NGOs/DAOs.
- Brand: finalize a real **logo** (current is a Lucide leaf in a lime square),
  favicon, OG/social share image, brand guidelines one-pager.
- Short explainer video / Lottie of the swarm flow (optional, high impact).

---

## 12. NEXT: Product / engineering

Priority order to make it real beyond the demo:

1. **Routing & landing** (above).
2. **Wallet connect** — wagmi/viem or Solana wallet-adapter; replace the
   "Demo Wallet" notion. Show connected address.
3. **Real backend wiring** — connect `web/` to `backend/agent_swarm.py`
   (WebSocket on :8000). Stream real swarm logs into the app; replace simulated
   `onCheck` with a real scan request + NDVI result.
4. **Real escrow** — call the Anchor program (`anchor/programs/naura-escrow`)
   for deposit/release; derive the NGO PDA from project id. Read real on-chain
   `setAside` / `paid`.
5. **zk-private funding** — surface the Privacy Pools v2 flow from the legacy
   console (derive keys → deposit → private transfer) as an optional "give
   privately" path in Step 1/3.
6. **Persist supported state** — localStorage now; backend/account later.
7. **Real per-site satellite framing** — curate coords/zoom and a documented
   before/after year per forest; store `satBefore`/`satAfter`/`zoom` per forest
   in `FORESTS`.
8. **Mobile nav drawer**, code-splitting, tests, error/empty/loading states for
   tiles & globe (offline fallback messaging).
9. **i18n** — the user works in Italian; consider EN/IT toggle.

---

## 13. Conventions

- Commits: Conventional Commits, scope `web`. (User handles commits & push.)
- Caveman mode is on in chat — irrelevant to code; code/comments stay normal English.
- Keep components small, tokens-driven, accessible by default. Match existing
  style: inline SVG icons via `Icons.jsx`, no emoji as icons, 44px+ targets.

---

## 14. Quick context for a fresh session

> NAura = pay-on-proof reforestation funding. The React app in `web/` lets a
> donor pick a forest (gallery or 3D globe), choose an ETH amount (everything
> scales from it), preview the projected restored land, pledge, then verify real
> growth via Sentinel-2 satellite imagery. Glassmorphic, accessible, 12 sites.
> All chain/backend calls are currently simulated in `App.jsx`. Next: marketing
> landing page + wallet + real backend/escrow wiring.
