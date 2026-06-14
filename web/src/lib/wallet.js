// Single source of truth for connecting the injected wallet.
//
// MetaMask throws "-32002 Request of type 'wallet_requestPermissions' already pending" when
// eth_requestAccounts is fired twice before the first popup is answered. That happened here because
// the Connect button (Header) and the pledge flow (escrow.js / privacypool.js) each requested
// accounts independently. This module makes every caller share ONE in-flight request and reuse an
// already-authorized connection silently, so a duplicate prompt never reaches the extension.

let inflight = null;

export function hasWallet() {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

/** The currently-authorized address WITHOUT prompting (null if none / no wallet). */
export async function currentAccount() {
  if (!hasWallet()) return null;
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Ensure a wallet is connected and return its address. Prompts at most once even when called
 * concurrently (e.g. the Connect button and a pledge at the same time): a silent eth_accounts
 * check first, then a single shared eth_requestAccounts. Throws a friendly error on reject /
 * already-pending instead of letting MetaMask log a raw RPC error.
 */
// Naura's contracts (escrow + Privacy Pools) live on Sepolia. Balances and transactions only work
// when the wallet is on this network — on Mainnet the funds show as 0 and pledges would fail.
const SEPOLIA = {
  chainId: "0xaa36a7", // 11155111
  chainName: "Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com", "https://rpc.sepolia.org"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};

/** Make sure the wallet is on Sepolia; prompt to switch (or add) it if not. No-op if already there. */
export async function ensureSepolia() {
  if (!hasWallet()) return;
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (current === SEPOLIA.chainId) return;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA.chainId }] });
  } catch (err) {
    if (err?.code === 4902) {
      // network not added yet — add it, which also switches
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [SEPOLIA] });
    } else if (err?.code === -32002) {
      throw new Error("Check your wallet — a network-switch request is already open.");
    } else if (err?.code === 4001) {
      throw new Error("Please switch MetaMask to the Sepolia network to continue.");
    } else {
      throw err;
    }
  }
}

export async function ensureConnected() {
  if (!hasWallet()) throw new Error("No wallet found — install MetaMask to continue.");

  let addr = await currentAccount(); // already authorized → no popup, no -32002
  if (!addr) {
    if (!inflight) {
      // a connect popup is already open → reuse it, don't fire another
      inflight = window.ethereum
        .request({ method: "eth_requestAccounts" })
        .then((accounts) => {
          const a = accounts?.[0];
          if (!a) throw new Error("No account selected.");
          return a;
        })
        .catch((err) => {
          if (err?.code === -32002) throw new Error("Check your wallet — a connection request is already open.");
          if (err?.code === 4001) throw new Error("Wallet connection was rejected.");
          throw err;
        })
        .finally(() => {
          inflight = null;
        });
    }
    addr = await inflight;
  }

  await ensureSepolia(); // funds + pledges only work on Sepolia — switch the user there automatically
  return addr;
}
