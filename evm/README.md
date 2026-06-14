# Naura — EVM escrow (Solidity)

User-controlled, milestone-based reforestation escrow for EVM chains (target: **Sepolia**). This is the
Solidity port of the Naura program: donors fund a project in ETH; the project's **authority — a human, no
AI —** releases funds to a beneficiary org in milestones, each gated by an **NDVI threshold** and the
**budget**. A protocol fee is taken on release; a project can be cancelled before any release, after which
contributors refund. The owner can pause and emergency-withdraw while paused.

- **Contract:** `contracts/NauraEscrow.sol` (Solidity 0.8.24, OpenZeppelin `Ownable` + `ReentrancyGuard`)
- **Tests:** `npx hardhat test` — **14/14 passing** (config / create / multi-party fund / budget cap / beneficiary rules / NDVI gate / authority checks / fee + completion / cancel + refund / pause + emergency)
- NDVI is an integer scaled by 1000 (no floats), matching the original program.

## Live on Sepolia
- **Deployed contract:** [`0xAB313b7dF91Fad2C169c5D592a7c1c45CD4c84d0`](https://sepolia.etherscan.io/address/0xAB313b7dF91Fad2C169c5D592a7c1c45CD4c84d0)
- **Proven end-to-end on-chain** (create → fund → setBeneficiary → release → `Completed`):
  [create](https://sepolia.etherscan.io/tx/0x32a66c5fb13a96c03a5303f76f00f6a4f53923087a30770d44fe7fe92c1a563c) ·
  [fund](https://sepolia.etherscan.io/tx/0x224a3185f8b45deeb8d9946f6f6f78932e433652273722a4732aa7ae2d5a8604) ·
  [setBeneficiary](https://sepolia.etherscan.io/tx/0xe13f1cea3e8f4305ed2407843812dd5045ab29b318f794d51ba22f37e60518dd) ·
  [release](https://sepolia.etherscan.io/tx/0x2cb5d6db3e25fbabebe9c24f3a73c1fd28072be72218e926226fbb959a299311)
- **Live frontend:** https://naura.pages.dev (Cloudflare Pages)
- **Privacy Pools integration:** see [`privacy-pools/`](privacy-pools/README.md) — 0xbow Privacy Pools self-deployed on Sepolia + a full deposit → shielded → withdraw round-trip.

## Build & test
```bash
npm install
npx hardhat test
```

## Deploy to Sepolia
```bash
cp .env.example .env     # fill SEPOLIA_RPC_URL + DEPLOYER_PRIVATE_KEY (test wallet)
npx hardhat run scripts/deploy.js --network sepolia
# optional: FEE_BPS (default 50 = 0.5%), FEE_TREASURY (default deployer)
```
Then set `VITE_ESCROW_ADDRESS` in `web/.env` to the deployed address — the frontend talks to it via
`web/src/lib/escrow.js` (ethers + `window.ethereum`).

## Interface
- **Admin:** `setConfig(feeBps, feeTreasury)`, `setPaused(bool)` (owner only).
- **Lifecycle:** `createProject(countryCode, budget, planHash, ndviThreshold, authority) → id`,
  `fundProject(id) payable`, `setBeneficiary(id, beneficiary)`, `release(id, amount, ndvi)`,
  `cancelProject(id)`, `refund(id)`, `emergencyWithdraw(id, to)`.
- **View:** `getProject(id)`, `contributions(id, addr)`, `feeBps`, `feeTreasury`, `paused`.
- Custom errors for every guard (gas-cheap, mirrors the program's error codes); events on every state change.

## Design notes
- **No AI.** The `authority` (set to the user's wallet at create time) is the only address that can set the
  beneficiary and release funds. The contract enforces the rules (NDVI threshold, budget cap, fee, pause);
  a person decides whether and when to pay.
- Checks-effects-interactions + `ReentrancyGuard` on every ETH-moving path; `call` for transfers.
- Fee cap hard-coded at 10% (`MAX_FEE_BPS = 1000`).
