# Naura — EVM escrow (Solidity)

User-controlled, milestone-based reforestation escrow for EVM chains (target: **Sepolia**). This is the
Solidity port of the Naura program: donors fund a project in ETH; the project's **authority — a human, no
AI —** releases funds to a beneficiary org in milestones, each gated by an **NDVI threshold** and the
**budget**. A protocol fee is taken on release; a project can be cancelled before any release, after which
contributors refund. The owner can pause and emergency-withdraw while paused.

- **Contract:** `contracts/NauraEscrow.sol` (Solidity 0.8.24, OpenZeppelin `Ownable` + `ReentrancyGuard`)
- **Tests:** `npx hardhat test` — **14/14 passing** (config / create / multi-party fund / budget cap / beneficiary rules / NDVI gate / authority checks / fee + completion / cancel + refund / pause + emergency)
- NDVI is an integer scaled by 1000 (no floats), matching the original program.

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
