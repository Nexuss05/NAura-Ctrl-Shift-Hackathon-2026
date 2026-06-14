# Naura × 0xbow Privacy Pools (Sepolia) — full round-trip working

Private donations via **0xbow Privacy Pools**, using the **public, audited** `@0xbow/privacy-pools-core-sdk`
(no gated / token-only packages). We **self-deployed the full Privacy Pools stack to Sepolia** (free) and
completed a **real deposit → shielded → withdraw round-trip on-chain**.

## Deployed on Sepolia (`deployments-sepolia.json`)
| Contract | Address |
|---|---|
| Entrypoint | `0xDd70ef8B8965962c3695E193a2D9A44a3D03275f` |
| ETH Pool | `0xbC876a3208dcAa6A86b71C74Bed0c9e0D3086976` |
| WithdrawalVerifier (regenerated) | `0x093E4eAe08bcb4942D19083F3b460f850d31c2ED` |
| RagequitVerifier | `0xe3223f422d1dDd8832Ad017a2E5287c5d2E6471f` |

Owner + ASP postman: `0x8De48E03a131E0Ecf93198E8F4b104E7caD99530`. Min deposit 0.001 ETH; 1% vetting fee.

## Round-trip — all verified on-chain ✅
| Step | Tx |
|---|---|
| Shielded deposit #1 | [`0x14d81e8e…`](https://sepolia.etherscan.io/tx/0x14d81e8ea8252311207f2f87fef7f84202d3723a9cd1f6bd836faffe55a45d95) |
| Shielded deposit #2 | [`0x096ac479…`](https://sepolia.etherscan.io/tx/0x096ac4797b1d0a2fb32fb08db53f3b523a6648b4c1a541c6e1206905735ae202) |
| **Shielded withdrawal** | [`0x17600f51…`](https://sepolia.etherscan.io/tx/0x17600f517402b907b75bc97a2bfb02a453ab46a3e62bb70e25c86730d10861a9) |

- **Deposit** (`deposit.mjs`): `generateMasterKeys` → `generateDepositSecrets` → `hashPrecommitment` → `Entrypoint.deposit`.
- **ASP** (postman): `Entrypoint.updateRoot()` publishes the association-set root.
- **Withdrawal** (`withdraw.mjs`): builds the 16 circuit signals like the SDK, generates the Groth16 proof
  **directly with `snarkjs` + our own circuit artifacts**, formats it (G2 swap), and calls `pool.withdraw`.

## The one real gotcha (and how it was fixed)
0xbow's public repo ships a `WithdrawalVerifier.sol` whose verification key did **not** match the repo's
committed proving key (`build/withdraw/groth16_pkey.zkey`) — a proof made with that proving key was rejected
on-chain with `InvalidProof()`. Fix: regenerate the verifier from the proving key
(`snarkjs zkey export solidityverifier`), bump the pragma, rename to `WithdrawalVerifier`, and redeploy the
pool with it. The adapted verifier is in `WithdrawalVerifier.regenerated.sol`. We did **not** disable any
SDK integrity check — we call snarkjs directly with the correct artifacts for our own pool.

## Reproduce
```bash
# 1) deploy the pool from the public 0xbow repo (with the regenerated WithdrawalVerifier)
git clone --recurse-submodules https://github.com/0xbow-io/privacy-pools-core
# fix the lean-imt foundry remapping (trailing slash); replace WithdrawalVerifier.sol with the regenerated one
cd packages/contracts
forge script script/Deploy.s.sol:EthereumSepolia --rpc-url <sepolia> --broadcast --private-key <deployer>

# 2) deposit + withdraw (this folder). Artifacts: privacy-pools-core/packages/circuits/build/{withdraw,commitment}
npm install
PK=<sepolia_key> node deposit.mjs           # NONCE=0,1
PK=<sepolia_key> node withdraw.mjs
```
