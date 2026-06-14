import {
  PrivacyPoolSDK,
  Circuits,
  generateMasterKeys,
  generateDepositSecrets,
  hashPrecommitment,
  getCommitment,
  generateMerkleProof,
  calculateContext,
} from "@0xbow/privacy-pools-core-sdk";
import * as snarkjs from "snarkjs";
import { createPublicClient, createWalletClient, http, encodeAbiParameters, parseAbiItem } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const ENTRYPOINT = "0xC02b4350223dB390F87DbeCa86b823fE6dBBc8CB";
const POOL = "0xECe9272a220237D2426Fd3494585DBa2368421E4";
const WASM = "/tmp/pp-artifacts/artifacts/withdraw.wasm";
const ZKEY = "/tmp/pp-artifacts/artifacts/withdraw.zkey";
const KEY = process.env.PK;
const MNEMONIC = "legal winner thank year wave sausage worth useful legal winner thank yellow";
const NONCE = 0n;
const FROM_BLOCK = 11058440n;
const account = privateKeyToAccount(KEY);
const ME = account.address;

const v = (name) => [{ name, type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }];
const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

const sdk = new PrivacyPoolSDK(new Circuits({ browser: false }));
const contracts = sdk.createContractInstance(RPC, sepolia, ENTRYPOINT, KEY);
const masterKeys = generateMasterKeys(MNEMONIC);

const scope = await pub.readContract({ address: POOL, abi: v("SCOPE"), functionName: "SCOPE" });
const { secret, nullifier } = generateDepositSecrets(masterKeys, scope, NONCE);
const precommitment = hashPrecommitment(nullifier, secret);

const depEvent = parseAbiItem(
  "event Deposited(address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _precommitmentHash)"
);
const depLogs = await pub.getLogs({ address: POOL, event: depEvent, fromBlock: FROM_BLOCK });
const dep = depLogs.find((l) => l.args._precommitmentHash === precommitment);
if (!dep) throw new Error("deposit not found for our precommitment");
const label = dep.args._label;
const value = dep.args._value;
console.log("label:", label.toString(), "value:", value.toString());

const commitment = getCommitment(value, label, nullifier, secret);
console.log("commitment match:", commitment.hash === dep.args._commitment);

const { secret: newSecret, nullifier: newNullifier } = generateDepositSecrets(masterKeys, label, 0n);

// 1) post ASP root (postman)
const aspRoot = hashPrecommitment(label, 1n);
const updateRootAbi = [
  { name: "updateRoot", type: "function", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "string" }], outputs: [{ type: "uint256" }] },
];
const aspTx = await wallet.writeContract({ address: ENTRYPOINT, abi: updateRootAbi, functionName: "updateRoot", args: [aspRoot, "Qm" + "b".repeat(44)] });
await pub.waitForTransactionReceipt({ hash: aspTx });
console.log("ASP root posted:", aspTx);

// 2) state leaves
const leafEvent = parseAbiItem("event LeafInserted(uint256 _index, uint256 _leaf, uint256 _root)");
const leafLogs = await pub.getLogs({ address: POOL, event: leafEvent, fromBlock: FROM_BLOCK });
const leaves = leafLogs.map((l) => ({ index: l.args._index, leaf: l.args._leaf }));

// 3) withdrawal struct (direct: processooor = me, no relay fee)
const FeeDataAbi = [
  { name: "FeeData", type: "tuple", components: [{ name: "recipient", type: "address" }, { name: "feeRecipient", type: "address" }, { name: "relayFeeBPS", type: "uint256" }] },
];
const data = encodeAbiParameters(FeeDataAbi, [{ recipient: ME, feeRecipient: ME, relayFeeBPS: 0n }]);
const withdrawal = { processooor: ME, data };

// 4) proof inputs
const stateTreeDepth = await pub.readContract({ address: POOL, abi: v("currentTreeDepth"), functionName: "currentTreeDepth" });
const stateRoot = await pub.readContract({ address: POOL, abi: v("currentRoot"), functionName: "currentRoot" });

const sortedLeaves = leaves.sort((a, b) => Number(a.index - b.index)).map((x) => x.leaf);
const smp = generateMerkleProof(sortedLeaves, commitment.hash);
let stateIndex = Number.isNaN(smp.index) ? 0 : smp.index;
let stateSiblings = smp.siblings.length === 0 ? [stateRoot, ...Array(31).fill(0n)] : [...smp.siblings, ...Array(Math.max(0, 32 - smp.siblings.length)).fill(0n)];

const aspSiblings = [1n, ...Array(31).fill(0n)];
const context = calculateContext(withdrawal, scope);

// 5) build circuit signals exactly like the SDK's prepareInputSignals, then prove with snarkjs directly
const signals = {
  withdrawnValue: value,
  stateRoot: stateRoot,
  stateTreeDepth: stateTreeDepth,
  ASPRoot: aspRoot,
  ASPTreeDepth: 2n,
  context: BigInt(context),
  label: label,
  existingValue: value,
  existingNullifier: nullifier,
  existingSecret: secret,
  newNullifier: newNullifier,
  newSecret: newSecret,
  stateSiblings: stateSiblings,
  stateIndex: BigInt(stateIndex),
  ASPSiblings: aspSiblings,
  ASPIndex: 0n,
};

console.log("generating withdrawal proof with snarkjs + our own artifacts (~10-40s)...");
const { proof, publicSignals } = await snarkjs.groth16.fullProve(signals, WASM, ZKEY);
console.log("proof generated, submitting withdraw...");

const tx = await contracts.withdraw(withdrawal, { proof, publicSignals }, scope);
const hash = tx.hash ?? tx;
console.log("withdraw tx:", hash);
await tx.wait();
console.log("WITHDRAW CONFIRMED ✅");
