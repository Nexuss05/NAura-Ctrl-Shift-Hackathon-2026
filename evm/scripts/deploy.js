// Deploy NauraEscrow. Usage:
//   npx hardhat run scripts/deploy.js --network sepolia
// Config via env (see .env.example): FEE_BPS (default 50 = 0.5%), FEE_TREASURY (default deployer).
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const feeBps = Number(process.env.FEE_BPS || 50);
  const feeTreasury = process.env.FEE_TREASURY || deployer.address;

  console.log("Deployer:", deployer.address);
  console.log("fee_bps:", feeBps, " fee_treasury:", feeTreasury);

  const Naura = await ethers.getContractFactory("NauraEscrow");
  const naura = await Naura.deploy(feeBps, feeTreasury);
  await naura.waitForDeployment();

  const address = await naura.getAddress();
  console.log("NauraEscrow deployed at:", address);
  console.log("Set VITE_ESCROW_ADDRESS in web/.env to this address.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
