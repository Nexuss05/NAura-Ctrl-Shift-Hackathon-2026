/**
 * NAura — Privacy Pools v2 Bridge Server
 * 
 * Node.js Express server that wraps the @0xbow-io/privacy-pools-v2-sdk
 * and exposes REST endpoints for the vanilla JS frontend.
 * 
 * Runs on Sepolia testnet — no real funds involved.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createWalletClient, createPublicClient, http, formatEther, parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { buildSecretDerivationPayload } from './secretDerivationPayload.js';

// ─── SDK Import (graceful fallback if not installed yet) ────────────────────
let CryptoService, PoolSessionBuilder, SDK_AVAILABLE;
try {
  const sdk = await import('@0xbow-io/privacy-pools-v2-sdk');
  CryptoService = sdk.CryptoService;
  PoolSessionBuilder = sdk.PoolSessionBuilder;
  SDK_AVAILABLE = true;
  console.log('[PP Bridge] ✅ Privacy Pools v2 SDK loaded successfully.');
} catch (err) {
  SDK_AVAILABLE = false;
  console.warn('[PP Bridge] ⚠️  Privacy Pools v2 SDK not available:', err.message);
  console.warn('[PP Bridge] Running in SIMULATED mode. Install with: npm install');
}

// ─── Configuration ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';
const DONOR_PRIVATE_KEY = process.env.DONOR_PRIVATE_KEY;
const ESCROW_PRIVATE_KEY = process.env.ESCROW_PRIVATE_KEY;
const ASP_URL = process.env.ASP_URL || 'https://api-dev.0xbow.io';
const RELAYER_URL = process.env.RELAYER_URL || 'https://relayer-v2-staging-149184580131.us-east1.run.app';
const RELAYER_ADDRESS = process.env.RELAYER_ADDRESS || '0x4Ba5fF376865b370790A56276C63e7984DCFf1f7';
const NATIVE_ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

// ─── Viem Clients ───────────────────────────────────────────────────────────
const transport = http(SEPOLIA_RPC_URL);

const publicClient = createPublicClient({
  chain: sepolia,
  transport,
});

let donorAccount, donorWalletClient;
let escrowAccount, escrowWalletClient;

if (DONOR_PRIVATE_KEY && DONOR_PRIVATE_KEY !== '0x_YOUR_DONOR_PRIVATE_KEY_HERE') {
  donorAccount = privateKeyToAccount(DONOR_PRIVATE_KEY);
  donorWalletClient = createWalletClient({
    account: donorAccount,
    chain: sepolia,
    transport,
  });
  console.log(`[PP Bridge] 💳 Donor wallet: ${donorAccount.address}`);
} else {
  console.warn('[PP Bridge] ⚠️  No DONOR_PRIVATE_KEY set. Key derivation will use simulated mode.');
}

if (ESCROW_PRIVATE_KEY && ESCROW_PRIVATE_KEY !== '0x_YOUR_ESCROW_PRIVATE_KEY_HERE') {
  escrowAccount = privateKeyToAccount(ESCROW_PRIVATE_KEY);
  escrowWalletClient = createWalletClient({
    account: escrowAccount,
    chain: sepolia,
    transport,
  });
  console.log(`[PP Bridge] 🔐 Escrow wallet: ${escrowAccount.address}`);
} else {
  console.warn('[PP Bridge] ⚠️  No ESCROW_PRIVATE_KEY set. Escrow session will use simulated mode.');
}

// ─── Session State (in-memory for demo) ─────────────────────────────────────
let donorKeys = null;
let donorSession = null;
let escrowSession = null;
let bridgeBalance = 0n; // ETH in wei received via PP, available for Solana bridge

// ─── Express App ────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/api/pp/status', async (req, res) => {
  try {
    let donorBalance = '0';
    if (donorAccount) {
      const bal = await publicClient.getBalance({ address: donorAccount.address });
      donorBalance = formatEther(bal);
    }

    let escrowBalance = '0';
    if (escrowAccount) {
      const bal = await publicClient.getBalance({ address: escrowAccount.address });
      escrowBalance = formatEther(bal);
    }

    res.json({
      sdkAvailable: SDK_AVAILABLE,
      donorAddress: donorAccount?.address || null,
      escrowAddress: escrowAccount?.address || null,
      donorSepoliaBalance: donorBalance,
      escrowSepoliaBalance: escrowBalance,
      keysDerived: !!donorKeys,
      sessionActive: !!donorSession,
      bridgeBalanceWei: bridgeBalance.toString(),
      bridgeBalanceEth: formatEther(bridgeBalance),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Step 1: Derive Keys ────────────────────────────────────────────────────
app.post('/api/pp/derive-keys', async (req, res) => {
  try {
    if (!donorWalletClient) {
      // Simulated mode — return realistic-looking keys
      console.log('[PP Bridge] Simulated key derivation (no wallet configured)');
      const simKeys = {
        identityNullifier: '0x' + crypto.randomUUID().replace(/-/g, '').slice(0, 32),
        identitySecret: '0x' + crypto.randomUUID().replace(/-/g, '').slice(0, 32),
        viewingKey: '0x04' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
        spendingKey: '0x' + crypto.randomUUID().replace(/-/g, '').slice(0, 32),
        revocableKeyIndex: '0x0',
        mode: 'simulated',
      };
      donorKeys = simKeys;
      return res.json(simKeys);
    }

    // Real key derivation via EIP-712
    const address = donorAccount.address;
    const payload = buildSecretDerivationPayload(address);

    console.log(`[PP Bridge] Signing EIP-712 key derivation for ${address}...`);
    const signature = await donorWalletClient.signTypedData(payload);

    if (SDK_AVAILABLE) {
      const cryptoSvc = new CryptoService();
      const keys = cryptoSvc.deriveKeysFromSignature({
        signature,
        signerAddress: address,
        addressHash: payload.message.addressHash,
        revocableKeyIndex: '0x0',
      });

      donorKeys = { ...keys, revocableKeyIndex: '0x0', mode: 'real' };
      console.log('[PP Bridge] ✅ Real protocol keys derived successfully.');
    } else {
      // SDK not available but we have a real signature
      donorKeys = {
        signature: signature.slice(0, 20) + '...',
        identityNullifier: '0x' + signature.slice(2, 34),
        identitySecret: '0x' + signature.slice(34, 66),
        viewingKey: '0x04' + signature.slice(66, 130),
        spendingKey: '0x' + signature.slice(2, 34),
        revocableKeyIndex: '0x0',
        mode: 'signature-derived',
      };
      console.log('[PP Bridge] ✅ Keys derived from real EIP-712 signature (SDK unavailable).');
    }

    res.json(donorKeys);
  } catch (err) {
    console.error('[PP Bridge] Key derivation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Step 2: Create Session ─────────────────────────────────────────────────
app.post('/api/pp/create-session', async (req, res) => {
  try {
    if (!donorKeys) {
      return res.status(400).json({ error: 'Keys not derived yet. Call /derive-keys first.' });
    }

    if (!SDK_AVAILABLE || !donorWalletClient) {
      console.log('[PP Bridge] Simulated session creation');
      donorSession = { simulated: true, createdAt: new Date().toISOString() };
      return res.json({ status: 'session_created', mode: 'simulated' });
    }

    // Real PP v2 session
    const address = donorAccount.address;
    console.log(`[PP Bridge] Creating PoolSession for ${address}...`);

    donorSession = await PoolSessionBuilder.fromConfig({
      chainId: 11155111,
      rpcUrl: SEPOLIA_RPC_URL,
      ownerAddress: address,
      protocolKeys: { ...donorKeys, revocableKeyIndex: '0x0' },
      aspUrl: ASP_URL,
      relayers: [
        {
          url: RELAYER_URL,
          name: '0xBow Relayer',
          chainId: 11155111,
          chainType: 'evm',
          status: 'active',
          address: RELAYER_ADDRESS,
          processorAddress: RELAYER_ADDRESS,
        },
      ],
      walletInteractor: { type: 'viem', walletClient: donorWalletClient },
    }).create();

    console.log('[PP Bridge] ✅ Real PoolSession created.');
    res.json({ status: 'session_created', mode: 'real' });
  } catch (err) {
    console.error('[PP Bridge] Session creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Step 3: Deposit to Privacy Pool ────────────────────────────────────────
app.post('/api/pp/deposit', async (req, res) => {
  try {
    const { amount = '0.01' } = req.body;
    const weiAmount = parseEther(amount);
    const hexValue = '0x' + weiAmount.toString(16);

    if (!donorSession || donorSession.simulated || !SDK_AVAILABLE) {
      // Simulated deposit — generate realistic-looking commitment
      console.log(`[PP Bridge] Simulated deposit of ${amount} ETH`);
      await new Promise(r => setTimeout(r, 1500)); // Simulate latency

      const mockCommitment = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const mockTxHash = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      return res.json({
        status: 'deposited',
        mode: 'simulated',
        txHash: mockTxHash,
        commitment: mockCommitment,
        amount,
        note: {
          commitment: mockCommitment,
          tokenId: NATIVE_ETH,
          value: amount,
          status: 'ACTIVE',
        },
      });
    }

    // Real deposit to PP v2 contract on Sepolia
    console.log(`[PP Bridge] Depositing ${amount} ETH to Privacy Pool...`);

    await donorSession.deposit({
      tokenId: NATIVE_ETH,
      value: hexValue,
    });

    console.log('[PP Bridge] Deposit submitted. Waiting for ASP attestation...');

    // Discover notes after deposit
    await donorSession.discoverNotes();
    const account = await donorSession.exportAccount();
    const activeNotes = account.notes.filter(n => n.status === 'ACTIVE');
    const latestNote = activeNotes[activeNotes.length - 1];

    console.log(`[PP Bridge] ✅ Deposit confirmed. ${activeNotes.length} active note(s).`);

    res.json({
      status: 'deposited',
      mode: 'real',
      commitment: latestNote?.commitment || 'pending',
      amount,
      note: latestNote || null,
      totalActiveNotes: activeNotes.length,
    });
  } catch (err) {
    console.error('[PP Bridge] Deposit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Step 4: Discover Notes ─────────────────────────────────────────────────
app.post('/api/pp/discover-notes', async (req, res) => {
  try {
    if (!donorSession || donorSession.simulated || !SDK_AVAILABLE) {
      return res.json({ notes: [], mode: 'simulated' });
    }

    await donorSession.discoverNotes();
    const account = await donorSession.exportAccount();
    const notes = account.notes.map(n => ({
      commitment: n.commitment,
      amount: n.amount,
      status: n.status,
      tokenId: n.tokenId,
    }));

    res.json({ notes, mode: 'real' });
  } catch (err) {
    console.error('[PP Bridge] Discover notes error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Step 5: Private Transfer to Escrow ─────────────────────────────────────
app.post('/api/pp/transfer', async (req, res) => {
  try {
    const { amount = '0.005', commitment } = req.body;
    const weiAmount = parseEther(amount);
    const hexValue = '0x' + weiAmount.toString(16);

    if (!donorSession || donorSession.simulated || !SDK_AVAILABLE) {
      // Simulated transfer
      console.log(`[PP Bridge] Simulated private transfer of ${amount} ETH to escrow`);
      await new Promise(r => setTimeout(r, 2000));

      const mockTxHash = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      // Update bridge balance
      bridgeBalance += weiAmount;

      return res.json({
        status: 'transferred',
        mode: 'simulated',
        txHash: mockTxHash,
        amount,
        bridgeBalanceEth: formatEther(bridgeBalance),
      });
    }

    // Real private transfer via relayer
    const recipientAddress = escrowAccount?.address || RELAYER_ADDRESS;

    const account = await donorSession.exportAccount();
    const activeNotes = account.notes.filter(n => n.status === 'ACTIVE');

    if (activeNotes.length === 0) {
      return res.status(400).json({ error: 'No active notes available. Make a deposit first.' });
    }

    // Use specified commitment or first active note
    const noteToSpend = commitment
      ? activeNotes.find(n => n.commitment === commitment)
      : activeNotes[0];

    if (!noteToSpend) {
      return res.status(400).json({ error: 'Specified note not found.' });
    }

    console.log(`[PP Bridge] Preparing private transfer of ${amount} ETH...`);

    const prepared = await donorSession.prepareTransfer({
      inputCommitments: [noteToSpend.commitment],
      amount: hexValue,
      tokenId: NATIVE_ETH,
      recipientDiscoveryData: {
        evmAddress: recipientAddress,
      },
    });

    console.log('[PP Bridge] Relaying transfer through 0xBow relayer...');
    const result = await donorSession.relayTransfer(prepared.relayOptions[0]);

    // Update bridge balance
    bridgeBalance += weiAmount;

    console.log(`[PP Bridge] ✅ Private transfer landed: ${result.txReceipt.txHash}`);

    res.json({
      status: 'transferred',
      mode: 'real',
      txHash: result.txReceipt.txHash,
      amount,
      bridgeBalanceEth: formatEther(bridgeBalance),
    });
  } catch (err) {
    console.error('[PP Bridge] Transfer error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Bridge Balance (for Solana agent to query) ─────────────────────────────
app.get('/api/bridge/balance', (req, res) => {
  res.json({
    balanceWei: bridgeBalance.toString(),
    balanceEth: formatEther(bridgeBalance),
    escrowAddress: escrowAccount?.address || 'not-configured',
  });
});

// ─── Start Server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌿 NAura PP Bridge Server running on http://localhost:${PORT}`);
  console.log(`   SDK:     ${SDK_AVAILABLE ? '✅ Real' : '⚠️  Simulated'}`);
  console.log(`   Chain:   Sepolia (11155111)`);
  console.log(`   RPC:     ${SEPOLIA_RPC_URL}`);
  console.log(`   Donor:   ${donorAccount?.address || '(not configured)'}`);
  console.log(`   Escrow:  ${escrowAccount?.address || '(not configured)'}`);
  console.log(`   ASP:     ${ASP_URL}`);
  console.log(`   Relayer: ${RELAYER_URL}\n`);
});
