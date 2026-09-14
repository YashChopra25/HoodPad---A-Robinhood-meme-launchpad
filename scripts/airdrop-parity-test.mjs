/**
 * Proves the JavaScript tree builder and the Solidity verifier agree.
 *
 * This is the one thing that can silently break an airdrop: the tree is built
 * off-chain, the proof is checked on-chain, and if the two encodings drift by a
 * single byte every claim reverts with `InvalidProof` — after the tokens have
 * been sent and the announcement made.
 *
 * So: build a tree with `scripts/build-merkle.mjs`'s exact library and
 * encoding, deploy the real compiled `MerkleAirdrop`, and claim through it.
 *
 * Run with: npm run test:airdrop
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createVM } from "@ethereumjs/vm";
import { Common, Mainnet } from "@ethereumjs/common";
import { Address, hexToBytes } from "@ethereumjs/util";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import {
  concatHex,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeDeployData,
  encodeFunctionData,
  getAddress,
  keccak256,
  parseUnits,
} from "viem";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function artifact(file, contract) {
  const path = join(root, "contracts/out", file, `${contract}.json`);
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return {
      abi: parsed.abi,
      bytecode: `0x${parsed.bytecode.object.replace(/^0x/, "")}`,
    };
  } catch {
    console.error(
      `Missing ${path}.\nBuild the contracts first:  cd contracts && forge build`,
    );
    process.exit(1);
  }
}

const TOKEN = artifact("LaunchpadToken.sol", "LaunchpadToken");
const AIRDROP = artifact("MerkleAirdrop.sol", "MerkleAirdrop");

// --- harness ------------------------------------------------------------------

const vm = await createVM({
  common: new Common({ chain: Mainnet, hardfork: "cancun" }),
});

const owner = new Address(
  hexToBytes("0x1111111111111111111111111111111111111111"),
);
const relayer = new Address(
  hexToBytes("0x2222222222222222222222222222222222222222"),
);

for (const account of [owner, relayer]) {
  await vm.stateManager.putAccount(account, undefined);
  await vm.stateManager.modifyAccountFields(account, {
    balance: parseUnits("100", 18),
  });
}

let failures = 0;
let checks = 0;

function check(label, actual, expected) {
  checks += 1;
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "  ok  " : " FAIL "} ${label}${ok ? "" : `\n         got  ${actual}\n         want ${expected}`}`,
  );
}

function hex(bytes) {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

function revertReason(returnValue) {
  if (!returnValue || returnValue.length < 4) return "";
  return hex(returnValue).slice(0, 10);
}

const block = {
  header: {
    number: 1n,
    timestamp: 1800000000n,
    difficulty: 0n,
    gasLimit: 100_000_000n,
  },
};

async function deploy(abi, bytecode, args) {
  const result = await vm.evm.runCall({
    caller: owner,
    origin: owner,
    data: hexToBytes(encodeDeployData({ abi, bytecode, args })),
    gasLimit: 100_000_000n,
    block,
  });
  if (result.execResult.exceptionError) {
    throw new Error(
      `deploy reverted: ${result.execResult.exceptionError.error}`,
    );
  }
  return result.createdAddress;
}

async function call({
  abi,
  to,
  functionName,
  args = [],
  from = owner,
  expectRevert = false,
}) {
  const result = await vm.evm.runCall({
    caller: from,
    origin: from,
    to,
    data: hexToBytes(encodeFunctionData({ abi, functionName, args })),
    gasLimit: 60_000_000n,
    block,
  });

  const error = result.execResult.exceptionError;
  if (expectRevert) {
    checks += 1;
    const ok = Boolean(error);
    if (!ok) failures += 1;
    console.log(
      `${ok ? "  ok  " : " FAIL "} ${functionName} reverts as expected`,
    );
    return { selector: revertReason(result.execResult.returnValue) };
  }
  if (error) {
    throw new Error(
      `${functionName} reverted: ${revertReason(result.execResult.returnValue)} (${error.error})`,
    );
  }
  return {
    value: result.execResult.returnValue.length
      ? decodeFunctionResult({
          abi,
          functionName,
          data: hex(result.execResult.returnValue),
        })
      : undefined,
  };
}

// --- build the tree exactly as the CLI does -----------------------------------

console.log("\n— building the tree in JavaScript —");

const recipients = [
  {
    account: getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
    amount: parseUnits("1000", 18),
  },
  {
    account: getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
    amount: parseUnits("2500", 18),
  },
  {
    account: getAddress("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"),
    amount: parseUnits("500", 18),
  },
  {
    account: getAddress("0x90F79bf6EB2c4f870365E785982E1f101E93b906"),
    amount: parseUnits("6000", 18),
  },
  {
    account: getAddress("0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"),
    amount: parseUnits("1", 18),
  },
];

const values = recipients.map((entry, index) => [
  index.toString(),
  entry.account,
  entry.amount.toString(),
]);
const tree = StandardMerkleTree.of(values, ["uint256", "address", "uint256"]);
const total = recipients.reduce((sum, entry) => sum + entry.amount, 0n);

const claims = new Map();
for (const [treeIndex, value] of tree.entries()) {
  claims.set(value[1].toLowerCase(), {
    index: BigInt(value[0]),
    account: value[1],
    amount: BigInt(value[2]),
    proof: tree.getProof(treeIndex),
  });
}

console.log(`  ${recipients.length} recipients, root ${tree.root}`);

// --- deploy the real compiled contracts ---------------------------------------

console.log("\n— deploying the compiled contracts —");

const supply = parseUnits("1000000", 18);
const token = await deploy(TOKEN.abi, TOKEN.bytecode, [supply]);
const airdrop = await deploy(AIRDROP.abi, AIRDROP.bytecode, [
  token.toString(),
  tree.root,
  0n,
  total,
  owner.toString(),
]);

await call({
  abi: TOKEN.abi,
  to: token,
  functionName: "transfer",
  args: [airdrop.toString(), total],
});

check(
  "airdrop is funded with the tree's total",
  (
    await call({
      abi: TOKEN.abi,
      to: token,
      functionName: "balanceOf",
      args: [airdrop.toString()],
    })
  ).value,
  total,
);
check(
  "contract agrees with the JavaScript root",
  (await call({ abi: AIRDROP.abi, to: airdrop, functionName: "merkleRoot" }))
    .value,
  tree.root,
);

// --- the actual parity check --------------------------------------------------

console.log("\n— leaf encoding —");

/**
 * The leaf, computed straight from the specification rather than by asking the
 * tree library again. If the contract, the library and this all agree, the
 * encoding is genuinely right rather than consistently wrong.
 */
