# Naura backend — TypeScript Solana agent & demo

Off-chain side of Naura. A TypeScript client for the on-chain program (see [`../anchor`](../anchor)),
an autonomous agent that releases milestone funds when an NDVI threshold is met, and end-to-end demos.

## Layout
```
backend/
├── agent/        TypeScript Solana agent
│   ├── naura.ts        PDA + instruction client (config/project/vault/contribution)
│   ├── ndvi.ts         NDVI oracle (simulated; swap for Sentinel-2 later) — i64 ×1000, no floats
│   ├── recommender.ts  beneficiary/threshold/milestone recommendation (local heuristic + Claude CLI)
│   ├── agent.ts         milestone driver: set_beneficiary, then release per milestone gated by NDVI
│   ├── cli.ts          discrete tools (bootstrap/config/status/ndvi/set-beneficiary/release)
│   └── AGENT.md        playbook: Claude Code acting as the Naura Solana agent
├── demo/         run-demo.ts (localnet, end-to-end) · run-demo-devnet.ts (tiny amounts + explorer links)
└── idl/          bundled program IDL + TS types (keeps this package self-contained)
```

> The bundled `idl/` is a committed copy of the contract's build output, so the backend builds and runs
> without first building the program. After changing the contract, refresh it from `../anchor/target`:
> `cp ../anchor/target/idl/naura.json idl/naura.json && cp ../anchor/target/types/naura.ts idl/naura.ts`.

## The "Solana AI agent" here = Claude Code
The agent is driven by **Claude Code** through the discrete CLI tools in `agent/cli.ts` (read `agent/AGENT.md`).
It needs **no paid LLM API key** — the orchestration model is Claude Code itself, calling on-chain tools
(`status` → `ndvi` → `set-beneficiary` → `release`) and gating releases on the NDVI threshold.

## Run
```bash
npm install

# end-to-end on a local validator (program must be deployed at 6Wng… — see ../anchor)
npm run demo

# same flow on devnet with tiny amounts + Explorer links
npm run demo:devnet

# individual agent tools (Claude Code uses these one at a time)
npm run agent -- status
npm run agent -- ndvi
npm run agent -- release --milestone 0
```

## Other backend components
A Python agent swarm lives alongside this package — `agent_swarm.py`, `treasurer_agent.py`,
`ndvi_calculator.py`, `generate_sample_tiles.py` (deps in `requirements.txt`). Both target the same
on-chain program; the TypeScript path above is the one with a runnable end-to-end demo.
