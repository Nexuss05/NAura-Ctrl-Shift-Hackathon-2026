# NAura — Proof-of-Impact Agent Swarm Console

**NAura** is a verified climate finance protocol where payments are automatically unlocked onchain by verified physical evidence in the real world. 

Instead of relying on corruptible human audits or tedious manual reports, NAura uses a multi-agent AI swarm (Observer, Auditor, and Treasurer) to analyze Sentinel-2 satellite imagery, compute ecological indexes (NDVI), and trigger smart contract releases on Solana Devnet.

---

## ✅ Live on-chain right now (Ethereum Sepolia)

> The escrow + Privacy Pools below are **deployed and verified on Sepolia**. The AI-swarm / Solana narrative
> is the broader product vision; the **working on-chain implementation shipped in this branch
> (`qiang/evm-escrow`) is EVM / Sepolia.**

- **Naura escrow:** [`0xAB31…84d0`](https://sepolia.etherscan.io/address/0xAB313b7dF91Fad2C169c5D592a7c1c45CD4c84d0) — Solidity, **14/14 tests**, full create→fund→release run on-chain (`evm/`).
- **0xbow Privacy Pools, self-deployed:** Entrypoint [`0xC02b…c8CB`](https://sepolia.etherscan.io/address/0xC02b4350223dB390F87DbeCa86b823fE6dBBc8CB) · ETH Pool [`0xECe9…21E4`](https://sepolia.etherscan.io/address/0xECe9272a220237D2426Fd3494585DBa2368421E4) · **real shielded deposit** ([tx](https://sepolia.etherscan.io/tx/0x7d81ceca0e6632c86bd542361f97122bbe7704ef1e6d4d7ac5d4cb118903bdde)) (`evm/privacy-pools/`).
- **Live frontend:** https://naura.pages.dev (Cloudflare Pages).
- **Status:** escrow ✅ · Privacy Pools deploy ✅ · shielded deposit ✅ · shielded withdrawal ⛔ (blocked on an SDK circuit-version integrity pin — see `evm/privacy-pools/README.md`).

---

## 🌟 Key Features

1. **AI Swarm Consensus Protocol**:
   * **Observer Agent (GPT-4o Vision)**: Scans satellite coordinates and computes average vegetative index (NDVI).
   * **Auditor Agent (Adversarial Auditor)**: Challenges claims, composite cloud covers, and issues cryptographic verification verdicts.
   * **Treasurer Agent (Transaction Signer)**: Formulates, signs, and broadcasts conditional transactions to release locked escrow funds.
2. **Account Abstraction for NGOs**:
   * The receiving wallet is a Program Derived Address (PDA) derived from the project coordinate/ID on Solana. Receiving NGOs don't need to manage seed phrases or private keys — the contract releases funds directly when impact is proven.
3. **zk-Privacy Funding Layer (0xbow Privacy Pools)**:
   * Integrates **0xbow Privacy Pools** via the public, audited `@0xbow/privacy-pools-core-sdk`. We **self-deployed the full Privacy Pools stack to Sepolia** and made a **real shielded deposit** on-chain; anonymous donors fund climate projects privately (deposit → shielded note → withdraw to the escrow). Code, deployed addresses and a reproduction guide are in **`evm/privacy-pools/`**.
4. **Interactive 3D Globe Dashboard**:
   * Rich HUD showing active project statistics, real-time transaction explorers, Sentinel-2 before/after vegetation sliders, and a scrolling typewriter terminal printing swarm logs.

---

## 📂 Project Architecture

The codebase is split into modular components:

```text
├── web/                        # ⭐ PRIMARY FRONTEND — React donation TOOL (Vite)
│   ├── src/
│   │   ├── App.jsx             # State owner + tool composition + backend wiring
│   │   ├── lib/bridge.js       # REST client for the EVM bridge (:3001)
│   │   ├── hooks/useSwarm.js   # WebSocket client for the swarm (:8000)
│   │   └── components/         # Header (logo+wallet), Globe, FundingPanel, SwarmConsole…
│   ├── .env.example            # VITE_BRIDGE_URL / VITE_SWARM_URL
│   └── HANDOFF.md              # Full frontend + integration handoff (read this)
├── sitelab_landing.html        # Marketing LANDING (built on SiteLab; separate from the tool)
├── index.html / model.js / view.js / viewmodel.js / styles.css  # Legacy MVVM console (kept)
├── WALLETS_SETUP.md            # Detailed EVM / Solana setup tutorial guide
├── anchor/                     # Solana Anchor contract folder
│   ├── programs/naura-escrow/  # Rust source code (initialize, deposit, release_funds)
│   └── Anchor.toml             # Anchor configuration settings
├── pp-bridge/                  # Node.js Express ZK Privacy Pool payment bridge (:3001)
│   ├── server.js               # Express API endpoints & 0xBow SDK integration
│   ├── secretDerivationPayload.js # EIP-712 typed key derivation signature configuration
│   ├── .env                    # Sepolia private RPC & testnet wallet variables
│   └── package.json            # Node dependencies (viem, express, 0xbow-sdk)
└── backend/                    # Python Swarm Agent services (:8000)
    ├── requirements.txt        # Backend dependencies
    ├── ndvi_calculator.py      # Sentinel-2 B4/B8 band NDVI raster math (rasterio)
    ├── treasurer_agent.py      # Solana Devnet transaction signer & client
    ├── agent_swarm.py          # FastAPI/WebSocket orchestrator (port 8000)
    └── generate_sample_tiles.py# Utility to generate mock Sentinel-2 TIFF data
```

> **Two frontends:** the **landing page** is built on **SiteLab** (required for
> the hackathon) and the React app in **`web/`** is the **tool** the landing's
> "Start planting" links into. The root `index.html` MVVM console is legacy.
> All current frontend work happens in `web/` — see [`web/HANDOFF.md`](web/HANDOFF.md).

---

## 🚀 Getting Started & How to Run

The primary frontend is the **React tool in `web/`**. It works **with or without**
the backends: when the bridge/swarm are unreachable it falls back to a built-in
**simulated** flow, so you can run only `web/` for UI work.

### Quick start — Tool only (zero backend, simulated)

```bash
cd web
npm install            # if cache errors: npm install --cache /tmp/naura-npm-cache
npm run dev            # → http://localhost:5173
```
* Pick a forest (globe or quick list) → choose an ETH amount → toggle **Give
  privately** (Privacy Pools) → **Pledge** → **Verify growth from space**.
* With no backends running, pledges and the satellite scan run as a local
  simulation (typewriter swarm logs, NDVI, escrow release).

### Full stack — Live (EVM bridge + AI swarm)

Run three processes (three terminals). Configure endpoints once:
```bash
cd web && cp .env.example .env   # VITE_BRIDGE_URL / VITE_SWARM_URL (defaults are fine locally)
```

**1) EVM Privacy-Pools bridge — `localhost:3001`**
```bash
cd pp-bridge
npm install                      # needs a GitHub token for the private @0xbow-io SDK
npm run dev                      # real attempt
# …or run simulated (no SDK / no keys):
FORCE_SIMULATION=true node server.js
```
*Wallets, faucet funding, Sepolia RPC and ZK/direct-deposit config: see [WALLETS_SETUP.md](WALLETS_SETUP.md).*

**2) Solana AI swarm — `localhost:8000`**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt          # full (rasterio needs GDAL; solana)
# …or the light/simulated set (enough to run the swarm):
pip install fastapi "uvicorn[standard]" websockets base58 numpy

