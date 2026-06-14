// Real client-side Privacy Pools donation (no backend server). When "Give privately" is on, a pledge does
// a genuine shielded deposit into our deployed 0xbow Privacy Pool on Sepolia, via the user's own wallet.
// Deposits need no ZK proof (just a precommitment), so this runs fully in the browser.
import { generateMasterKeys, generateDepositSecrets, hashPrecommitment } from "@0xbow/privacy-pools-core-sdk";
import { BrowserProvider, Contract, parseEther } from "ethers";
import { generateMnemonic, english } from "viem/accounts";
import { ensureConnected } from "./wallet.js";

const ENTRYPOINT = import.meta.env.VITE_PP_ENTRYPOINT || "0xDd70ef8B8965962c3695E193a2D9A44a3D03275f";
const POOL = import.meta.env.VITE_PP_POOL || "0xbC876a3208dcAa6A86b71C74Bed0c9e0D3086976";

const POOL_ABI = [{ name: "SCOPE", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }];
const ENTRYPOINT_ABI = [
  { name: "deposit", type: "function", stateMutability: "payable", inputs: [{ name: "_precommitment", type: "uint256" }], outputs: [{ type: "uint256" }] },
];

export function isConfigured() {
  return Boolean(ENTRYPOINT) && typeof window !== "undefined" && Boolean(window.ethereum);
}

/**
 * Shield `amountEth` into the Privacy Pool. Returns { txHash }. The recoverable note (random per deposit)
 * is stored in localStorage so it can be withdrawn later.
 */
export async function privateDeposit(amountEth) {
  if (!isConfigured()) throw new Error("Privacy Pool not configured / no wallet");
  const addr = await ensureConnected();
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner(addr); // explicit addr → no extra eth_requestAccounts prompt

  const pool = new Contract(POOL, POOL_ABI, provider);
  const scope = await pool.SCOPE();

  // fresh, self-contained note per deposit (unique precommitment, no collisions)
  const mnemonic = generateMnemonic(english);
  const masterKeys = generateMasterKeys(mnemonic);
  const { secret, nullifier } = generateDepositSecrets(masterKeys, scope, 0n);
  const precommitment = hashPrecommitment(nullifier, secret);

  const entrypoint = new Contract(ENTRYPOINT, ENTRYPOINT_ABI, signer);
  const tx = await entrypoint.deposit(precommitment, { value: parseEther(String(amountEth)) });
  await tx.wait();

  try {
    const notes = JSON.parse(localStorage.getItem("naura_pp_notes") || "[]");
    notes.push({ mnemonic, scope: scope.toString(), secret: secret.toString(), nullifier: nullifier.toString(), amount: String(amountEth), tx: tx.hash });
    localStorage.setItem("naura_pp_notes", JSON.stringify(notes));
  } catch {
    /* localStorage unavailable — ignore */
  }
  return { txHash: tx.hash };
}
