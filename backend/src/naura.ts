/**
 * Naura on-chain client wrapper (Node side, shared by the demos and any client).
 * Builds the Program with @anchor-lang/core and wraps PDA derivation + instruction calls.
 */
import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import type { Naura } from "../idl/naura";
import idl from "../idl/naura.json";

const { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } = anchor.web3;
const BN = anchor.BN;

export type Pubkey = anchor.web3.PublicKey;
export type Keypair = anchor.web3.Keypair;
export { BN, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL };

export const PROGRAM_ID = new PublicKey((idl as any).address);

/** Build the Program using the given payer keypair as the provider wallet (fee payer). */
export function makeProgram(connection: anchor.web3.Connection, payer: anchor.web3.Keypair): Program<Naura> {
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(payer), {
    commitment: "confirmed",
  });
  return new anchor.Program<Naura>(idl as anchor.Idl as Naura, provider);
}

// ---------------- PDA derivation ----------------
export const configPda = () => PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID)[0];

export const projectPda = (funder: Pubkey, projectId: anchor.BN) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("project"), funder.toBuffer(), projectId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  )[0];

export const vaultPda = (project: Pubkey) =>
  PublicKey.findProgramAddressSync([Buffer.from("vault"), project.toBuffer()], PROGRAM_ID)[0];

export const contributionPda = (project: Pubkey, contributor: Pubkey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("contribution"), project.toBuffer(), contributor.toBuffer()],
    PROGRAM_ID
  )[0];

// If the authority is not the provider wallet, it must be passed as an extra signer.
const extraSigners = (program: Program<Naura>, authority: anchor.web3.Keypair) =>
  authority.publicKey.equals(program.provider.publicKey!) ? [] : [authority];

// ---------------- reads ----------------
export const fetchConfig = (program: Program<Naura>) => program.account.config.fetch(configPda());
export const fetchProject = (program: Program<Naura>, project: Pubkey) =>
  program.account.project.fetch(project);
export const fetchProjectNullable = (program: Program<Naura>, project: Pubkey) =>
  program.account.project.fetchNullable(project);

// ---------------- writes ----------------
export async function initializeConfig(
  program: Program<Naura>,
  admin: anchor.web3.Keypair,
  feeBps: number,
  feeTreasury: Pubkey
) {
  return program.methods
    .initializeConfig(feeBps, feeTreasury)
    .accountsPartial({ config: configPda(), admin: admin.publicKey, systemProgram: SystemProgram.programId })
    .signers(extraSigners(program, admin))
    .rpc();
}

export async function createProject(
  program: Program<Naura>,
  funder: anchor.web3.Keypair,
  p: {
    projectId: anchor.BN;
    countryCode: number[]; // length 2
    budget: anchor.BN;
    recommendationHash: number[]; // length 32
    ndviThreshold: anchor.BN;
    agentAuthority: Pubkey;
  }
) {
  const project = projectPda(funder.publicKey, p.projectId);
  await program.methods
    .createProject(p.projectId, p.countryCode, p.budget, p.recommendationHash, p.ndviThreshold, p.agentAuthority)
    .accountsPartial({
      config: configPda(),
      project,
      vault: vaultPda(project),
      funder: funder.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers(extraSigners(program, funder))
    .rpc();
  return project;
}

export async function fundProject(
  program: Program<Naura>,
  contributor: anchor.web3.Keypair,
  project: Pubkey,
  amount: anchor.BN
) {
  return program.methods
    .fundProject(amount)
    .accountsPartial({
      config: configPda(),
      project,
      vault: vaultPda(project),
      contribution: contributionPda(project, contributor.publicKey),
      contributor: contributor.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers(extraSigners(program, contributor))
    .rpc();
}

export async function setBeneficiary(
  program: Program<Naura>,
  authority: anchor.web3.Keypair,
  project: Pubkey,
  beneficiary: Pubkey
) {
  return program.methods
    .setBeneficiary(beneficiary)
    .accountsPartial({ config: configPda(), project, agentAuthority: authority.publicKey })
    .signers(extraSigners(program, authority))
    .rpc();
}

export async function release(
  program: Program<Naura>,
  authority: anchor.web3.Keypair,
  project: Pubkey,
  args: { amount: anchor.BN; ndviDelta: anchor.BN; beneficiary: Pubkey; feeTreasury: Pubkey }
) {
  return program.methods
    .release(args.amount, args.ndviDelta)
    .accountsPartial({
      config: configPda(),
      project,
      vault: vaultPda(project),
      agentAuthority: authority.publicKey,
      beneficiary: args.beneficiary,
      feeTreasury: args.feeTreasury,
    })
    .signers(extraSigners(program, authority))
    .rpc();
}

/** Helper: airdrop and confirm. */
export async function airdrop(connection: anchor.web3.Connection, pubkey: Pubkey, sol: number) {
  const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  const bh = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
}

export const sol = (n: number) => new BN(Math.round(n * LAMPORTS_PER_SOL));
