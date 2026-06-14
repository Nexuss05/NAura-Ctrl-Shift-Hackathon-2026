/**
 * Naura end-to-end demo (localnet).
 *
 * Ties the full product story together:
 *   main AI recommends a plan (Claude Code) -> contributors create a project and escrow SOL (multi-party)
 *   -> the Solana Agent releases funds in milestones by NDVI progress -> the project auto-completes.
 *
 * Prereq: a local validator is running with the program deployed (the one started by
 * ./scripts/localnet-up.sh, or `solana-test-validator ... --bpf-program <id> target/deploy/naura.so`).
 */
import * as anchor from "@anchor-lang/core";
import {
  makeProgram,
  configPda,
  projectPda,
  vaultPda,
  fetchProject,
  initializeConfig,
  createProject,
  fundProject,
  airdrop,
  sol,
  BN,
  Keypair,
  PublicKey,
} from "../agent/naura";
import { getRecommendation, recommendationHash } from "../agent/recommender";
import { SimulatedNdviOracle } from "../agent/ndvi";
import { runAgent } from "../agent/agent";

const FEE_BPS = 50; // 0.5%
const RPC = process.env.ANCHOR_PROVIDER_URL || "http://localhost:8899";

function hr(title: string) {
  console.log("\n" + "-".repeat(64) + `\n${title}\n` + "-".repeat(64));
}

async function main() {
  const connection = new anchor.web3.Connection(RPC, "confirmed");
  const bal = (pk: anchor.web3.PublicKey) => connection.getBalance(pk);

  // Role keypairs
  const operator = Keypair.generate(); // doubles as admin + funder + fee payer
  const agent = Keypair.generate(); // the authorized Solana agent
  const beneficiary = Keypair.generate(); // beneficiary on-chain address
  const feeTreasury = Keypair.generate(); // protocol fee recipient
  const c1 = Keypair.generate();
  const c2 = Keypair.generate();

  hr("0. Setup: airdrop the roles");
  await airdrop(connection, operator.publicKey, 20);
  await airdrop(connection, c1.publicKey, 6);
  await airdrop(connection, c2.publicKey, 4);
  await airdrop(connection, beneficiary.publicKey, 0.1); // ensure the account exists
  await airdrop(connection, feeTreasury.publicKey, 0.1);
  console.log("operator (admin/funder):", operator.publicKey.toBase58());
  console.log("agent:", agent.publicKey.toBase58());
  console.log("beneficiary:", beneficiary.publicKey.toBase58());

  const program = makeProgram(connection, operator);

  hr("1. Initialize protocol Config (admin)");
  if (!(await program.account.config.fetchNullable(configPda()))) {
    await initializeConfig(program, operator, FEE_BPS, feeTreasury.publicKey);
    console.log(`Config initialized: fee_bps=${FEE_BPS} (0.5%), fee_treasury=${feeTreasury.publicKey.toBase58()}`);
  } else {
    console.log("Config already exists, skipping init (note: an existing fee_treasury may differ).");
  }

  hr("2. Main AI recommends a plan (Claude Code)");
  const region = "Amazon Basin";
  const budgetSol = 6;
  const rec = await getRecommendation({ region, countryCode: "BR", budgetSol });
  console.log(`source: ${rec.source === "claude-code" ? "Claude Code" : "local planner (fallback)"}`);
  console.log(`beneficiary org: ${rec.beneficiaryOrgName}`);
  console.log(`NDVI threshold: ${rec.ndviThresholdScaled / 1000}`);
  console.log("milestones:", rec.milestones.map((m) => `${m.label} (${(m.fraction * 100).toFixed(0)}%)`).join(" / "));
  console.log("rationale:", rec.rationale);

  hr("3. Contributors create the project + escrow (multi-party funding)");
  const projectId = new BN(Date.now()); // unique id to avoid collisions across reruns
  const budget = sol(budgetSol);
  const countryCode = [0x42, 0x52]; // "BR"
  const project = await createProject(program, operator, {
    projectId,
    countryCode,
    budget,
    recommendationHash: recommendationHash(rec), // anchor the AI plan hash on-chain
    ndviThreshold: new BN(rec.ndviThresholdScaled),
    agentAuthority: agent.publicKey,
  });
  console.log("project PDA:", project.toBase58());
  console.log("vault PDA:", vaultPda(project).toBase58());

  await fundProject(program, c1, project, sol(4));
  console.log("contributor #1 funded 4 SOL");
  await fundProject(program, c2, project, sol(2));
  console.log("contributor #2 funded 2 SOL");
  const p1 = await fetchProject(program, project);
  console.log(`total_funded = ${(p1.totalFunded.toNumber() / 1e9).toFixed(2)} SOL`);

  hr("4. Solana Agent releases by NDVI progress");
  const beneBefore = await bal(beneficiary.publicKey);
  const treBefore = await bal(feeTreasury.publicKey);
  await runAgent({
    program,
    agent,
    project,
    beneficiary: beneficiary.publicKey,
    feeTreasury: feeTreasury.publicKey,
    recommendation: rec,
    ndvi: new SimulatedNdviOracle(250, 120), // 0.250 base, +0.120 per checkpoint
  });

  hr("5. Reconciliation");
  const beneAfter = await bal(beneficiary.publicKey);
  const treAfter = await bal(feeTreasury.publicKey);
  const finalProj = await fetchProject(program, project);
  const fee = budget.muln(FEE_BPS).divn(10000);
  console.log(`beneficiary received: ${((beneAfter - beneBefore) / 1e9).toFixed(4)} SOL (= budget - fee)`);
  console.log(`fee_treasury received: ${((treAfter - treBefore) / 1e9).toFixed(4)} SOL (expected ${(fee.toNumber() / 1e9).toFixed(4)})`);
  console.log(`released = ${(finalProj.released.toNumber() / 1e9).toFixed(4)} / budget ${budgetSol} SOL`);
  console.log(`project status: ${Object.keys(finalProj.status)[0]}`);
  console.log("\nDemo complete: main AI recommendation -> escrow -> agent controlled release -> auto-complete, full flow working.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("\nDemo failed:", err);
    process.exit(1);
  }
);
