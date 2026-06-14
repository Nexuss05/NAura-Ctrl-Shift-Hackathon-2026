#!/bin/bash
# NAura PP Bridge — Setup Script
# Run this from the project root to install dependencies and generate test wallets

set -e

echo "🌿 NAura Privacy Pools Bridge Setup"
echo "===================================="

# Navigate to pp-bridge directory
cd "$(dirname "$0")/pp-bridge"

# Install npm dependencies
echo ""
echo "📦 Installing npm dependencies..."
npm install

# Generate test wallets if .env doesn't exist
if [ ! -f .env ]; then
  echo ""
  echo "🔑 Generating test wallets..."
  node -e "
    const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts');
    const donorKey = generatePrivateKey();
    const escrowKey = generatePrivateKey();
    const donorAddr = privateKeyToAccount(donorKey).address;
    const escrowAddr = privateKeyToAccount(escrowKey).address;
    
    const env = \`# NAura PP Bridge — Auto-generated config
SEPOLIA_RPC_URL=https://rpc.sepolia.org

# Donor wallet (fund from https://sepoliafaucet.com)
DONOR_PRIVATE_KEY=\${donorKey}
# Address: \${donorAddr}

# Escrow wallet  
ESCROW_PRIVATE_KEY=\${escrowKey}
# Address: \${escrowAddr}

ASP_URL=https://api-dev.0xbow.io
RELAYER_URL=https://relayer-v2-staging-149184580131.us-east1.run.app
RELAYER_ADDRESS=0x4Ba5fF376865b370790A56276C63e7984DCFf1f7
PORT=3001
\`;
    require('fs').writeFileSync('.env', env);
    console.log('   Donor:  ' + donorAddr);
    console.log('   Escrow: ' + escrowAddr);
  " 2>/dev/null || echo "   (Auto-generation requires viem — copy .env.example to .env and set keys manually)"
fi

echo ""
echo "✅ Setup complete! Start the server with:"
echo "   cd pp-bridge && node server.js"
echo ""