python backend/generate_sample_tiles.py          # optional: mock Sentinel-2 TIFFs in backend/data/
python backend/agent_swarm.py
```

**3) Frontend — `localhost:5173`**
```bash
cd web && npm run dev
```
The tool auto-detects the running bridge/swarm (`mode: "real"` in responses).
**Pledge** routes through the bridge (private = deposit + ZK transfer; public =
direct deposit). **Verify growth from space** triggers the real swarm: NDVI
computation, a Solana devnet release, and live logs streamed into the in-app
console.

Stop everything: `lsof -tiTCP:3001,8000,5173 | xargs kill`

> Full frontend + integration details (architecture, contracts, real-vs-simulated
> matrix): **[`web/HANDOFF.md`](web/HANDOFF.md)**.

### Real vs Simulated (summary)

| | Real | Simulated (default) |
|---|---|---|
| Bridge SDK / keys | `@0xbow-io` SDK + `pp-bridge/.env` keys, `FORCE_SIMULATION=false` | SDK/keys absent → mocked txs & balances |
| NDVI | `rasterio` on real Sentinel-2 tiles | numpy synthetic NDVI |
| Solana release | real devnet transfer (explorable sig) | mocked signature `5uVq…` |
| Frontend | bridge/WS reachable → real calls | backends down → local simulation |

### Legacy console (optional)

The original MVVM dashboard still works standalone: open the root `index.html`
in a browser for a fully client-side simulated demo (globe, swarm log, PP widget).

---

## 🛠️ Solana Anchor Program Setup

To build the Rust contract program:

1. **Install Rust, Solana CLI & Anchor CLI (Isolated Local Setup)**:
   Run the following commands in the project root to install everything inside `.rustup`, `.cargo`, `.avm`, and `.solana` folders (easily deletable once the hackathon is over):
   
   ```bash
   # 1. Define local directories
   export RUSTUP_HOME="$(pwd)/.rustup"
   export CARGO_HOME="$(pwd)/.cargo"
   export AVM_HOME="$(pwd)/.avm"

   # 2. Install Rust locally (without modifying global PATH)
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
   source "$CARGO_HOME/env"

   # 3. Download and unpack Solana CLI locally
   if [ "$(uname -m)" = "arm64" ]; then
     curl -sSfL https://release.anza.xyz/stable/solana-release-aarch64-apple-darwin.tar.bz2 -o solana.tar.bz2
   else
     curl -sSfL https://release.anza.xyz/stable/solana-release-x86_64-apple-darwin.tar.bz2 -o solana.tar.bz2
   fi
   mkdir -p .solana
   tar -jxf solana.tar.bz2 -C .solana --strip-components 1
   rm solana.tar.bz2

   # 4. Set current terminal session PATH
   export PATH="$(pwd)/.cargo/bin:$(pwd)/.solana/bin:$(pwd)/.avm/bin:$PATH"

   # 5. Install AVM and Anchor CLI locally
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   avm install latest
   avm use latest
   ```
   
   *Note: Every time you open a new terminal window to build or deploy, run this command to restore paths:*
   ```bash
   export RUSTUP_HOME="$(pwd)/.rustup"
   export CARGO_HOME="$(pwd)/.cargo"
   export AVM_HOME="$(pwd)/.avm"
   source "$CARGO_HOME/env"
   export PATH="$(pwd)/.cargo/bin:$(pwd)/.solana/bin:$(pwd)/.avm/bin:$PATH"
   ```

2. Inside `/anchor` directory:
   ```bash
   anchor build
   ```
3. Deploy to devnet/localnet:
   ```bash
   anchor deploy
   ```
