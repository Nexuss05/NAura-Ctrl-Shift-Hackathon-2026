# NAura — Frontend & Integration Handoff

_Last updated: 2026-06-14 · Branch: `feature/accessible-ui`_

Read top to bottom before touching code. This reflects the current state:
the React app in `web/` is now the **donation tool** (not a marketing site),
wired to the two local backends (EVM Privacy-Pools bridge + Solana AI swarm),
with a graceful **simulated** fallback when those backends aren't running.

---

## 1. What NAura is

**NAura** = pay-on-proof climate-finance protocol. Donors fund forest
restoration; money is held in escrow and **released only when satellite
imagery proves the trees grew** (NDVI / AI swarm: Observer → Auditor →
Treasurer, on Solana Devnet). Private giving is available via Privacy Pools v2
on Ethereum Sepolia.

Tagline: **"Proof you can see."** · _"Funded by results, verified from space."_

---

## 2. Repo layout

| Path | What | Status |
|------|------|--------|
| `index.html`, `model.js`, `view.js`, `viewmodel.js`, `styles.css` (root) | Legacy MVVM "agent swarm console" (globe.gl). | Legacy demo. Leave as-is. |
| `app/` | First accessible rewrite, vanilla HTML/CSS/JS. | Superseded by `web/`. No-build fallback. |
| **`web/`** | **Current React app — the donation TOOL. All new FE work here.** | Active. |
| `pp-bridge/` | Node EVM bridge — Privacy Pools v2, Sepolia. REST on `:3001`. | Wired to `web/`. |
| `backend/` | Python FastAPI swarm — NDVI, Solana Treasurer. WebSocket on `:8000`. | Wired to `web/`. |
| `anchor/` | Solana Anchor escrow program (Rust). | Not wired. |
| `sitelab_landing.html` | Marketing **landing**, built on SiteLab (separate). | Separate from the tool. |

> The **landing page** lives on SiteLab (AI builder; required for the hackathon).
> The React app in `web/` is the **tool** the landing's "Start planting" links to.
> They are deliberately separate codebases.

---

## 3. Running everything

Three processes. The tool works **with or without** the backends (simulated
fallback), so you can run only `web/` for UI work.

### Frontend (always)
```bash
cd web
npm install            # if cache errors: add  --cache /tmp/naura-npm-cache
npm run dev            # http://localhost:5173
npm run build          # production build to web/dist (git-ignored)
```
Endpoints are configurable — copy `.env.example` → `.env`:
```
VITE_BRIDGE_URL=http://localhost:3001
VITE_SWARM_URL=ws://localhost:8000/events
```

### EVM Privacy-Pools bridge (`:3001`)
```bash
cd pp-bridge
npm install            # needs a GitHub token for @0xbow-io SDK (private pkg)
npm run dev            # node --watch server.js
# Simulated run (no SDK / no keys):
FORCE_SIMULATION=true node server.js
```

### Solana AI swarm (`:8000`)
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt        # full (needs GDAL for rasterio, solana)
# Light/simulated set (enough to run the swarm):
pip install fastapi "uvicorn[standard]" websockets base58 numpy
python backend/agent_swarm.py
```

Stop all: `lsof -tiTCP:3001,8000,5173 | xargs kill`

---

## 4. Tech stack (`web/`)

- **Vite + React 18** (no TS, plain JSX).
- **framer-motion** — entrance / presence animations.
- **react-globe.gl** (+ three.js) — interactive 3D Earth selector.
- **leaflet** + **leaflet-side-by-side** — real Sentinel-2 before/after swipe.
- No state library — `useState` in `App.jsx`, props down. Fine at this size.
- Wallet: native **EIP-1193** (`window.ethereum`); no wagmi yet.

Bundle ~2.9 MB (three.js). Code-split later if it matters.

---

## 5. File map (`web/src/`)

```
main.jsx              React root
App.jsx               State owner + tool composition + fund/check + backend wiring
data.js               FORESTS (12 sites) + helpers (impactOf, projIntensity, photoFor)
styles.css            All styles (design tokens at top). No CSS modules.
Icons.jsx             Inline Lucide-style SVG icons (make() factory)
lib/
  bridge.js           REST client for pp-bridge (:3001) + bridgeReachable()
hooks/
  useSwarm.js         WebSocket client for the swarm (:8000/events)
