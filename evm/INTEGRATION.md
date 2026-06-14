# Wiring the Naura EVM escrow into the `web/` tool

The contract (`evm/contracts/NauraEscrow.sol`) is the real, user-controlled on-chain escrow that the
donation tool can fund. It plugs in behind the existing real-first / simulated-fallback pattern, so the
demo keeps working whether or not the contract is deployed.

## Turn it on
1. **Deploy** the contract (see `evm/README.md`):
   ```bash
   cd evm && cp .env.example .env   # fill SEPOLIA_RPC_URL + DEPLOYER_PRIVATE_KEY
   npx hardhat run scripts/deploy.js --network sepolia
   ```
2. **Point the frontend at it:** set `VITE_ESCROW_ADDRESS=<deployed address>` in `web/.env`.
3. **Install the new dep:** `cd web && npm install` (adds `ethers`).
4. Run `npm run dev`, connect a wallet on Sepolia, pick a forest, and pledge.

## What is wired (this branch)
- `web/src/lib/escrow.js` — ethers client for the contract (`createProject`, `fundProject`,
  `setBeneficiary`, `release`, `getProject`) via `window.ethereum`.
- `web/src/App.jsx` → `onFund`: when `VITE_ESCROW_ADDRESS` is set and a wallet is connected, the pledge
  also **escrows ETH on-chain** through `NauraEscrow` (creates the project once per forest with the user as
  the release authority, then funds it). It is `try/catch`-guarded and only runs when configured, so the
  simulated flow is untouched otherwise. The tx hash is logged to the console.

## Not yet wired (good next steps)
- **User-approved release in the UI:** `escrow.release(id, amount, ndvi)` exists; hook it to a "release"
  button so the user approves each milestone (the contract already enforces the NDVI threshold + budget).
- **Per-forest beneficiary address:** `setBeneficiary` needs a real org address per project; today the
  data model (`web/src/data.js`) has no beneficiary field.
- **Surface the tx hash** in the funding confirmation UI (currently console-only).

## Design
No AI: the project `authority` is set to the connected wallet, so the **user** is the only one who can set
the beneficiary and release funds. The contract enforces the rules; a person makes the call.
