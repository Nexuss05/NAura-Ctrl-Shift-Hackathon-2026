// End-to-end lifecycle against the live NauraEscrow on a network. Produces explorable transactions.
//   npx hardhat run scripts/demo-e2e.js --network sepolia
// Uses the deployed address from deployments.json (or ESCROW_ADDRESS env). The signer is funder +
// authority; a fresh address stands in for the reforestation org (receive-only).
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const dep = JSON.parse(fs.readFileSync(__dirname + "/../deployments.json", "utf8"));
  const address = process.env.ESCROW_ADDRESS || dep.sepolia.NauraEscrow;
  const [user] = await ethers.getSigners();
  const naura = await ethers.getContractAt("NauraEscrow", address, user);
  const ex = (h) => `https://sepolia.etherscan.io/tx/${h}`;

  const budget = ethers.parseEther("0.01");
  const ndviThreshold = 300n; // 0.300
  const beneficiary = ethers.Wallet.createRandom().address; // placeholder "org" (receive-only)

  console.log("contract :", address);
  console.log("user     :", user.address, "(funder + authority)");
  console.log("org       :", beneficiary);
  console.log("");

  let tx = await naura.createProject("0x4252", budget, ethers.id("amazon-e2e"), ndviThreshold, user.address);
  let rc = await tx.wait();
  let id;
  for (const log of rc.logs) {
    try {
      const p = naura.interface.parseLog(log);
      if (p && p.name === "ProjectCreated") id = p.args.id;
    } catch {}
  }
  console.log(`1) createProject  id=${id}  -> ${ex(rc.hash)}`);

  tx = await naura.fundProject(id, { value: budget });
  rc = await tx.wait();
  console.log(`2) fundProject    0.01 ETH  -> ${ex(rc.hash)}`);

  tx = await naura.setBeneficiary(id, beneficiary);
  rc = await tx.wait();
  console.log(`3) setBeneficiary           -> ${ex(rc.hash)}`);

  tx = await naura.release(id, budget, 320); // NDVI 0.320 >= 0.300 threshold
  rc = await tx.wait();
  console.log(`4) release        0.01 ETH  -> ${ex(rc.hash)}`);

  const p = await naura.getProject(id);
  console.log("");
  console.log(`final: released=${ethers.formatEther(p.released)} ETH  status=${p.status} (1 = Completed)`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
