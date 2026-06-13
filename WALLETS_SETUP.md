# NAura Wallet Integration Playbook

This document details the architecture, setup, and deployment of the dual-route Web3 payment layer for NAura, including standard public transfers and ZK-shielded deposits via Privacy Pools v2.

---

## Dual-Route Funding Architecture

NAura supports two different deposit flows for sponsors and donors:
1. **Public Direct Deposit (EVM Standard)**: A direct transfer of Sepolia ETH from the donor's wallet to the bridge escrow address. Visible on Etherscan, ideal for public marketing and ESG CSR declarations.
2. **ZK-Privacy Pool (0xBow Shielded)**: Breaks the onchain link between the donor and the project using Zero-Knowledge membership proofs. Regulated compliance is kept intact using Association Set Providers (ASPs) vetting.

Both routes feed into the same bridge backend, which acts as the cross-chain trigger. The Python Agent Swarm on Solana Devnet monitors this bridge balance and triggers the release of Solana Devnet tokens to reforestation authorities when environmental impact metrics (NDVI) are met.

---

## Step-by-Step Setup Guide

### 1. Install Dependencies
The Privacy Pools v2 SDK is hosted on GitHub Packages. A pre-configured `.npmrc` is available in both the root and `pp-bridge` directories.

To install dependencies and prepare the server, execute:
```bash
# Run the automated setup helper script
./setup-pp-bridge.sh
```
Or run it manually:
```bash
cd pp-bridge
npm install
```

---

### 2. Generate Wallet Keys
During the `./setup-pp-bridge.sh` script execution, a `.env` file is automatically generated inside the `pp-bridge` directory with fresh throwaway private keys for testing:
*   **Donor Wallet**: The mock wallet used to simulate user actions (signatures, deposits, transfers).
*   **Escrow Wallet**: The designated receiver address on the EVM layer representing the bridge vault.

To generate new keys manually, you can use:
```bash
cd pp-bridge
node -e "
  const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts');
  console.log('Donor Key: ', generatePrivateKey());
  console.log('Escrow Key:', generatePrivateKey());
"
```

---

### 3. Obtain Sepolia Testnet ETH (Faucet)
Since Privacy Pools v2 is deployed on the **Ethereum Sepolia Testnet (Chain ID 11155111)**, you will need Sepolia ETH to submit transactions.

1.  Copy the `Address` generated for your **Donor Wallet** (found in `pp-bridge/.env`).
2.  Use any of the following free public faucets to request Sepolia ETH:
    *   [Google Cloud Web3 Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) (Requires Google account, yields 0.05 Sepolia ETH)
    *   [Alchemy Faucet](https://sepoliafaucet.com) (Requires Alchemy account, yields 0.1 Sepolia ETH)
    *   [Infura Faucet](https://www.infura.io/faucet/sepolia) (Requires Infura account)

---

### 4. RPC Node Configuration
The bridge communicates with the Sepolia blockchain using an RPC node. The default configuration uses the public endpoint:
`https://rpc.sepolia.org`

To avoid rate limits and connection issues during live demos, configure a private RPC endpoint from Alchemy, QuickNode, or Infura in `pp-bridge/.env`:
```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
```

---

### 5. Smart Contracts Focus & Deployment

#### A. Ethereum/Sepolia (Privacy Pools v2)
**Do NOT deploy any smart contracts on Ethereum.** 
The Privacy Pools v2 protocol is an infrastructure suite already deployed and maintained by the 0xBow team on Sepolia. The SDK automatically resolves and points to the official native ETH pool contract.
*   **Staging ASP (Association Set Provider)**: `https://api-dev.0xbow.io`
*   **0xBow Staging Relayer**: `https://relayer-v2-staging-149184580131.us-east1.run.app` (Processor: `0x4Ba5fF376865b370790A56276C63e7984DCFf1f7`)

#### B. Solana Devnet (Escrow Contract)
The Solana program that receives the corresponding release signals from the agent swarm is located in [anchor/programs/verdant-escrow/src/lib.rs](file:///Users/matteocotena/Documents/Hackathon%20CTRL-SHIFT/Github/NAura-Backend/anchor/programs/verdant-escrow/src/lib.rs).

1.  **Configure Program ID**:
    If your team has already deployed the program, obtain the deployed **Program ID** (Public Key) and update it in:
    *   `anchor/Anchor.toml` (`verdant_escrow = "YOUR_PROGRAM_ID"`)
    *   `anchor/programs/verdant-escrow/src/lib.rs` (`declare_id!("YOUR_PROGRAM_ID");`)
    *   Python swarm configuration (`treasurer_agent.py`)

2.  **Deploy it yourself on Devnet**:
    If you want to deploy a fresh instance of the Solana escrow contract:
    ```bash
    cd anchor
    anchor build
    anchor deploy --provider.cluster devnet
    ```

---

## Running the Demo

1.  Start the ZK bridge backend:
    ```bash
    cd pp-bridge
    node server.js
    ```
2.  Start the Python AI Swarm server:
    ```bash
    python backend/agent_swarm.py
    ```
3.  Open `index.html` in your browser.
4.  Use the **Mode Switcher** to toggle between **zk-Privacy Pool (Shielded)** and **Public Direct Deposit** modes. 
    *   *Public Mode* executes simple direct transfers.
    *   *Private Mode* takes you through EIP-712 key derivation, ZK commitments, note discovery, and relayer broadcasting.
