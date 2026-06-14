# Naura — backend (TypeScript client & demo)

Off-chain side of Naura: a TypeScript client for the on-chain escrow program (see [`../anchor`](../anchor))
and end-to-end demos. Naura is a **transparent, user-controlled** reforestation escrow — a human funder
decides whether and when to release funds to a beneficiary organization. **There is no AI here:** the
contract enforces the rules (NDVI threshold, budget cap, authority, pause) and a person makes the call.

## Layout
```
backend/
├── src/
│   ├── naura.ts   on-chain client — PDAs + instruction wrappers (config / project / vault / contribution)
│   └── ndvi.ts    NDVI reading helper (simulated; the informational signal the user reviews)
├── demo/
│   ├── run-demo.ts          localnet, full flow, operator approves each milestone
│   └── run-demo-devnet.ts   devnet, tiny real amounts + Explorer links
└── idl/           bundled program IDL + TS types (self-contained; no anchor build needed)
```

> The bundled `idl/` is a committed copy of the contract's build output, so the backend runs without
> first building the program. After changing the contract, refresh it from `../anchor/target`:
> `cp ../anchor/target/idl/naura.json idl/naura.json && cp ../anchor/target/types/naura.ts idl/naura.ts`.

## Flow
1. **Admin** initializes the protocol config (fee + treasury).
2. **Contributors** escrow SOL into a project (multi-party funding, up to the budget).
3. **The funder/operator** sets the beneficiary org and, milestone by milestone, reviews the NDVI
   reading and **approves** a release. The contract rejects any release below the NDVI threshold or
   over budget. When the budget is fully released, the project completes.

The release authority is whoever the project was created with — set it to the user's own wallet so the
user is the one who approves payouts.

## Run
```bash
npm install

# end-to-end on a local validator (program must be deployed at 6Wng… — see ../anchor)
npm run demo

# same flow on devnet with tiny amounts + Explorer links
npm run demo:devnet
```
