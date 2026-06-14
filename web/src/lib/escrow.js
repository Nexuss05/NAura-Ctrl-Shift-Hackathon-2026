// Ethers client for the NauraEscrow contract (the Naura EVM escrow — see ../../../evm).
// Talks to the deployed contract via window.ethereum. Configure VITE_ESCROW_ADDRESS in web/.env to
// enable real on-chain calls; otherwise isConfigured() is false and callers fall back to the simulated
// flow (mirrors the real-first / simulated-fallback pattern in lib/bridge.js).
//
// Requires `ethers` (added to package.json) — run `npm install` in web/ before building.
import { BrowserProvider, Contract, parseEther, id } from "ethers";
import abi from "./naura-escrow-abi.json";

const ADDRESS = import.meta.env.VITE_ESCROW_ADDRESS || "";
const COUNTRY_DEFAULT = "0x0000";

/** True when an address is configured and an injected wallet is available. */
export function isConfigured() {
  return Boolean(ADDRESS) && typeof window !== "undefined" && Boolean(window.ethereum);
}

async function signerContract() {
  if (!isConfigured()) throw new Error("NauraEscrow not configured (set VITE_ESCROW_ADDRESS + connect a wallet)");
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return new Contract(ADDRESS, abi, signer);
}

async function readContract() {
  const provider = new BrowserProvider(window.ethereum);
  return new Contract(ADDRESS, abi, provider);
}

/** The connected wallet address. */
export async function connectedAddress() {
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return signer.getAddress();
}

/** Create a project. `authority` (the user) is the only address that can release. Returns { id, txHash }. */
export async function createProject({ countryCode = COUNTRY_DEFAULT, budgetEth, planLabel = "naura", ndviThreshold, authority }) {
  const c = await signerContract();
  const tx = await c.createProject(countryCode, parseEther(String(budgetEth)), id(planLabel), BigInt(ndviThreshold), authority);
  const rc = await tx.wait();
  let projectId = null;
  for (const log of rc.logs) {
    try {
      const p = c.interface.parseLog(log);
      if (p && p.name === "ProjectCreated") { projectId = p.args.id; break; }
    } catch {
      /* not our event */
    }
  }
  return { id: projectId, txHash: rc.hash };
}

/** Escrow ETH into a project (up to its budget). Returns { txHash }. */
export async function fundProject(projectId, amountEth) {
  const c = await signerContract();
  const tx = await c.fundProject(projectId, { value: parseEther(String(amountEth)) });
  const rc = await tx.wait();
  return { txHash: rc.hash };
}

/** Set the beneficiary org (authority only). Returns { txHash }. */
export async function setBeneficiary(projectId, beneficiary) {
  const c = await signerContract();
  const tx = await c.setBeneficiary(projectId, beneficiary);
  const rc = await tx.wait();
  return { txHash: rc.hash };
}

/** Release a milestone amount, gated by the NDVI reading (x1000). Authority only. Returns { txHash }. */
export async function release(projectId, amountEth, ndvi) {
  const c = await signerContract();
  const tx = await c.release(projectId, parseEther(String(amountEth)), BigInt(ndvi));
  const rc = await tx.wait();
  return { txHash: rc.hash };
}

/** Read a project's on-chain state. */
export async function getProject(projectId) {
  const c = await readContract();
  return c.getProject(projectId);
}
