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
const ENTRYPOINT = "0xDd70ef8B8965962c3695E193a2D9A44a3D03275f";
const POOL = "0xbC876a3208dcAa6A86b71C74Bed0c9e0D3086976";
const WASM = "/tmp/pp-artifacts/artifacts/withdraw.wasm";
const ZKEY = "/tmp/pp-artifacts/artifacts/withdraw.zkey";
const KEY = process.env.PK;
const MNEMONIC = "legal winner thank year wave sausage worth useful legal winner thank yellow";
const NONCE = 0n;
const FROM_BLOCK = 11058937n;
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

// format the proof for the verifier (Groth16 G2 swap), then submit directly via our own wallet client
const fmt = {
  pA: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
  pB: [
    [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
    [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
  ],
  pC: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])],
  pubSignals: publicSignals.map((s) => BigInt(s)),
};
const withdrawAbi = [
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_w", type: "tuple", components: [{ name: "processooor", type: "address" }, { name: "data", type: "bytes" }] },
      { name: "_p", type: "tuple", components: [
        { name: "pA", type: "uint256[2]" },
        { name: "pB", type: "uint256[2][2]" },
        { name: "pC", type: "uint256[2]" },
        { name: "pubSignals", type: "uint256[8]" },
      ] },
    ],
    outputs: [],
  },
];
const txh = await wallet.writeContract({ address: POOL, abi: withdrawAbi, functionName: "withdraw", args: [withdrawal, fmt] });
console.log("withdraw tx:", txh);
await pub.waitForTransactionReceipt({ hash: txh });
console.log("WITHDRAW CONFIRMED ✅");
