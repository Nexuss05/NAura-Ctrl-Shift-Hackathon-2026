# Naura × 0xbow Privacy Pools (Sepolia)

Private donations via **0xbow Privacy Pools**, using the **public, audited** `@0xbow/privacy-pools-core-sdk`
(no gated / token-only packages). We **self-deployed the full Privacy Pools stack to Sepolia** (free) and
performed a **real shielded deposit** on-chain.

## Deployed on Sepolia (`deployments-sepolia.json`)
| Contract | Address |
|---|---|
| Entrypoint | `0xC02b4350223dB390F87DbeCa86b823fE6dBBc8CB` |
| ETH Pool | `0xECe9272a220237D2426Fd3494585DBa2368421E4` |
| WithdrawalVerifier | `0x372479770419E05A190b3be0DaE15a7F711e1245` |
| CommitmentVerifier | `0x0a9430de54130696c5b124adA9930d5D2663AcDF` |

Owner + ASP postman: the deployer wallet. Min deposit 0.001 ETH; 1% vetting fee.

## What works ✅
- **Shielded deposit** (`deposit.mjs`) — deposits ETH privately into the pool. Verified on-chain:
  tx `0x7d81ceca0e6632c86bd542361f97122bbe7704ef1e6d4d7ac5d4cb118903bdde` (0.002 ETH, pool Merkle tree +1 leaf,
  0.00198 ETH escrowed after the 1% vetting fee). Flow: `generateMasterKeys` → `generateDepositSecrets` →
  `hashPrecommitment` → `Entrypoint.deposit`.
- **ASP root posting** — as the postman, `Entrypoint.updateRoot()` publishes the association-set root.

## In progress 🔧
- **Shielded withdrawal** (`withdraw.mjs`) — posts the ASP root (postman), builds the 16 circuit signals
  exactly like the SDK, and **generates the withdrawal ZK proof directly with `snarkjs` + our own
  artifacts** (the SDK's loader pins 0xbow's mainnet artifact hashes and refuses ours; we did **not**
  disable that integrity control — we call snarkjs directly with the correct artifacts for our own pool).
  Proof generation and tx submission succeed; the on-chain `withdraw` reverts with `InvalidProof()` — a
  final public-signal / verifier-vs-proving-key alignment issue still being traced. The full
  deposit → withdraw round-trip is the remaining work.

## Reproduce
```bash
# 1) deploy the pool from the public 0xbow repo
git clone --recurse-submodules https://github.com/0xbow-io/privacy-pools-core
cd privacy-pools-core && yarn install
# fix the lean-imt foundry remapping (add a trailing slash) then:
cd packages/contracts
forge script script/Deploy.s.sol:EthereumSepolia --rpc-url <sepolia_rpc> --broadcast --private-key <deployer_key>

# 2) deposit (from this folder)
npm install
PK=<funded_sepolia_key> node deposit.mjs
```
Circuit artifacts come from `privacy-pools-core/packages/circuits/build/` (withdraw + commitment `.wasm`/`.zkey`),
laid out under an `artifacts/` directory referenced by the SDK's `new Circuits({ baseUrl })`.