function expectedLeaf({ index, account, amount }) {
  const inner = keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "uint256" }],
      [index, account, amount],
    ),
  );
  return keccak256(concatHex([inner]));
}

for (const entry of claims.values()) {
  const onChain = (
    await call({
      abi: AIRDROP.abi,
      to: airdrop,
      functionName: "leafFor",
      args: [entry.index, entry.account, entry.amount],
    })
  ).value;
  check(`leaf ${entry.index} matches the spec`, onChain, expectedLeaf(entry));
}

console.log("\n— claiming with JavaScript-generated proofs —");

for (const entry of claims.values()) {
  check(
    `canClaim says index ${entry.index} is eligible`,
    (
      await call({
        abi: AIRDROP.abi,
        to: airdrop,
        functionName: "canClaim",
        args: [entry.index, entry.account, entry.amount, entry.proof],
      })
    ).value,
    true,
  );

  // Submitted by a relayer, to prove the tokens still reach the recipient.
  await call({
    abi: AIRDROP.abi,
    to: airdrop,
    functionName: "claim",
    args: [entry.index, entry.account, entry.amount, entry.proof],
    from: relayer,
  });

  check(
    `index ${entry.index} received its allocation`,
    (
      await call({
        abi: TOKEN.abi,
        to: token,
        functionName: "balanceOf",
        args: [entry.account],
      })
    ).value,
    entry.amount,
  );
}

check(
  "every allocation was distributed",
  (await call({ abi: AIRDROP.abi, to: airdrop, functionName: "totalClaimed" }))
    .value,
  total,
);
check(
  "nothing is left in the contract",
  (
    await call({
      abi: TOKEN.abi,
      to: token,
      functionName: "balanceOf",
      args: [airdrop.toString()],
    })
  ).value,
  0n,
);

console.log("\n— tampering —");

const first = [...claims.values()][0];
await call({
  abi: AIRDROP.abi,
  to: airdrop,
  functionName: "claim",
  args: [first.index, first.account, first.amount, first.proof],
  expectRevert: true,
});

await call({
  abi: AIRDROP.abi,
  to: airdrop,
  functionName: "claim",
  args: [99n, first.account, first.amount, first.proof],
  expectRevert: true,
});

check(
  "an inflated amount fails verification",
  (
    await call({
      abi: AIRDROP.abi,
      to: airdrop,
      functionName: "canClaim",
      args: [first.index, first.account, first.amount * 2n, first.proof],
    })
  ).value,
  false,
);

console.log(
  failures === 0
    ? `\n${checks} checks passed.\n`
    : `\n${failures} of ${checks} checks failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
