# Naura — Pay-on-Proof Reforestation Funding

**Naura** is a climate-funding protocol where donations are held in an on-chain escrow and
released to a reforestation organization **only when forest growth is verified** (an NDVI
satellite threshold). Donors can also give **privately** through 0xbow Privacy Pools.

Releases are **user-controlled** — the project authority verifies growth and triggers the
release. There is **no AI and no oracle in the loop**: the donor/authority stays in control,
and every step is publicly auditable on-chain.

Built on **Ethereum (Sepolia testnet)**.

- 🌐 Live app: https://naura.pages.dev
- ⛓️ Network: Sepolia (chainId `11155111`) · explorer https://sepolia.etherscan.io

---

## ✅ Live on-chain right now

- **Naura escrow:** [`0xAB31…84d0`](https://sepolia.etherscan.io/address/0xAB313b7dF91Fad2C169c5D592a7c1c45CD4c84d0) — Solidity, **14/14 tests**, full create→fund→release on-chain (`evm/`).
- **0xbow Privacy Pools (self-deployed):** Entrypoint [`0xDd70…275f`](https://sepolia.etherscan.io/address/0xDd70ef8B8965962c3695E193a2D9A44a3D03275f) · ETH Pool [`0xbC87…6976`](https://sepolia.etherscan.io/address/0xbC876a3208dcAa6A86b71C74Bed0c9e0D3086976) — full **deposit → shielded → withdraw** round-trip (tx hashes in `evm/privacy-pools/`).
- **Status:** escrow ✅ · Privacy Pools deploy ✅ · shielded deposit ✅ · shielded withdraw ✅

---

## 🌟 Features

1. **User-controlled milestone escrow** — create a project, fund it (multi-donor, up to a budget
   cap), and release funds gated by the on-chain NDVI reading. Refunds on cancellation, plus
   pause + emergency withdraw as safety valves. No AI — the project authority decides.
2. **Private donations (0xbow Privacy Pools)** — *"Give privately"* runs a **real client-side
   shielded deposit** (no custodial backend); the donor's own wallet interacts with the pool.
3. **Real wallet UX** — one-click connect, **automatic Sepolia network switch**, and real
   pledges + releases with live Etherscan links — for both preset forests and **custom map
   locations** you drop on the globe.
4. **Interactive 3D globe** — pick a forest or drop a custom site; before/after Sentinel-2
   vegetation comparison.

---

## 📂 Architecture

```text
web/                          # ⭐ The app — React + Vite. Client-side; talks directly to Sepolia
│   src/lib/escrow.js         #   ethers client for NauraEscrow (create/fund/release)
│   src/lib/privacypool.js    #   client-side 0xbow Privacy Pools shielded deposit
│   src/lib/wallet.js         #   single wallet-connect entry + automatic Sepolia switch
│   src/components/           #   Header (logo + wallet), Globe, FundingPanel, satellite compare…
evm/                          # ⭐ Live on-chain — Solidity escrow + Privacy Pools (Sepolia)
│   contracts/NauraEscrow.sol #   user-controlled milestone escrow (14/14 tests; deployed 0xAB31…)
│   test/ + scripts/          #   Hardhat tests, deploy, end-to-end demo
│   privacy-pools/            #   0xbow Privacy Pools — deployed addresses + deposit/withdraw scripts
BOUNTIES.md                   # Bounty submissions (Blockchain for Good, 0xbow, SiteLab)
web/.npmrc.example            # Registry config for the Privacy Pools v2 SDK (token via env var)
```

> The current Naura flow is **EVM-only and user-controlled (no AI)**. Earlier Solana / AI-swarm
> scaffolding (`anchor/`, `backend/`, `pp-bridge/`) remains in the repo for history but is **not**
> part of the shipped flow.

---

## 🚀 Run it

The app is **client-side — no backend required**. It connects directly to Sepolia through the
user's wallet.

```bash
cd web
npm install
npm run dev        # → http://localhost:5173
```

Connect MetaMask (the app auto-switches to Sepolia), pick a forest or drop a pin, **Pledge**
(toggle **Give privately** for a shielded donation), then **Verify growth** to release the funds.

Contracts (Hardhat):

```bash
cd evm
npm install
npx hardhat test   # 14/14 passing
```

---

## 🔐 Privacy Pools v2 (0xbow bounty)

The 0xbow bounty mandates the v2 SDK (`@0xbow-io/privacy-pools-v2-sdk`). Configure the private
registry from [`web/.npmrc.example`](web/.npmrc.example) — the token is read from the
`NODE_AUTH_TOKEN` environment variable at install time, so no secret lands in the repo:

```bash
cd web
cp .npmrc.example .npmrc
NODE_AUTH_TOKEN='<0xbow read token>' npm install @0xbow-io/privacy-pools-v2-sdk@beta
```

Ask the 0xbow maintainer for a token if you get a `401` (the hackathon tokens are short-lived).
Migration of the *"Give privately"* flow from the public core SDK to the v2 SDK is in progress.

---

## 🏆 Bounties

Naura targets three cash bounties at ctrl/shift Hackathon 2026 — see [`BOUNTIES.md`](BOUNTIES.md):

- **Blockchain for Good Alliance** — Web3 for environmental impact + on-chain transparency
- **0xbow Privacy Pools** — a UI on top of Privacy Pools (private donations)
- **SiteLab** — best landing page / website
- **Mood Global Services** - best innovative AI use case
