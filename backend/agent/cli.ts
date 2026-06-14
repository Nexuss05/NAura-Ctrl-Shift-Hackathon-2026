/**
 * Naura Agent CLI — discrete tools for "Claude Code as the agent".
 *
 * Design intent: this software's Solana AI agent is, for the MVP, played directly by **Claude Code**.
 * Claude Code reads on-chain state / NDVI via the subcommands below, decides for itself, and executes
 * set_beneficiary / release. (runAgent in agent/agent.ts is the "deterministic auto-run" equivalent;
 * this CLI is the tool surface for "let Claude Code decide".)
 *
 * Commands:
 *   bootstrap                         spin up a funded demo project with agent_authority = this agent; print context
 *   config                            print the protocol Config
 *   status <project>                  print project status (JSON)
 *   ndvi <checkpoint>                 print simulated NDVI x 1000
 *   set-beneficiary <project> <pk>    set the beneficiary
 *   release <project> <amtSOL> <ndvi> <beneficiaryPk> <feeTreasuryPk>   release one milestone
 *
 * Env vars:
 *   ANCHOR_PROVIDER_URL  RPC (default http://localhost:8899)
 *   AGENT_KEYPAIR        agent keypair file path (default /tmp/naura-agent.json; the agent is also the fee payer)
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import * as anchor from "@anchor-lang/core";
import {
  makeProgram,
  configPda,
  fetchConfig,
  fetchProject,
  initializeConfig,
  createProject,
  fundProject,
  setBeneficiary,
  release,
  vaultPda,
  airdrop,
  sol,
  BN,
  Keypair,
  PublicKey,
} from "./naura";
import { SimulatedNdviOracle } from "./ndvi";
import { getRecommendation, recommendationHash } from "./recommender";

const RPC = process.env.ANCHOR_PROVIDER_URL || "http://localhost:8899";
const AGENT_PATH = process.env.AGENT_KEYPAIR || "/tmp/naura-agent.json";
const CTX_PATH = "/tmp/naura-agent-context.json";
const FEE_BPS = 50;

const conn = () => new anchor.web3.Connection(RPC, "confirmed");
const loadKp = (p: string): anchor.web3.Keypair =>
  Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(p, "utf8"))));
const saveKp = (p: string, kp: anchor.web3.Keypair) =>
  writeFileSync(p, JSON.stringify(Array.from(kp.secretKey)));
const lamportsToSol = (x: any) => Number(x) / 1e9;

function agentKeypair(): anchor.web3.Keypair {
  if (!existsSync(AGENT_PATH)) {
    const kp = Keypair.generate();
    saveKp(AGENT_PATH, kp);
    console.error(`[cli] generated new agent keypair -> ${AGENT_PATH} (${kp.publicKey.toBase58()})`);
  }
  return loadKp(AGENT_PATH);
}

async function cmdBootstrap() {
  const connection = conn();
  const agent = agentKeypair();
  await airdrop(connection, agent.publicKey, 2); // agent pays fees

  const operator = Keypair.generate(); // admin + funder + fee payer (init phase)
  const beneficiary = Keypair.generate();
  const feeTreasury = Keypair.generate();
  const c1 = Keypair.generate();
  const c2 = Keypair.generate();
  await airdrop(connection, operator.publicKey, 20);
  await airdrop(connection, c1.publicKey, 6);
  await airdrop(connection, c2.publicKey, 4);
  await airdrop(connection, beneficiary.publicKey, 0.1);
  await airdrop(connection, feeTreasury.publicKey, 0.1);

  const program = makeProgram(connection, operator);
  if (!(await program.account.config.fetchNullable(configPda()))) {
    await initializeConfig(program, operator, FEE_BPS, feeTreasury.publicKey);
  }

  const rec = await getRecommendation({ region: "Amazon Basin", countryCode: "BR", budgetSol: 6 });
  const projectId = new BN(Date.now());
  const project = await createProject(program, operator, {
    projectId,
    countryCode: [0x42, 0x52],
    budget: sol(6),
    recommendationHash: recommendationHash(rec),
    ndviThreshold: new BN(rec.ndviThresholdScaled),
    agentAuthority: agent.publicKey,
  });
  await fundProject(program, c1, project, sol(4));
  await fundProject(program, c2, project, sol(2));

  const ctx = {
    rpc: RPC,
    project: project.toBase58(),
    agentKeypair: AGENT_PATH,
    agentPubkey: agent.publicKey.toBase58(),
    beneficiary: beneficiary.publicKey.toBase58(),
    feeTreasury: feeTreasury.publicKey.toBase58(),
    recommendation: rec,
  };
  writeFileSync(CTX_PATH, JSON.stringify(ctx, null, 2));
  console.log(JSON.stringify(ctx, null, 2));
  console.error(`\n[cli] context written to ${CTX_PATH}. Claude Code can now act as the agent to drive releases.`);
}

async function cmdConfig() {
  const program = makeProgram(conn(), agentKeypair());
  const c = await fetchConfig(program);
  console.log(JSON.stringify(c ? {
    admin: c.admin.toBase58(), feeBps: c.feeBps, feeTreasury: c.feeTreasury.toBase58(), paused: c.paused,
  } : null, null, 2));
}

async function cmdStatus(projectStr: string) {
  const program = makeProgram(conn(), agentKeypair());
  const p = await fetchProject(program, new PublicKey(projectStr));
  if (!p) return console.log("null");
  const vaultBal = await conn().getBalance(vaultPda(new PublicKey(projectStr)));
  console.log(JSON.stringify({
    status: Object.keys(p.status)[0],
    budgetSol: lamportsToSol(p.budget),
    totalFundedSol: lamportsToSol(p.totalFunded),
    releasedSol: lamportsToSol(p.released),
    remainingSol: lamportsToSol(p.budget.sub(p.released)),
    ndviThreshold: p.ndviThreshold.toNumber() / 1000,
    ndviThresholdScaled: p.ndviThreshold.toNumber(),
    beneficiary: p.beneficiary.toBase58(),
    beneficiarySet: !p.beneficiary.equals(PublicKey.default),
    vaultBalanceSol: vaultBal / 1e9,
    agentAuthority: p.agentAuthority.toBase58(),
  }, null, 2));
}

function cmdNdvi(cp: string) {
  const oracle = new SimulatedNdviOracle();
  const scaled = oracle.read(parseInt(cp, 10));
  console.log(JSON.stringify({ checkpoint: parseInt(cp, 10), ndvi: scaled / 1000, ndviScaled: scaled }, null, 2));
}

async function cmdSetBeneficiary(projectStr: string, benStr: string) {
  const program = makeProgram(conn(), agentKeypair());
  await setBeneficiary(program, agentKeypair(), new PublicKey(projectStr), new PublicKey(benStr));
  console.log(`OK set_beneficiary -> ${benStr}`);
}

async function cmdRelease(projectStr: string, amtSol: string, ndvi: string, benStr: string, treStr: string) {
  const program = makeProgram(conn(), agentKeypair());
  await release(program, agentKeypair(), new PublicKey(projectStr), {
    amount: sol(parseFloat(amtSol)),
    ndviDelta: new BN(parseInt(ndvi, 10)),
    beneficiary: new PublicKey(benStr),
    feeTreasury: new PublicKey(treStr),
  });
  console.log(`OK release ${amtSol} SOL (ndvi=${parseInt(ndvi, 10) / 1000})`);
}

async function main() {
  const [cmd, ...a] = process.argv.slice(2);
  switch (cmd) {
    case "bootstrap": return cmdBootstrap();
    case "config": return cmdConfig();
    case "status": return cmdStatus(a[0]);
    case "ndvi": return cmdNdvi(a[0]);
    case "set-beneficiary": return cmdSetBeneficiary(a[0], a[1]);
    case "release": return cmdRelease(a[0], a[1], a[2], a[3], a[4]);
    default:
      console.error("usage: bootstrap | config | status <project> | ndvi <cp> | set-beneficiary <project> <pk> | release <project> <amtSOL> <ndvi> <benPk> <treasuryPk>");
      process.exit(1);
  }
}

main().then(() => process.exit(0), (e) => { console.error("ERR:", e.message || e); process.exit(1); });
