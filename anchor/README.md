# Naura — Anchor escrow program

The on-chain core of Naura: a native-SOL escrow that releases funds to a reforestation beneficiary
in milestones, gated by an NDVI threshold, a budget cap, a protocol fee, and a global pause switch.
Supports multi-contributor funding, proportional refunds, terminal close (rent reclaim), and an admin
emergency withdraw.

> This replaces the earlier `verdant-escrow` draft with the completed, tested program (same idea, finished).

- **Program ID:** `6WngBHVPBX2y27UxP6epeY1LkkYR7afM4MiYoCCa13MF`
- **Tests:** `anchor test` — **12/12 passing** (config / happy path / 6 boundary failures / cancel+refund / emergency)

## Toolchain
Anchor CLI **1.0.2**, Solana/Agave **3.1.10** (pinned by Anchor), Rust 1.96 (program builds with 1.89 per
`rust-toolchain.toml`), Node 24. TS client: `@anchor-lang/core` 1.0.2.

## Build & test
```bash
npm install
anchor build
./scripts/localnet-test.sh   # one-shot: starts a local validator (free ports) + runs anchor test
```
> Two environment notes baked into the script: Anchor 1.0 defaults `anchor test` to surfpool (not installed here)
> → it uses the legacy validator; and the default gossip port 8000 may be occupied → it passes a free `--gossip-port`.
> The TS test runner is `tsx` (Node 24 loads `.ts` as ESM, which breaks ts-mocha's CJS hook).

## Deploy to devnet
```bash
solana config set --url devnet
solana airdrop 2 || echo "CLI throttled, use https://faucet.solana.com"
anchor build
anchor deploy --provider.cluster devnet --provider.wallet ~/.config/solana/id.json
```
> The program **keypair is not committed** (it's a secret). To deploy to the shared id `6Wng…`, obtain
> `naura-keypair.json` from the team over a secure channel and place it at `target/deploy/naura-keypair.json`
> before building. Otherwise run `anchor keys sync` to use your own id (and update the program id in the frontend).

## Interface
11 instructions (`initialize_config`, `update_config`, `set_paused`, `create_project`, `fund_project`,
`set_beneficiary`, `release`, `cancel_project`, `refund`, `close_project`, `emergency_withdraw`),
4 accounts (Config / Project / Vault / Contribution), 15 error codes, 11 events. No floats (NDVI is i64×1000),
checked math, `overflow-checks = true`. See `programs/naura/src/lib.rs`.
