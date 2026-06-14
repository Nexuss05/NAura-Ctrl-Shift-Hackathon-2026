/**
 * Naura devnet live demo (single funded wallet, tiny real transactions, prints Explorer links).
 *
 * Difference from the localnet demo: the devnet faucet is unreliable -> no airdrops; one already-funded
 * wallet acts as operator/admin/funder/fee payer, and the agent is a generated keypair (only signs, never
 * pays). Tiny budget (0.2 SOL), and each transaction prints an https://explorer.solana.com link so judges
 * can verify the on-chain activity live.
 *
 * Prereq:
 *   1) the program is deployed to devnet (anchor deploy --provider.cluster devnet)
 *   2) the wallet has >= ~0.5 SOL (default ~/.config/solana/id.json, override with WALLET env var)
 * Run:  npm run demo:devnet
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import * as anchor from "@anchor-lang/core";
import {
  makeProgram,
  configPda,
  vaultPda,
  fetchProject,
  initializeConfig,
  createProject,
  fundProject,
  setBeneficiary,
  release,
  sol,
  BN,
  Keypair,
} from "../agent/naura";
import { getRecommendation, recommendationHash } from "../agent/recommender";
import { SimulatedNdviOracle } from "../agent/ndvi";

const FEE_BPS = 50;
const RPC = process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";
const WALLET = process.env.WALLET || `${homedir()}/.config/solana/id.json`;
const BUDGET_SOL = Number(process.env.BUDGET_SOL || 0.2);

const exTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
const exAddr = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;
const hr = (t: string) => console.log("\n" + "-".repeat(60) + `\n${t}\n` + "-".repeat(60));

async function main() {
  const connection = new anchor.web3.Connection(RPC, "confirmed");
  const wallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(WALLET, "utf8"))));

  hr("0. Setup (single funded wallet, no airdrops)");
  const bal = await connection.getBalance(wallet.publicKey);
  console.log(`wallet: ${wallet.publicKey.toBase58()}  balance: ${(bal / 1e9).toFixed(3)} SOL`);
  if (bal < 0.4 * 1e9) {
    throw new Error(`insufficient balance (need >= ~0.5 SOL). Fund the address above at https://faucet.solana.com and retry.`);
  }
  const agent = Keypair.generate(); // only signs; wallet pays fees
  const beneficiary = Keypair.generate();
  const feeTreasury = Keypair.generate();
  console.log("agent:", agent.publicKey.toBase58());

  const program = makeProgram(connection, wallet);

  hr("1. Protocol Config");
  if (!(await program.account.config.fetchNullable(configPda()))) {
    await initializeConfig(program, wallet, FEE_BPS, feeTreasury.publicKey);
    console.log(`initialized: fee_bps=${FEE_BPS}, fee_treasury=${feeTreasury.publicKey.toBase58()}`);
  } else {
    console.log("Config already exists (reusing).");
  }

  hr("2. Main AI recommendation (Claude Code, falls back to local)");
  const rec = await getRecommendation({ region: "Amazon Basin", countryCode: "BR", budgetSol: BUDGET_SOL });
  console.log(`source: ${rec.source}  beneficiary org: ${rec.beneficiaryOrgName}  NDVI threshold: ${rec.ndviThresholdScaled / 1000}`);

  hr("3. Create project + escrow (real on-chain transactions)");
  const projectId = new BN(Date.now());
  const budget = sol(BUDGET_SOL);
  const project = await createProject(program, wallet, {
    projectId,
    countryCode: [0x42, 0x52],
    budget,
    recommendationHash: recommendationHash(rec),
    ndviThreshold: new BN(rec.ndviThresholdScaled),
    agentAuthority: agent.publicKey,
  });
  console.log("project:", exAddr(project.toBase58()));
  const fundSig = await fundProject(program, wallet, project, budget); // single contributor escrows the full budget
  console.log(`escrowed ${BUDGET_SOL} SOL -> ${exTx(fundSig)}`);

  hr("4. Agent releases by NDVI (real on-chain transactions)");
  const sbSig = await setBeneficiary(program, agent, project, beneficiary.publicKey);
  console.log(`set_beneficiary -> ${exTx(sbSig)}`);
  const ndvi = new SimulatedNdviOracle(250, 120);
  const threshold = rec.ndviThresholdScaled;
  let checkpoint = 0;
  for (let i = 0; i < rec.milestones.length; i++) {
    const p = await fetchProject(program, project);
    const remaining = (p.budget as any).sub(p.released);
    if (remaining.lten(0)) break;
    let amount =
      i === rec.milestones.length - 1
        ? remaining
        : budget.muln(Math.round(rec.milestones[i].fraction * 10000)).divn(10000);
    if (amount.gt(remaining)) amount = remaining;
    let reading = ndvi.read(checkpoint);
    while (reading < threshold && checkpoint < 24) {
      checkpoint++;
      reading = ndvi.read(checkpoint);
    }
    const sig = await release(program, agent, project, {
      amount,
      ndviDelta: new BN(reading),
      beneficiary: beneficiary.publicKey,
      feeTreasury: feeTreasury.publicKey,
    });
    console.log(`release milestone ${i + 1} ${(amount.toNumber() / 1e9).toFixed(4)} SOL (NDVI ${reading / 1000}) -> ${exTx(sig)}`);
    checkpoint++;
  }

  hr("5. Reconciliation");
  const f = await fetchProject(program, project);
  console.log(`released ${(f.released.toNumber() / 1e9).toFixed(4)} / budget ${BUDGET_SOL} SOL, status ${Object.keys(f.status)[0]}`);
  console.log("beneficiary:", exAddr(beneficiary.publicKey.toBase58()));
  console.log("vault:", exAddr(vaultPda(project).toBase58()));
  console.log("\nDevnet full flow complete with real transactions; all Explorer links above are verifiable live.");
}

main().then(() => process.exit(0), (e) => { console.error("\nFailed:", e.message || e); process.exit(1); });
