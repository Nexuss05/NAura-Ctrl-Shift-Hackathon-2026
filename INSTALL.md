# Installing the Privacy Pools V2 SDK (hackathon beta)

`@0xbow-io/privacy-pools-v2-sdk` is distributed as a **private** package on GitHub Packages. These steps install it as a normal npm dependency — you do **not** get or need access to the source repository.

> ⏳ **The access token below is read‑only and expires ~`2026-06-18`.** If installs start failing with `401`, the token has expired — ping the maintainer for a fresh one.

## 1. Configure npm

In the **root of your project**, create a file named `.npmrc` with exactly these two lines:

```ini
@0xbow-io:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=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
```

> Add `.npmrc` to your `.gitignore` so the token never lands in your own repo.

## 2. Install

```bash
npm install @0xbow-io/privacy-pools-v2-sdk@beta
# or
pnpm add @0xbow-io/privacy-pools-v2-sdk@beta
# or
yarn add @0xbow-io/privacy-pools-v2-sdk@beta
```

To pin an exact version instead of tracking the latest beta:

```bash
npm install @0xbow-io/privacy-pools-v2-sdk@0.1.0-beta.0
```

## 3. Use it

```typescript
import { DEFAULT_CIRCUIT_MANIFEST, PoolSessionBuilder } from "@0xbow-io/privacy-pools-v2-sdk";

const session = await PoolSessionBuilder.create({
  chainId: 11155111, // Sepolia
  // ...see the SDK README for full configuration
});
```

## Troubleshooting

| Error | Cause / fix |
|---|---|
| `401 Unauthorized` | Token expired or mistyped — re‑check the `_authToken` line in `.npmrc`. |
| `403 Forbidden` | Token lacks package access — ask the maintainer to re‑grant. |
| `404 Not Found` | The `@0xbow-io:registry` line is missing or misspelled in `.npmrc`. |

**Requirements:** Node.js ≥ 18. Works with npm, pnpm, and yarn.
