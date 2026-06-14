# Naura — Bounty Submissions (ctrl/shift Hackathon 2026)

Naura is a **pay-on-proof reforestation funding protocol**. Donations are locked in an
on-chain escrow and released to a reforestation organization **only when forest growth is
verified** (an NDVI satellite threshold). Donors can also give **privately** through 0xbow
Privacy Pools. Everything runs live on the **Ethereum Sepolia** testnet.

- Live app: https://naura.pages.dev
- Escrow contract: [`0xAB313b7dF91Fad2C169c5D592a7c1c45CD4c84d0`](https://sepolia.etherscan.io/address/0xAB313b7dF91Fad2C169c5D592a7c1c45CD4c84d0)
- Network: Sepolia (chainId 11155111)

---

## 🦾 Blockchain for Good Alliance — AI or Web3 Tools for GOOD

Naura uses blockchain as a **force for real-world environmental impact**: it makes climate
funding *accountable* by paying only for **proven** reforestation, not promises.

**How Naura embodies each of the Alliance's key values:**

| Value | How Naura delivers it |
|---|---|
| 🌍 **Social & environmental impact** | Channels capital into reforestation and releases it only when satellite-measured forest health (NDVI) actually improves — money follows real ecological outcomes, not pledges. |
| 🔗 **Transparency & accountability** | Every donation, every release, and the NDVI threshold are **on-chain and publicly auditable**. No donor has to trust an intermediary — they can verify the escrow on Etherscan. |
| ⚙️ **Open collaboration & interoperability** | Open-source EVM contracts (OpenZeppelin `Ownable` + `ReentrancyGuard`), standard ERC-style flows, and an optional privacy layer via 0xbow Privacy Pools. Anyone can fund, anyone can verify. |
| 💡 **Scalable & sustainable** | One contract supports many projects, multi-donor funding up to a budget cap, milestone-based releases, refunds on cancellation, and an emergency safety valve — a reusable funding rail for any pay-on-proof environmental program. |

**The core problem it solves:** climate philanthropy suffers from a verification gap — funds
are paid out before impact is proven. Naura closes that gap by making **proof of growth** the
on-chain trigger for payment.

**Live, verifiable proof (Sepolia):**
- Create project → fund escrow → release-on-proof, all real transactions
- Funds are held by the escrow contract and only the project authority can release them, gated by the NDVI reading enforced in the contract

---

## 🕶️ 0xbow.io — Build a UI on top of Privacy Pools v2

Naura's **"Give privately"** option lets a donor shield their contribution through 0xbow
Privacy Pools, so the donation amount and link to the donor are not exposed on-chain — while
the funds still reach the reforestation project.

- Client-side shielded deposit (no custodial backend) — the donor's own wallet interacts with the pool
- Built on the 0xbow Privacy Pools v2 SDK (`@0xbow-io/privacy-pools-v2-sdk`) per the mandatory INSTALL.md
- Use case: **private donations / payroll-style private payouts** to organizations

*(Integration in progress: migrating the privacy flow to the v2 SDK's `PoolSessionBuilder`.)*

---

## 🧪 SiteLab — Best landing page / website

The Naura web app is a polished, production-grade product experience:
- Interactive 3D globe to pick a forest or drop a custom site
- Before/after satellite imagery comparison
- One-click wallet connect with automatic Sepolia network switching
- Real on-chain pledges and releases with live Etherscan links

Live: https://naura.pages.dev
