# NAura — Proof-of-Impact Agent Swarm Console

**NAura** is a verified climate finance protocol where payments are automatically unlocked onchain by verified physical evidence in the real world. 

Instead of relying on corruptible human audits or tedious manual reports, NAura uses a multi-agent AI swarm (Observer, Auditor, and Treasurer) to analyze Sentinel-2 satellite imagery, compute ecological indexes (NDVI), and trigger smart contract releases on Solana Devnet.

---

## 🌟 Key Features

1. **AI Swarm Consensus Protocol**:
   * **Observer Agent (GPT-4o Vision)**: Scans satellite coordinates and computes average vegetative index (NDVI).
   * **Auditor Agent (Adversarial Auditor)**: Challenges claims, composite cloud covers, and issues cryptographic verification verdicts.
   * **Treasurer Agent (Transaction Signer)**: Formulates, signs, and broadcasts conditional transactions to release locked escrow funds.
2. **Account Abstraction for NGOs**:
   * The receiving wallet is a Program Derived Address (PDA) derived from the project coordinate/ID on Solana. Receiving NGOs don't need to manage seed phrases or private keys — the contract releases funds directly when impact is proven.
3. **zk-Privacy Funding Layer (Privacy Pools v2)**:
   * Integrates the `@privacy-pools-v2/sdk` protocol framework to allow anonymous donors to fund climate projects. Donors deposit ETH into Sepolia privacy pools, derive secret keys via EIP-712 signatures, and send private ZK transfers to project escrows without revealing their identity.
4. **Interactive 3D Globe Dashboard**:
   * Rich HUD showing active project statistics, real-time transaction explorers, Sentinel-2 before/after vegetation sliders, and a scrolling typewriter terminal printing swarm logs.

---

## 📂 Project Architecture

The codebase is split into modular components:

```text
├── index.html                  # Main dashboard layout
├── styles.css                  # Custom glassmorphic styles
├── model.js                    # [MVVM Model] Application data structures & state
├── viewmodel.js                # [MVVM ViewModel] UI commands, WS connections
├── view.js                     # [MVVM View] DOM listeners, slide sliders & Globe.gl
├── anchor/                     # Solana Anchor contract folder
│   ├── programs/naura-escrow/  # Rust source code (initialize, deposit, release_funds)
│   └── Anchor.toml             # Anchor configuration settings
└── backend/                    # Python Swarm Agent services
    ├── requirements.txt        # Backend dependencies
    ├── ndvi_calculator.py      # Sentinel-2 B4/B8 band NDVI raster math (rasterio)
    ├── treasurer_agent.py      # Solana Devnet transaction signer & client
    ├── agent_swarm.py          # FastAPI/WebSocket orchestrator (port 8000)
    └── generate_sample_tiles.py# Utility to generate mock Sentinel-2 TIFF data
```

---

## 🚀 Getting Started & How to Run

You can run NAura in two modes: **Standalone Sim** (zero-setup) or **Live Swarm** (connected Python backend).

### Option A: Standalone Sim Mode (Fastest)

No server installation required. Double-click the [index.html](file:///Users/matteocotena/Documents/Hackathon%20CTRL:SHIFT/Github/NAura-Backend/index.html) file directly to launch the console in your web browser. 

* The application will run entirely client-side.
* Clicking **Run Swarm Scan** will execute a simulated typewriter log of the Observer/Auditor/Treasurer consensus, updating the project NDVI, sliding the satellite image, and broadcasting simulated transactions.
* The Privacy Pools v2 widget allows simulating EIP-712 signatures, deposits, and relay transfers with visual log states.

---

### Option B: Live Swarm Mode (Python WebSockets Server)

To run the real Python agent swarm, raster calculations, and real Solana devnet transaction signing:

1. **Setup Python Virtual Environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r backend/requirements.txt
   ```

2. **Generate Test Satellite Rasters**:
   Run the utility script to generate mock RED and NIR Sentinel-2 spectral TIFF files in `backend/data/` for local NDVI parser testing:
   ```bash
   python backend/generate_sample_tiles.py
   ```

3. **Start the Swarm Orchestrator**:
   Launch the WebSockets server on `localhost:8000`:
   ```bash
   python backend/agent_swarm.py
   ```

4. **Launch Dashboard**:
   Open [index.html](file:///Users/matteocotena/Documents/Hackathon%20CTRL-SHIFT/Github/NAura-Backend/index.html) in your browser. 
   * The dashboard will detect the running WebSocket server and connect automatically.
   * Clicking **Run Swarm Scan** will now trigger the real Python swarm: downloading TIFF data, running `rasterio` NDVI calculations, requesting devnet SOL fee airdrops, signing and broadcasting real transactions to Solana Devnet, and streaming live logs back to the frontend.

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
