/**
 * Naura end-to-end demo (localnet) — user-controlled escrow.
 *
 * The full flow with a human in control of every payout (no AI, no autonomous agent):
 *   admin initializes the protocol -> contributors escrow SOL into a project (multi-party)
 *   -> the operator sets the beneficiary org and approves each milestone release after reviewing
 *      the NDVI reading -> once the budget is fully released, the project completes.
 * The contract still enforces the rules on-chain (NDVI threshold, budget cap, authority, pause);
 * a person decides whether and when to pay.
 *
 * Prereq: a local validator with the program deployed (./scripts/localnet-up.sh, or
 * `solana-test-validator ... --bpf-program <id> target/deploy/naura.so`).
 */
import { createHash } from "crypto";
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
  airdrop,
  sol,
  BN,
  Keypair,
} from "../src/naura";
import { SimulatedNdviOracle } from "../src/ndvi";

const FEE_BPS = 50; // 0.5%
const RPC = process.env.ANCHOR_PROVIDER_URL || "http://localhost:8899";

// What the user picked in the app: beneficiary org, success threshold, and how to split the budget.
const PLAN = {
  beneficiaryOrgName: "Amazon Basin Reforestation Trust",
  ndviThresholdScaled: 300, // 0.300, NDVI x 1000
  milestones: [
    { label: "Seedling planting & registration", fraction: 0.4 },
    { label: "6-month survival verification", fraction: 0.35 },
    { label: "12-month canopy verification", fraction: 0.25 },
  ],
};
// Anchor a hash of the user's plan on-chain (integrity / audit) — no AI involved.
const planHash = (): number[] => Array.from(createHash("sha256").update(JSON.stringify(PLAN)).digest());

function hr(title: string) {
  console.log("\n" + "-".repeat(64) + `\n${title}\n` + "-".repeat(64));
}

async function main() {
  const connection = new anchor.web3.Connection(RPC, "confirmed");
  const bal = (pk: anchor.web3.PublicKey) => connection.getBalance(pk);

  // The operator is the human funder AND the release authority — the user decides payouts.
  const operator = Keypair.generate();
  const beneficiary = Keypair.generate();
  const feeTreasury = Keypair.generate();
  const c1 = Keypair.generate();
  const c2 = Keypair.generate();

  hr("0. Setup: airdrop the roles");
  await airdrop(connection, operator.publicKey, 20);
  await airdrop(connection, c1.publicKey, 6);
  await airdrop(connection, c2.publicKey, 4);
  await airdrop(connection, beneficiary.publicKey, 0.1); // ensure the account exists
  await airdrop(connection, feeTreasury.publicKey, 0.1);
  console.log("operator (admin/funder/authority):", operator.publicKey.toBase58());
  console.log("beneficiary:", beneficiary.publicKey.toBase58());

  const program = makeProgram(connection, operator);

  hr("1. Initialize protocol Config (admin)");
  if (!(await program.account.config.fetchNullable(configPda()))) {
    await initializeConfig(program, operator, FEE_BPS, feeTreasury.publicKey);
    console.log(`Config initialized: fee_bps=${FEE_BPS} (0.5%), fee_treasury=${feeTreasury.publicKey.toBase58()}`);
  } else {
    console.log("Config already exists, skipping init (note: an existing fee_treasury may differ).");
  }

  hr("2. The user chooses the plan (org / threshold / milestones)");
  console.log(`beneficiary org: ${PLAN.beneficiaryOrgName}`);
  console.log(`NDVI threshold: ${PLAN.ndviThresholdScaled / 1000}`);
  console.log("milestones:", PLAN.milestones.map((m) => `${m.label} (${(m.fraction * 100).toFixed(0)}%)`).join(" / "));

  hr("3. Contributors create the project + escrow (multi-party funding)");
  const projectId = new BN(Date.now()); // unique id to avoid collisions across reruns
  const budgetSol = 6;
  const budget = sol(budgetSol);
  const project = await createProject(program, operator, {
    projectId,
    countryCode: [0x42, 0x52], // "BR"
    budget,
    recommendationHash: planHash(), // the contract field stores the user's plan hash
    ndviThreshold: new BN(PLAN.ndviThresholdScaled),
    agentAuthority: operator.publicKey, // the USER is the release authority
  });
  console.log("project PDA:", project.toBase58());
  console.log("vault PDA:", vaultPda(project).toBase58());

  await fundProject(program, c1, project, sol(4));
  console.log("contributor #1 funded 4 SOL");
  await fundProject(program, c2, project, sol(2));
  console.log("contributor #2 funded 2 SOL");
  const p1 = await fetchProject(program, project);
  console.log(`total_funded = ${(p1.totalFunded.toNumber() / 1e9).toFixed(2)} SOL`);

  hr("4. The user approves releases milestone by milestone");
  // The operator picks the beneficiary org address, then approves each milestone after reviewing
  // the NDVI reading. The contract rejects a release if NDVI is below the threshold or over budget.
  await setBeneficiary(program, operator, project, beneficiary.publicKey);
  console.log(`beneficiary set -> ${beneficiary.publicKey.toBase58()}`);
  const beneBefore = await bal(beneficiary.publicKey);
  const treBefore = await bal(feeTreasury.publicKey);

  const ndviFeed = new SimulatedNdviOracle(250, 120); // informational reading the user reviews
  const threshold = PLAN.ndviThresholdScaled;
  let checkpoint = 0;
  for (let i = 0; i < PLAN.milestones.length; i++) {
    const p = await fetchProject(program, project);
    const remaining = (p.budget as any).sub(p.released);
    if (remaining.lten(0)) break;
    let amount =
      i === PLAN.milestones.length - 1
        ? remaining // last milestone releases everything remaining -> Completed
        : budget.muln(Math.round(PLAN.milestones[i].fraction * 10000)).divn(10000);
    if (amount.gt(remaining)) amount = remaining;

    // The user waits until the NDVI reading shows enough vegetation recovery, then approves.
    let reading = ndviFeed.read(checkpoint);
    while (reading < threshold && checkpoint < 24) {
      checkpoint++;
      reading = ndviFeed.read(checkpoint);
    }
    console.log(
      `   user reviews milestone ${i + 1} "${PLAN.milestones[i].label}": NDVI ${reading / 1000} >= ${threshold / 1000} -> approves`
    );
    await release(program, operator, project, {
      amount,
      ndviDelta: new BN(reading),
      beneficiary: beneficiary.publicKey,
      feeTreasury: feeTreasury.publicKey,
    });
    console.log(`   released ${(amount.toNumber() / 1e9).toFixed(3)} SOL`);
    checkpoint++;
  }

  hr("5. Reconciliation");
  const beneAfter = await bal(beneficiary.publicKey);
  const treAfter = await bal(feeTreasury.publicKey);
  const finalProj = await fetchProject(program, project);
  const fee = budget.muln(FEE_BPS).divn(10000);
  console.log(`beneficiary received: ${((beneAfter - beneBefore) / 1e9).toFixed(4)} SOL (= budget - fee)`);
  console.log(`fee_treasury received: ${((treAfter - treBefore) / 1e9).toFixed(4)} SOL (expected ${(fee.toNumber() / 1e9).toFixed(4)})`);
  console.log(`released = ${(finalProj.released.toNumber() / 1e9).toFixed(4)} / budget ${budgetSol} SOL`);
  console.log(`project status: ${Object.keys(finalProj.status)[0]}`);
  console.log("\nDemo complete: user-controlled escrow -> multi-party funding -> user-approved milestone releases -> completion.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("\nDemo failed:", err);
    process.exit(1);
  }
);
