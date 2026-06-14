/**
 * Naura Solana Agent.
 *
 * The authorized agent (holding the agent_authority key) executes the main-AI recommendation:
 *   1. if the beneficiary is unset, set_beneficiary first;
 *   2. milestone by milestone, read NDVI and only release once it meets the on-chain threshold;
 *      otherwise wait (simulating vegetation recovery);
 *   3. once the budget is fully released, the project auto-completes.
 * The legality of each release is enforced on-chain by the contract (threshold/budget/authority/pause).
 */
import type { Program } from "@anchor-lang/core";
import type { Naura } from "../idl/naura";
import {
  BN,
  PublicKey,
  Keypair,
  type Pubkey,
  fetchProject,
  setBeneficiary,
  release,
} from "./naura";
import { SimulatedNdviOracle } from "./ndvi";
import type { Recommendation } from "./recommender";

export interface RunAgentParams {
  program: Program<Naura>;
  agent: Keypair;
  project: Pubkey;
  beneficiary: Pubkey; // beneficiary on-chain address (main-AI org -> resolved address)
  feeTreasury: Pubkey;
  recommendation: Recommendation;
  ndvi?: SimulatedNdviOracle;
  log?: (msg: string) => void;
}

const isCompleted = (status: any) => status && Object.keys(status)[0] === "completed";

/** Convert a budget fraction to an amount without floats: amount = budget * round(fraction*10000) / 10000 */
function fractionOf(budget: anchor_BN, fraction: number): anchor_BN {
  const bps = Math.max(0, Math.min(10000, Math.round(fraction * 10000)));
  return budget.muln(bps).divn(10000);
}
type anchor_BN = InstanceType<typeof BN>;

export async function runAgent(params: RunAgentParams): Promise<void> {
  const { program, agent, project, beneficiary, feeTreasury, recommendation } = params;
  const ndvi = params.ndvi ?? new SimulatedNdviOracle();
  const log = params.log ?? ((m: string) => console.log(m));
  const fmt = (lamports: anchor_BN) => (lamports.toNumber() / 1e9).toFixed(3);

  let proj = await fetchProject(program, project);

  // 1. Set the beneficiary.
  if (proj.beneficiary.equals(PublicKey.default)) {
    log(`[agent] set beneficiary: ${recommendation.beneficiaryOrgName} -> ${beneficiary.toBase58()}`);
    await setBeneficiary(program, agent, project, beneficiary);
  } else {
    log(`[agent] beneficiary already set: ${proj.beneficiary.toBase58()}`);
  }

  const budget = proj.budget as anchor_BN;
  const threshold = proj.ndviThreshold.toNumber();
  const milestones = recommendation.milestones;
  log(`[agent] budget ${fmt(budget)} SOL, NDVI threshold ${threshold / 1000}, ${milestones.length} milestones`);

  let checkpoint = 0;
  const MAX_CHECKPOINTS = 24;

  for (let i = 0; i < milestones.length; i++) {
    proj = await fetchProject(program, project);
    if (isCompleted(proj.status)) break;

    const released = proj.released as anchor_BN;
    const remaining = budget.sub(released);
    if (remaining.lten(0)) break;

    // Last milestone releases everything remaining, so the budget is fully released -> Completed.
    let amount = i === milestones.length - 1 ? remaining : fractionOf(budget, milestones[i].fraction);
    if (amount.gt(remaining)) amount = remaining;
    if (amount.lten(0)) continue;

    // Wait for NDVI to reach the threshold (simulating time progressing / vegetation recovery).
    let reading = ndvi.read(checkpoint);
    while (reading < threshold && checkpoint < MAX_CHECKPOINTS) {
      log(`   [wait] milestone ${i + 1} "${milestones[i].label}": NDVI ${reading / 1000} < threshold ${threshold / 1000}, waiting for vegetation recovery...`);
      checkpoint++;
      reading = ndvi.read(checkpoint);
    }

    log(`[release] milestone ${i + 1}/${milestones.length} "${milestones[i].label}": ${fmt(amount)} SOL (NDVI ${reading / 1000} >= ${threshold / 1000})`);
    await release(program, agent, project, {
      amount,
      ndviDelta: new BN(reading),
      beneficiary,
      feeTreasury,
    });
    checkpoint++;
  }

  proj = await fetchProject(program, project);
  log(
    `[agent] done: released ${fmt(proj.released as anchor_BN)} / budget ${fmt(budget)} SOL, status = ${Object.keys(proj.status)[0]}`
  );
}

// Minimal CLI when run directly (the agent is normally driven by the demo or a scheduler).
if (require.main === module) {
  console.error(
    [
      "Naura Agent — this module is meant to be called by the demo / a scheduler.",
      "Running it directly has no context. Run the end-to-end demo instead:",
      "  npm run demo",
      "or import { runAgent } from './agent/agent' in your orchestration code.",
    ].join("\n")
  );
  process.exit(1);
}
