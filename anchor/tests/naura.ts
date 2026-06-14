/**
 * Naura v2 escrow protocol — localnet integration tests (native SOL).
 *
 * provider.wallet doubles as admin and funder; agent / wrongAgent / contributors /
 * beneficiaries / fee_treasury / recipient are independent keypairs. Each case uses an
 * increasing project_id.
 *
 * Covers: config (initialize / update / set_paused incl. non-admin rejected), happy path
 * (multi-contributor funding + multi-milestone release + fee split), boundary failures
 * (Unauthorized / ExceedsBudget / ImpactTooLow / BeneficiaryNotSet / Paused), cancel +
 * proportional refund (incl. double-refund rejected), close (Completed/Cancelled rent reclaim),
 * and emergency withdraw.
 */
import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { assert } from "chai";
import type { Naura } from "../target/types/naura";
import idl from "../target/idl/naura.json";

const { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } = anchor.web3;
const BN = anchor.BN;
type PublicKey = anchor.web3.PublicKey;
type Keypair = anchor.web3.Keypair;

const FEE_BPS = 50; // 0.5%

describe("naura", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new anchor.Program<Naura>(idl as anchor.Idl as Naura, provider);
  const connection = provider.connection;

  // provider wallet = admin = funder
  const admin = (provider.wallet as anchor.Wallet).payer;
  const funder = admin;

  let feeTreasury: anchor.web3.Keypair;
  const configPda = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId)[0];

  // ---------- PDA derivation ----------
  const projectPda = (funderPk: anchor.web3.PublicKey, projectId: anchor.BN) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("project"), funderPk.toBuffer(), projectId.toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];
  const vaultPda = (project: anchor.web3.PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("vault"), project.toBuffer()], program.programId)[0];
  const contributionPda = (project: anchor.web3.PublicKey, contributor: anchor.web3.PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("contribution"), project.toBuffer(), contributor.toBuffer()],
      program.programId
    )[0];

  // ---------- helpers ----------
  const sol = (n: number) => new BN(Math.round(n * LAMPORTS_PER_SOL));
  const feeOf = (amount: anchor.BN) => amount.muln(FEE_BPS).divn(10000);

  async function airdrop(pubkey: anchor.web3.PublicKey, solAmount: number) {
    const sig = await connection.requestAirdrop(pubkey, solAmount * LAMPORTS_PER_SOL);
    const bh = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  }
  async function newFundedKeypair(solAmount: number) {
    const kp = Keypair.generate();
    await airdrop(kp.publicKey, solAmount);
    return kp;
  }
  const bal = (pk: anchor.web3.PublicKey) => connection.getBalance(pk);

  async function setPaused(paused: boolean, signer = admin) {
    await program.methods
      .setPaused(paused)
      .accountsPartial({ config: configPda, admin: signer.publicKey })
      .signers(signer === admin ? [] : [signer])
      .rpc();
  }

  // Create a project (funder = provider). Returns the PDAs.
  async function createProject(opts: {
    projectId: number;
    budget: anchor.BN;
    ndviThreshold: number;
    agent: anchor.web3.Keypair;
  }) {
    const projectId = new BN(opts.projectId);
    const project = projectPda(funder.publicKey, projectId);
    const vault = vaultPda(project);
    await program.methods
      .createProject(
        projectId,
        [0x42, 0x52], // "BR"
        opts.budget,
        Array(32).fill(7),
        new BN(opts.ndviThreshold),
        opts.agent.publicKey
      )
      .accountsPartial({
        config: configPda,
        project,
        vault,
        funder: funder.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return { projectId, project, vault };
  }

  async function fund(project: anchor.web3.PublicKey, vault: anchor.web3.PublicKey, contributor: anchor.web3.Keypair, amount: anchor.BN) {
    await program.methods
      .fundProject(amount)
      .accountsPartial({
        config: configPda,
        project,
        vault,
        contribution: contributionPda(project, contributor.publicKey),
        contributor: contributor.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([contributor])
      .rpc();
  }

  async function setBeneficiary(project: anchor.web3.PublicKey, agent: anchor.web3.Keypair, beneficiary: anchor.web3.PublicKey) {
    await program.methods
      .setBeneficiary(beneficiary)
      .accountsPartial({ config: configPda, project, agentAuthority: agent.publicKey })
      .signers([agent])
      .rpc();
  }

  function releaseBuilder(
    project: anchor.web3.PublicKey,
    vault: anchor.web3.PublicKey,
    agent: anchor.web3.Keypair,
    beneficiary: anchor.web3.PublicKey,
    amount: anchor.BN,
    ndviDelta: number
  ) {
    return program.methods
      .release(amount, new BN(ndviDelta))
      .accountsPartial({
        config: configPda,
        project,
        vault,
        agentAuthority: agent.publicKey,
        beneficiary,
        feeTreasury: feeTreasury.publicKey,
      })
      .signers([agent]);
  }

  // ---------- global setup ----------
  before(async () => {
    await airdrop(funder.publicKey, 50);
    feeTreasury = await newFundedKeypair(1);
    // Idempotent config init (safe to re-run against the same validator).
    const existing = await program.account.config.fetchNullable(configPda);
    if (!existing) {
      await program.methods
        .initializeConfig(FEE_BPS, feeTreasury.publicKey)
        .accountsPartial({ config: configPda, admin: admin.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
    }
  });

  // ============================ Config ============================

  it("initialize_config: admin/fee/treasury correct, not paused", async () => {
    const cfg = await program.account.config.fetch(configPda);
    assert.ok(cfg.admin.equals(admin.publicKey));
    assert.equal(cfg.feeBps, FEE_BPS);
    assert.ok(cfg.feeTreasury.equals(feeTreasury.publicKey));
    assert.equal(cfg.paused, false);
  });

  it("update_config: admin changes fee_bps then restores it", async () => {
    await program.methods
      .updateConfig(100, null, null)
      .accountsPartial({ config: configPda, admin: admin.publicKey })
      .rpc();
    assert.equal((await program.account.config.fetch(configPda)).feeBps, 100);
    // Restore to 50 so later fee assertions hold.
    await program.methods
      .updateConfig(FEE_BPS, null, null)
      .accountsPartial({ config: configPda, admin: admin.publicKey })
      .rpc();
    assert.equal((await program.account.config.fetch(configPda)).feeBps, FEE_BPS);
  });

  it("set_paused: non-admin -> NotAdmin; admin can pause/unpause", async () => {
    const wrongAdmin = await newFundedKeypair(1);
    await expectError(setPaused(true, wrongAdmin), "NotAdmin");

    await setPaused(true);
    assert.equal((await program.account.config.fetch(configPda)).paused, true);
    await setPaused(false);
    assert.equal((await program.account.config.fetch(configPda)).paused, false);
  });

  // ============================ Happy path ============================

  it("happy path: create -> multi-fund -> set_beneficiary -> multi-release -> Completed -> close", async () => {
    const agent = await newFundedKeypair(2);
    const c1 = await newFundedKeypair(2);
    const c2 = await newFundedKeypair(2);
    const beneficiary = await newFundedKeypair(0.1);

    const budget = sol(2);
    const { project, vault } = await createProject({ projectId: 1, budget, ndviThreshold: 300, agent });

    // Two contributors fund 1 SOL each.
    await fund(project, vault, c1, sol(1));
    await fund(project, vault, c2, sol(1));
    let p = await program.account.project.fetch(project);
    assert.equal(p.totalFunded.toString(), sol(2).toString());

    await setBeneficiary(project, agent, beneficiary.publicKey);
    p = await program.account.project.fetch(project);
    assert.ok(p.beneficiary.equals(beneficiary.publicKey));

    // Two releases, 1 SOL each.
    for (let i = 0; i < 2; i++) {
      const amount = sol(1);
      const fee = feeOf(amount);
      const toBene = amount.sub(fee);
      const beneBefore = await bal(beneficiary.publicKey);
      const treBefore = await bal(feeTreasury.publicKey);

      await releaseBuilder(project, vault, agent, beneficiary.publicKey, amount, 450).rpc();

      assert.equal((await bal(beneficiary.publicKey)) - beneBefore, toBene.toNumber(), "beneficiary receives amount-fee");
      assert.equal((await bal(feeTreasury.publicKey)) - treBefore, fee.toNumber(), "fee_treasury receives fee");
    }

    p = await program.account.project.fetch(project);
    assert.equal(p.released.toString(), budget.toString(), "released == budget");
    assert.deepEqual(p.status, { completed: {} }, "fully released -> Completed");

    // Vault holds only rent -> close, rent back to funder, accounts gone.
    await program.methods
      .closeProject()
      .accountsPartial({ config: configPda, project, vault, funder: funder.publicKey, authority: funder.publicKey })
      .rpc();
    assert.isNull(await program.account.project.fetchNullable(project), "project closed");
    assert.isNull(await connection.getAccountInfo(vault), "vault closed");
  });

  // ============================ Boundary failures ============================

  it("release by non-agent -> Unauthorized", async () => {
    const agent = await newFundedKeypair(1);
    const wrongAgent = await newFundedKeypair(1);
    const beneficiary = await newFundedKeypair(0.1);
    const { project, vault } = await createProject({ projectId: 2, budget: sol(2), ndviThreshold: 300, agent });
    await fund(project, vault, await newFundedKeypair(3), sol(2));
    await setBeneficiary(project, agent, beneficiary.publicKey);

    await expectError(
      releaseBuilder(project, vault, wrongAgent, beneficiary.publicKey, sol(1), 450).rpc(),
      "Unauthorized"
    );
  });

  it("release over budget -> ExceedsBudget", async () => {
    const agent = await newFundedKeypair(1);
    const beneficiary = await newFundedKeypair(0.1);
    const { project, vault } = await createProject({ projectId: 3, budget: sol(1), ndviThreshold: 300, agent });
    await fund(project, vault, await newFundedKeypair(2), sol(1));
    await setBeneficiary(project, agent, beneficiary.publicKey);

    await expectError(
      releaseBuilder(project, vault, agent, beneficiary.publicKey, sol(2), 450).rpc(), // 2 > budget 1
      "ExceedsBudget"
    );
  });

  it("ndvi_delta below threshold -> ImpactTooLow", async () => {
    const agent = await newFundedKeypair(1);
    const beneficiary = await newFundedKeypair(0.1);
    const { project, vault } = await createProject({ projectId: 4, budget: sol(2), ndviThreshold: 500, agent });
    await fund(project, vault, await newFundedKeypair(3), sol(2));
    await setBeneficiary(project, agent, beneficiary.publicKey);

    await expectError(
      releaseBuilder(project, vault, agent, beneficiary.publicKey, sol(1), 499).rpc(), // 499 < 500
      "ImpactTooLow"
    );
  });

  it("release before set_beneficiary -> BeneficiaryNotSet", async () => {
    const agent = await newFundedKeypair(1);
    const beneficiary = await newFundedKeypair(0.1); // passed in, but not set on the project
    const { project, vault } = await createProject({ projectId: 5, budget: sol(2), ndviThreshold: 300, agent });
    await fund(project, vault, await newFundedKeypair(3), sol(2));

    await expectError(
      releaseBuilder(project, vault, agent, beneficiary.publicKey, sol(1), 450).rpc(),
      "BeneficiaryNotSet"
    );
  });

  it("fund / release while paused -> Paused", async () => {
    const agent = await newFundedKeypair(1);
    const beneficiary = await newFundedKeypair(0.1);
    const c = await newFundedKeypair(2);
    const { project, vault } = await createProject({ projectId: 6, budget: sol(2), ndviThreshold: 300, agent });
    await fund(project, vault, c, sol(1));
    await setBeneficiary(project, agent, beneficiary.publicKey);

    await setPaused(true);
    try {
      await expectError(fund(project, vault, c, sol(1)), "Paused");
      await expectError(
        releaseBuilder(project, vault, agent, beneficiary.publicKey, sol(1), 450).rpc(),
        "Paused"
      );
    } finally {
      await setPaused(false);
    }
  });

  it("fund over budget -> ExceedsBudget", async () => {
    const agent = await newFundedKeypair(1);
    const c = await newFundedKeypair(3);
    const { project, vault } = await createProject({ projectId: 9, budget: sol(1), ndviThreshold: 300, agent });
    await fund(project, vault, c, sol(1)); // fund up to the budget cap, OK
    await expectError(fund(project, vault, c, sol(0.5)), "ExceedsBudget"); // further funding over the cap -> rejected
  });

  // ============================ Cancel & refund ============================

  it("cancel -> proportional refund (2 contributors) -> double refund rejected -> close", async () => {
    const agent = await newFundedKeypair(1);
    const beneficiary = await newFundedKeypair(0.1);
    const c1 = await newFundedKeypair(3); // funds 2
    const c2 = await newFundedKeypair(2); // funds 1
    const { project, vault } = await createProject({ projectId: 7, budget: sol(3), ndviThreshold: 300, agent });
    await fund(project, vault, c1, sol(2));
    await fund(project, vault, c2, sol(1)); // total_funded = 3
    await setBeneficiary(project, agent, beneficiary.publicKey);

    // Release 1.5 SOL first so remaining = 1.5; proportional refunds: c1 -> 1.0, c2 -> 0.5.
    await releaseBuilder(project, vault, agent, beneficiary.publicKey, sol(1.5), 450).rpc();

    // Cancel (funder).
    await program.methods
      .cancelProject()
      .accountsPartial({ config: configPda, project, authority: funder.publicKey })
      .rpc();
    assert.deepEqual((await program.account.project.fetch(project)).status, { cancelled: {} });

    const refundOf = async (contributor: anchor.web3.Keypair) => {
      const before = await bal(contributor.publicKey);
      await program.methods
        .refund()
        .accountsPartial({
          project,
          vault,
          contribution: contributionPda(project, contributor.publicKey),
          contributor: contributor.publicKey,
          payer: funder.publicKey, // permissionless: provider pays the tx fee
        })
        .rpc();
      return (await bal(contributor.publicKey)) - before;
    };

    assert.equal(await refundOf(c1), sol(1.0).toNumber(), "c1 proportional refund 1.0 SOL");
    assert.equal(await refundOf(c2), sol(0.5).toNumber(), "c2 proportional refund 0.5 SOL");

    // Double refund -> AlreadyRefunded.
    await expectError(
      program.methods
        .refund()
        .accountsPartial({
          project,
          vault,
          contribution: contributionPda(project, c1.publicKey),
          contributor: c1.publicKey,
          payer: funder.publicKey,
        })
        .rpc(),
      "AlreadyRefunded"
    );

    // Vault drained -> close.
    await program.methods
      .closeProject()
      .accountsPartial({ config: configPda, project, vault, funder: funder.publicKey, authority: funder.publicKey })
      .rpc();
    assert.isNull(await program.account.project.fetchNullable(project), "cancelled project closed");
  });

  // ============================ Emergency withdraw ============================

  it("admin emergency_withdraw succeeds while paused; non-admin rejected", async () => {
    const agent = await newFundedKeypair(1);
    const recipient = await newFundedKeypair(0.1);
    const { project, vault } = await createProject({ projectId: 8, budget: sol(2), ndviThreshold: 300, agent });
    await fund(project, vault, await newFundedKeypair(2), sol(1)); // vault escrows 1 SOL

    await setPaused(true);
    try {
      const wrongAdmin = await newFundedKeypair(1);
      await expectError(
        program.methods
          .emergencyWithdraw()
          .accountsPartial({ config: configPda, project, vault, admin: wrongAdmin.publicKey, recipient: recipient.publicKey })
          .signers([wrongAdmin])
          .rpc(),
        "NotAdmin"
      );

      const before = await bal(recipient.publicKey);
      await program.methods
        .emergencyWithdraw()
        .accountsPartial({ config: configPda, project, vault, admin: admin.publicKey, recipient: recipient.publicKey })
        .rpc();
      assert.equal((await bal(recipient.publicKey)) - before, sol(1).toNumber(), "recipient receives the full vault escrow");
    } finally {
      await setPaused(false);
    }
  });
});

/** Assert a call throws an error containing the given anchor error code. */
async function expectError(p: Promise<unknown>, code: string) {
  try {
    await p;
    assert.fail(`expected to throw ${code}, but the call succeeded`);
  } catch (err: any) {
    const got = err?.error?.errorCode?.code ?? String(err);
    assert.include(String(got), code, `expected error ${code}, got: ${got}`);
  }
}
