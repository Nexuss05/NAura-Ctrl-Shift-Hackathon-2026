import {
  PrivacyPoolSDK,
  Circuits,
  generateMasterKeys,
  generateDepositSecrets,
  hashPrecommitment,
} from "@0xbow/privacy-pools-core-sdk";
import { sepolia } from "viem/chains";
import { createPublicClient, http, parseEther } from "viem";
import { writeFileSync } from "fs";

const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const ENTRYPOINT = "0xC02b4350223dB390F87DbeCa86b823fE6dBBc8CB";
const POOL = "0xECe9272a220237D2426Fd3494585DBa2368421E4";
const KEY = process.env.PK;
// fixed testnet mnemonic so the note is reproducible for the later withdrawal
const MNEMONIC = "legal winner thank year wave sausage worth useful legal winner thank yellow";
const NONCE = 0n;

const sdk = new PrivacyPoolSDK(new Circuits({ browser: false }));
const contracts = sdk.createContractInstance(RPC, sepolia, ENTRYPOINT, KEY);
const masterKeys = generateMasterKeys(MNEMONIC);

const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
const scope = await pub.readContract({
  address: POOL,
  abi: [{ name: "SCOPE", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }],
  functionName: "SCOPE",
});
console.log("pool scope:", scope.toString());

const { secret, nullifier } = generateDepositSecrets(masterKeys, scope, NONCE);
const precommitment = hashPrecommitment(nullifier, secret);
console.log("precommitment:", precommitment.toString());

const amount = parseEther("0.002");
console.log("depositing 0.002 ETH (shielded) ...");
const tx = await contracts.depositETH(amount, precommitment);
const hash = tx.hash ?? tx;
console.log("deposit tx:", hash);
const receipt = await tx.wait();
console.log("confirmed:", receipt?.blockNumber ?? receipt?.transactionHash ?? "ok");

writeFileSync(
  "/tmp/pp-deposit-note.json",
  JSON.stringify(
    {
      mnemonic: MNEMONIC,
      nonce: NONCE.toString(),
      scope: scope.toString(),
      secret: secret.toString(),
      nullifier: nullifier.toString(),
      precommitment: precommitment.toString(),
      amount: amount.toString(),
      entrypoint: ENTRYPOINT,
      pool: POOL,
      txHash: typeof hash === "string" ? hash : String(hash),
    },
    null,
    2
  )
);
console.log("note saved to /tmp/pp-deposit-note.json");
