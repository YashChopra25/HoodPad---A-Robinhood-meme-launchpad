/**
 * Turns a recipient list into the Merkle tree `MerkleAirdrop` verifies against.
 *
 *   npm run airdrop:build -- --input recipients.csv --name season-one
 *
 * Input is CSV, one `address,amount` per line, with an optional header. Amounts
 * are whole tokens by default and scaled by `--decimals` (18); pass
 * `--base-units` to take them as-is.
 *
 * Output lands in `airdrop/<name>.json`:
 *   • the root and total to pass to DeployAirdrop
 *   • every entry with its proof, keyed by lowercased address, which is what a
 *     claim page loads
 *
 * The tree is built with OpenZeppelin's StandardMerkleTree, whose leaves are
 * keccak256(keccak256(abi.encode(index, account, amount))) — byte for byte what
 * `MerkleAirdrop.leafFor` computes. `npm run test:airdrop` proves it.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { formatUnits, getAddress, isAddress, parseUnits } from "viem";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function flag(name, fallback = undefined) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function has(name) {
  return process.argv.includes(`--${name}`);
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const input = flag("input");
if (!input) {
  fail(
    "Usage: npm run airdrop:build -- --input recipients.csv [--name season-one]\n" +
      "       [--decimals 18] [--base-units] [--allow-duplicates]",
  );
}

const name = flag("name", "airdrop");
const decimals = Number(flag("decimals", 18));
const baseUnits = has("base-units");

// --- parse -------------------------------------------------------------------

let raw;
try {
  raw = readFileSync(input, "utf8");
} catch {
  fail(`Could not read ${input}`);
}

const rows = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => line.split(",").map((cell) => cell.trim()));

// Drop a header row if the first cell is not an address.
if (rows.length > 0 && !isAddress(rows[0][0])) rows.shift();
if (rows.length === 0) fail("No rows found. Expected lines of `address,amount`.");

const problems = [];
const seen = new Map();
const entries = [];

rows.forEach(([address, amount], line) => {
  const where = `line ${line + 1}`;
  if (!address || !isAddress(address)) {
    problems.push(`${where}: "${address}" is not a valid address`);
    return;
  }
  if (!amount) {
    problems.push(`${where}: missing amount for ${address}`);
    return;
  }

  let value;
  try {
    value = baseUnits ? BigInt(amount) : parseUnits(amount, decimals);
  } catch {
    problems.push(`${where}: "${amount}" is not a valid amount`);
    return;
  }
  if (value <= 0n) {
    problems.push(`${where}: amount for ${address} must be greater than zero`);
    return;
  }

  const key = address.toLowerCase();
  if (seen.has(key) && !has("allow-duplicates")) {
    problems.push(`${where}: ${address} already appears on line ${seen.get(key) + 1}`);
    return;
  }
  seen.set(key, line);

  // Checksummed, so the address in the leaf is unambiguous.
  entries.push({ account: getAddress(address), amount: value });
});

if (problems.length > 0) {
  fail(`${problems.length} problem(s) in ${input}:\n  ${problems.join("\n  ")}`);
}

// --- build -------------------------------------------------------------------

// The index is the position in the input, assigned before the tree sorts its
// leaves internally — it is what the contract's claimed bitmap keys on, so it
// must be stable and independent of tree layout.
const values = entries.map((entry, index) => [
  index.toString(),
  entry.account,
  entry.amount.toString(),
]);

const tree = StandardMerkleTree.of(values, ["uint256", "address", "uint256"]);
const total = entries.reduce((sum, entry) => sum + entry.amount, 0n);

const claims = {};
for (const [treeIndex, value] of tree.entries()) {
  const [index, account, amount] = value;
  claims[account.toLowerCase()] = {
    index: Number(index),
    account,
    amount,
    proof: tree.getProof(treeIndex),
  };
}

const outputDir = join(root, "airdrop");
mkdirSync(outputDir, { recursive: true });

const target = join(outputDir, `${name}.json`);
writeFileSync(
  target,
  `${JSON.stringify(
    {
      name,
      merkleRoot: tree.root,
      total: total.toString(),
      totalFormatted: formatUnits(total, decimals),
      decimals,
      recipients: entries.length,
      generatedAt: new Date().toISOString(),
      leafEncoding: ["uint256", "address", "uint256"],
      claims,
    },
    null,
    2,
  )}\n`,
);

// The full tree, needed only to regenerate proofs later without the CSV.
writeFileSync(join(outputDir, `${name}.tree.json`), `${JSON.stringify(tree.dump(), null, 2)}\n`);

console.log(`recipients   ${entries.length}`);
console.log(`total        ${formatUnits(total, decimals)} tokens (${total} base units)`);
console.log(`merkle root  ${tree.root}`);
console.log(`\nwrote ${target}`);
console.log(`      ${join(outputDir, `${name}.tree.json`)}`);
console.log(`\nDeploy with:`);
console.log(`  cd contracts`);
console.log(`  AIRDROP_TOKEN=<TOKEN_ADDRESS> \\`);
console.log(`  AIRDROP_MERKLE_ROOT=${tree.root} \\`);
console.log(`  AIRDROP_TOTAL=${total} \\`);
console.log(`  AIRDROP_FUND=true \\`);
console.log(`  forge script script/DeployAirdrop.s.sol:DeployAirdrop --rpc-url sepolia --broadcast`);