components/
  Header.jsx          Floating glass topbar: logo (left) + wallet connect (right)
  GlobeSelector.jsx   3D globe, click a marker OR any land
  ForestGallery.jsx   Photo cards (supports `bare` = grid only, for the toggle)
  FundingPanel.jsx    Core donor flow: gift → privacy → preview → pledge → verify
  SwarmConsole.jsx    Live terminal for swarm logs / NDVI during a scan
  SatelliteCompare.jsx Leaflet swipe (EOX Sentinel-2) + restored projection overlay
```
Unused-but-kept (landing lives on SiteLab now): `Hero.jsx`, `HowItWorks.jsx`,
`Trust.jsx`. Safe to delete.

---

## 6. Design system (source of truth = top of `styles.css`)

Glassmorphic, full-bleed forest photography, warm nature palette, large
readable type, WCAG AA+.

- **Colors:** forest greens `#06281F → #10B981`, **lime `#A3E635 / #B6F36B`**,
  cream/sand surfaces. Tokens: `--green-*`, `--lime-*`, `--glass*`. Page bg
  `--surface:#F4F8F3`.
- **Fonts:** **Sora** (display) + **Lexend** (body).
- **Glass:** `--glass`, `--glass-border`, `--glass-blur` (backdrop-filter).
- **Topbar contrast is dynamic:** `Header.jsx` samples the background under the
  bar (`elementFromPoint` → luminance) and toggles `behind-light` / `behind-dark`
  so logo + wallet text always contrast. Dark-bg fallback brightens the logo.
- ⚠️ Lime on white fails small-text AA — lime only on dark or large/bold text.

---

## 7. The tool UX (`App.jsx` + `FundingPanel.jsx`)

Tool-only flow, low-scroll:

1. **Selector** — a `Map / Quick list` segmented toggle shows **one** of:
   the 3D globe (`GlobeSelector`) or the forest cards (`ForestGallery bare`).
2. Selecting a forest/marker/custom point sets `chosen` → the **funding panel
   reveals** (animated) and auto-scrolls to it.
3. **FundingPanel** (no "Step N" labels):
   - **Choose your gift** — ETH slider + chips, live trees/hectares.
   - **Give privately** — toggle for the Privacy-Pools layer (`privacy` state,
     lifted to `App`). When on, pledge says "…privately".
   - **Preview the growth** — toggles the projection overlay on the map.
   - **Pledge {amount} ETH** — see §8.
   - **Verify growth from space** — appears after pledging; runs the swarm (§9),
     streaming into `SwarmConsole`.

`App.supported` = `{ forestId: { given, healthAtJoin } }` → drives "+N" gained.

---

## 8. Funding flow → EVM bridge (`onFund`)

`App.onFund` is **real-first, simulated-fallback**:

1. `bridgeReachable()` probes `GET /api/pp/status`.
2. If reachable:
   - **Private** (`privacy` on): `ensureSession()` → `deriveKeys(address)` +
     `createSession` (once), then `deposit(amount)` (shield) + `transfer(amount)`
     (private transfer to escrow).
   - **Public**: `publicDeposit(amount)` (donor → escrow directly).
3. If unreachable or any call throws → log a warning, continue with local state.
4. Local state (`forests[].setAside`, `supported`) updates regardless, so the UI
   is always consistent.

Bridge REST (`lib/bridge.js`): `status`, `deriveKeys`, `createSession`,
`deposit`, `publicDeposit`, `discoverNotes`, `transfer`, `bridgeBalance`.

---

## 9. Verification flow → Solana swarm (`onCheck`)

`App.onCheck` → `swarm.runScan(forest.id)` over WebSocket. The Python server
streams (handled in `hooks/useSwarm.js`):

- `scan_status` → drives the console status pill.
- `log` (`observer|auditor|treasurer|system`) → appended to `SwarmConsole`.
- `ndvi_update` → shown in the console footer.
- `tx_release` → `onRelease` applies `escrowDelta` / `releasedDelta` to the
  forest, bumps health +2 toward target, shows the txHash, clears `busy`.

If the WS can't connect, `onCheck` falls back to the previous **simulated**
multi-step check. `projectId` sent = `forest.id` (e.g. `maremma`); the swarm
defaults to a 6.00 release for unknown ids.

---

## 10. Real vs Simulated — what differs

Both backends ship a **simulated mode** so the demo always works. The mode is
reported in API responses (`mode: "real" | "simulated"`) and bridge startup logs.

