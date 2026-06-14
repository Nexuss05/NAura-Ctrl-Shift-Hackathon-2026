// REST client for the EVM Privacy-Pools bridge (pp-bridge/server.js, :3001).
// Every call throws on network/HTTP error so callers can fall back to the
// local simulated flow (mirrors the bridge's own FORCE_SIMULATION behaviour).

// In dev, default to the local bridge; in production only use an explicitly configured URL
// (otherwise we'd hit localhost:3001 from the public site and log a connection-refused error).
const BASE = import.meta.env.VITE_BRIDGE_URL || (import.meta.env.DEV ? "http://localhost:3001" : "");

async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Bridge ${method} ${path} → ${res.status} ${text}`);
  }
  return res.json();
}

export const bridge = {
  base: BASE,
  status: () => call("/api/pp/status"),
  deriveKeys: (address) => call("/api/pp/derive-keys", { method: "POST", body: { address } }),
  createSession: () => call("/api/pp/create-session", { method: "POST" }),
  deposit: (amount) => call("/api/pp/deposit", { method: "POST", body: { amount: String(amount) } }),
  publicDeposit: (amount) => call("/api/pp/public-deposit", { method: "POST", body: { amount: String(amount) } }),
  discoverNotes: () => call("/api/pp/discover-notes", { method: "POST" }),
  transfer: (amount, commitment) =>
    call("/api/pp/transfer", { method: "POST", body: { amount: String(amount), ...(commitment ? { commitment } : {}) } }),
  bridgeBalance: () => call("/api/bridge/balance"),
};

// Quick reachability probe used to decide real-vs-simulated at runtime.
export async function bridgeReachable() {
  if (!BASE) return false; // no bridge configured (e.g. the public build) — skip the probe entirely
  try {
    await bridge.status();
    return true;
  } catch {
    return false;
  }
}
