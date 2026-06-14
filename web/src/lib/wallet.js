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
export async function ensureConnected() {
  if (!hasWallet()) throw new Error("No wallet found — install MetaMask to continue.");

  const existing = await currentAccount();
  if (existing) return existing; // already authorized → no popup, no -32002

  if (inflight) return inflight; // a connect popup is already open → reuse it, don't fire another

  inflight = window.ethereum
    .request({ method: "eth_requestAccounts" })
    .then((accounts) => {
      const addr = accounts?.[0];
      if (!addr) throw new Error("No account selected.");
      return addr;
    })
    .catch((err) => {
      if (err?.code === -32002) throw new Error("Check your wallet — a connection request is already open.");
      if (err?.code === 4001) throw new Error("Wallet connection was rejected.");
      throw err;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