| Concern | Real mode | Simulated mode (current default) |
|---|---|---|
| **EVM bridge SDK** | `@0xbow-io/privacy-pools-v2-sdk` installed (needs a GitHub Packages token). | SDK absent → `SDK_AVAILABLE=false`. Endpoints return fake but well-formed data. |
| **EVM keys / chain** | `DONOR_PRIVATE_KEY` + `ESCROW_PRIVATE_KEY` in `pp-bridge/.env`; real Sepolia balances + on-chain txs. | No keys → mocked addresses/balances, fake txHashes. |
| **`FORCE_SIMULATION`** | set `false` to attempt real flows. | defaults **true** (0xBow IPFS artifacts often unpinned). |
| **NDVI** | `rasterio` reads real Sentinel-2 `.tif` in `backend/data/`. | no tif/rasterio → numpy synthetic NDVI (analytic). |
| **Solana release** | `solana`/`solders` libs + devnet keypair → real devnet transfer, explorable signature. | libs absent → Solana CLI attempt, else **mocked signature** `5uVq…`. |
| **Frontend** | same code; bridge/WS reachable → `mode: "real"`. | bridge/WS down → local simulation in `App.jsx`. |

To go real: provide the npm token for `@0xbow`, fill `pp-bridge/.env`, set
`FORCE_SIMULATION=false`, `pip install rasterio solana` (+ GDAL), drop Sentinel
tiles in `backend/data/`, and a devnet keypair at `~/.config/solana/id.json`.

---

## 11. Backend contracts (reference)

**Bridge REST (`:3001`)** — see §8. JSON in/out; CORS enabled.

**Swarm WS (`ws://localhost:8000/events`)**
- Out: `{ "action": "run_scan", "projectId": "<id>" }`
- In: `{type:"log", tag, message}` · `{type:"ndvi_update", projectId, ndvi}` ·
  `{type:"scan_status", status}` · `{type:"tx_release", projectId, escrowDelta,
  releasedDelta, txHash}`

Verify backends:
```bash
node --check pp-bridge/server.js
python -m py_compile backend/agent_swarm.py
curl -s http://localhost:3001/api/pp/status
```

---

## 12. Backend fixes applied (while wiring the live flow)

- `backend/ndvi_calculator.py` — `_simulate_ndvi_math` never returned its value
  (`None` crashed the scan in simulated mode). Added `return mean_ndvi`.
- `backend/treasurer_agent.py` — the no-Solana fallback didn't define stub names
  (`Keypair`, `Client`, …) and `__init__` called `Client(None)`. Added stubs +
  a `SOLANA_LIB_AVAILABLE` guard so it runs simulated.

---

## 13. Wallet (Header)

- `Connect wallet` → `window.ethereum.request({ method: "eth_requestAccounts" })`.
  No extension → opens the MetaMask download page.
- Shows short address + lime dot when connected; listens to `accountsChanged`;
  restores authorized accounts via `eth_accounts` on load.
- The address is lifted to `App` (`onAccount`) and used by `bridge.deriveKeys`.
- **Not yet:** EIP-712 signature-based key derivation (the manual references
  `/api/pp/derive-keys-sig`, which the bridge doesn't implement — current bridge
  derives from `{ address }` via `/api/pp/derive-keys`). Multi-wallet/WalletConnect
  would need wagmi/RainbowKit.

---

## 14. Known gaps / next

- [ ] Real-mode credentials (0xBow token, EVM keys, Solana keypair, Sentinel tiles).
- [ ] EIP-712 derive-keys signature path (add `/api/pp/derive-keys-sig` in bridge).
- [ ] Persist `supported` + wallet (localStorage / account).
- [ ] Map our 12 forest ids to swarm-special projectIds (only kenya/amazon have
      custom deltas server-side; ours fall back to the 6.00 default).
- [ ] Bundle code-split (three/globe), mobile polish, tests, i18n (EN/IT).
- [ ] `dist/` untracked now (was committed before `.gitignore`).

---

## 15. Conventions

- Commits: Conventional Commits. User handles commits & push.
- Caveman mode is on in chat — irrelevant to code; code/comments stay normal English.
- Keep components small, tokens-driven, accessible by default. Inline SVG icons
  via `Icons.jsx`, no emoji as icons, 44px+ targets.
