const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const FEE_BPS = 50; // 0.5%
const NDVI_THRESHOLD = 300n; // 0.300 x1000
const COUNTRY = "0x4252"; // "BR"
const PLAN_HASH = ethers.id("amazon-basin-plan"); // bytes32
const E = (n) => ethers.parseEther(String(n));

async function deployFixture() {
  const [admin, funder, c2, authority, beneficiary, treasury, other] = await ethers.getSigners();
  const Naura = await ethers.getContractFactory("NauraEscrow");
  const naura = await Naura.connect(admin).deploy(FEE_BPS, treasury.address);
  await naura.waitForDeployment();
  return { naura, admin, funder, c2, authority, beneficiary, treasury, other };
}

async function createProject(naura, funder, authority, budget = E(6), ndvi = NDVI_THRESHOLD) {
  const tx = await naura.connect(funder).createProject(COUNTRY, budget, PLAN_HASH, ndvi, authority.address);
  const rc = await tx.wait();
  const ev = rc.logs
    .map((l) => {
      try {
        return naura.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e) => e && e.name === "ProjectCreated");
  return ev.args.id;
}

describe("NauraEscrow", () => {
  it("1. deploys with fee + treasury (config)", async () => {
    const { naura, treasury } = await loadFixture(deployFixture);
    expect(await naura.feeBps()).to.equal(FEE_BPS);
    expect(await naura.feeTreasury()).to.equal(treasury.address);
    expect(await naura.paused()).to.equal(false);
  });

  it("2. rejects a constructor fee above the 10% cap", async () => {
    const { treasury } = await loadFixture(deployFixture);
    const Naura = await ethers.getContractFactory("NauraEscrow");
    await expect(Naura.deploy(1001, treasury.address)).to.be.revertedWithCustomError(Naura, "InvalidFeeBps");
  });

  it("3. creates a project and stores its fields", async () => {
    const { naura, funder, authority } = await loadFixture(deployFixture);
    const id = await createProject(naura, funder, authority);
    const p = await naura.getProject(id);
    expect(p.funder).to.equal(funder.address);
    expect(p.authority).to.equal(authority.address);
    expect(p.budget).to.equal(E(6));
    expect(p.ndviThreshold).to.equal(NDVI_THRESHOLD);
    expect(p.status).to.equal(0n); // Active
  });

  it("4. rejects invalid create params (budget 0, ndvi out of range, zero authority)", async () => {
    const { naura, funder, authority } = await loadFixture(deployFixture);
    await expect(
      naura.connect(funder).createProject(COUNTRY, 0, PLAN_HASH, NDVI_THRESHOLD, authority.address)
    ).to.be.revertedWithCustomError(naura, "InvalidBudget");
    await expect(
      naura.connect(funder).createProject(COUNTRY, E(6), PLAN_HASH, 1001, authority.address)
    ).to.be.revertedWithCustomError(naura, "InvalidNdviThreshold");
    await expect(
      naura.connect(funder).createProject(COUNTRY, E(6), PLAN_HASH, NDVI_THRESHOLD, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(naura, "ZeroAddress");
  });

  it("5. escrows multi-party funding and tracks contributions", async () => {
    const { naura, funder, c2, authority } = await loadFixture(deployFixture);
    const id = await createProject(naura, funder, authority);
    await naura.connect(funder).fundProject(id, { value: E(4) });
    await naura.connect(c2).fundProject(id, { value: E(2) });
    const p = await naura.getProject(id);
    expect(p.totalFunded).to.equal(E(6));
    expect(await naura.contributions(id, funder.address)).to.equal(E(4));
    expect(await naura.contributions(id, c2.address)).to.equal(E(2));
  });

  it("6. rejects funding above the budget (ExceedsBudget)", async () => {
    const { naura, funder, authority } = await loadFixture(deployFixture);
    const id = await createProject(naura, funder, authority);
    await naura.connect(funder).fundProject(id, { value: E(5) });
    await expect(naura.connect(funder).fundProject(id, { value: E(2) })).to.be.revertedWithCustomError(
      naura,
      "ExceedsBudget"
    );
  });

  it("7. only the authority can set the beneficiary, and it cannot be the treasury", async () => {
    const { naura, funder, authority, beneficiary, treasury, other } = await loadFixture(deployFixture);
    const id = await createProject(naura, funder, authority);
    await expect(naura.connect(other).setBeneficiary(id, beneficiary.address)).to.be.revertedWithCustomError(
      naura,
      "NotAuthority"
    );
    await expect(naura.connect(authority).setBeneficiary(id, treasury.address)).to.be.revertedWithCustomError(
      naura,
      "BeneficiaryIsTreasury"
    );
    await naura.connect(authority).setBeneficiary(id, beneficiary.address);
    expect((await naura.getProject(id)).beneficiary).to.equal(beneficiary.address);
  });

  it("8. rejects a release below the NDVI threshold", async () => {
    const { naura, funder, authority, beneficiary } = await loadFixture(deployFixture);
    const id = await createProject(naura, funder, authority);
    await naura.connect(funder).fundProject(id, { value: E(6) });
    await naura.connect(authority).setBeneficiary(id, beneficiary.address);
    await expect(naura.connect(authority).release(id, E(2), 299)).to.be.revertedWithCustomError(
      naura,
      "NdviThresholdNotMet"
    );
  });

  it("9. only the authority can release", async () => {
    const { naura, funder, authority, beneficiary, other } = await loadFixture(deployFixture);
    const id = await createProject(naura, funder, authority);
    await naura.connect(funder).fundProject(id, { value: E(6) });
    await naura.connect(authority).setBeneficiary(id, beneficiary.address);
    await expect(naura.connect(other).release(id, E(2), 300)).to.be.revertedWithCustomError(naura, "NotAuthority");
  });

  it("10. happy path: user releases, beneficiary gets net, treasury gets fee, project completes", async () => {
    const { naura, funder, authority, beneficiary, treasury } = await loadFixture(deployFixture);
    const id = await createProject(naura, funder, authority);
    await naura.connect(funder).fundProject(id, { value: E(6) });
    await naura.connect(authority).setBeneficiary(id, beneficiary.address);

    // release the full budget at once -> fee 0.5% of 6 = 0.03, beneficiary nets 5.97
    await expect(naura.connect(authority).release(id, E(6), 320)).to.changeEtherBalances(
      [beneficiary, treasury],
      [E(5.97), E(0.03)]
    );
    const p = await naura.getProject(id);
    expect(p.released).to.equal(E(6));
    expect(p.status).to.equal(1n); // Completed
  });

  it("11. rejects releasing more than the escrowed amount", async () => {
    const { naura, funder, authority, beneficiary } = await loadFixture(deployFixture);
    const id = await createProject(naura, funder, authority);
    await naura.connect(funder).fundProject(id, { value: E(3) }); // partial funding
    await naura.connect(authority).setBeneficiary(id, beneficiary.address);
    await expect(naura.connect(authority).release(id, E(4), 320)).to.be.revertedWithCustomError(
      naura,
      "InsufficientEscrow"
    );
  });

  it("12. cancel before release lets contributors refund their full contribution", async () => {
    const { naura, funder, c2, authority } = await loadFixture(deployFixture);
    const id = await createProject(naura, funder, authority);
    await naura.connect(funder).fundProject(id, { value: E(4) });
    await naura.connect(c2).fundProject(id, { value: E(2) });
    await naura.connect(authority).cancelProject(id);
    expect((await naura.getProject(id)).status).to.equal(2n); // Cancelled

    await expect(naura.connect(funder).refund(id)).to.changeEtherBalance(funder, E(4));
    await expect(naura.connect(c2).refund(id)).to.changeEtherBalance(c2, E(2));
    await expect(naura.connect(funder).refund(id)).to.be.revertedWithCustomError(naura, "NothingToRefund");
  });

  it("13. pause blocks funding/release; owner can emergency-withdraw while paused", async () => {
    const { naura, admin, funder, authority, beneficiary, other } = await loadFixture(deployFixture);
    const id = await createProject(naura, funder, authority);
    await naura.connect(funder).fundProject(id, { value: E(6) });
    await naura.connect(authority).setBeneficiary(id, beneficiary.address);

    await naura.connect(admin).setPaused(true);
    await expect(naura.connect(funder).fundProject(id, { value: E(0) })).to.be.revertedWithCustomError(
      naura,
      "EscrowPaused"
    );
    await expect(naura.connect(authority).release(id, E(1), 320)).to.be.revertedWithCustomError(naura, "EscrowPaused");

    // emergency withdraw sweeps the remaining escrow to a rescue address
    await expect(naura.connect(admin).emergencyWithdraw(id, other.address)).to.changeEtherBalance(other, E(6));
    expect((await naura.getProject(id)).status).to.equal(2n); // Cancelled
  });

  it("14. emergency withdraw only works while paused, and only for the owner", async () => {
    const { naura, admin, funder, authority, other } = await loadFixture(deployFixture);
    const id = await createProject(naura, funder, authority);
    await naura.connect(funder).fundProject(id, { value: E(6) });
    await expect(naura.connect(admin).emergencyWithdraw(id, other.address)).to.be.revertedWithCustomError(
      naura,
      "NotPaused"
    );
    await naura.connect(admin).setPaused(true);
    await expect(naura.connect(other).emergencyWithdraw(id, other.address)).to.be.revertedWithCustomError(
      naura,
      "OwnableUnauthorizedAccount"
    );
  });
});
