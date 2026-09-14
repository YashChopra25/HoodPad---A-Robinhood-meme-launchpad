/**
 * Deploys MemeFactory to Robinhood Chain and configures it for the target
 * network. The factory is what makes launches globally discoverable, so deploy
 * it once and put the address in NEXT_PUBLIC_FACTORY_ADDRESS.
 *
 *   DEPLOYER_KEY=0x... npm run deploy:factory -- --chain testnet
 *
 * Options (all optional):
 *   --chain testnet|mainnet   defaults to NEXT_PUBLIC_CHAIN, else testnet
 *   --preset testnet|mainnet  economics to write in; defaults to --chain
 *   --treasury 0x...          fee recipient, defaults to the deployer
 *   --router 0x...            Uniswap V2 router used at graduation
 *   --update 0x...            reconfigure an existing factory instead of deploying
 *   --write-env               write the address into .env.local
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, formatEther, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { MEME_FACTORY_ABI, MEME_FACTORY_BYTECODE } from "../src/contracts/MemeFactory.ts";
import { presetFor } from "../src/lib/presets.ts";

// Reads .env.local then .env, so the network endpoints and DEPLOYER_KEY come
// from the same files the app uses.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Missing env files are fine; every value below has a default.
  }
}

function env(name, fallback) {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

function flag(name, fallback = undefined) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function has(name) {
  return process.argv.includes(`--${name}`);
}

const ZERO = "0x0000000000000000000000000000000000000000";

const nativeCurrency = {
  name: env("NEXT_PUBLIC_NATIVE_NAME", "Ether"),
  symbol: env("NEXT_PUBLIC_NATIVE_SYMBOL", "ETH"),
  decimals: 18,
};

const CHAINS = {
  testnet: {
    id: Number(env("NEXT_PUBLIC_TESTNET_CHAIN_ID", "46630")),
    name: env("NEXT_PUBLIC_TESTNET_NAME", "Robinhood Chain Testnet"),
    nativeCurrency,
    rpcUrls: {
      default: {
        http: [env("NEXT_PUBLIC_TESTNET_RPC_URL", "https://rpc.testnet.chain.robinhood.com")],
      },
    },
    blockExplorers: {
      default: {
        name: env("NEXT_PUBLIC_TESTNET_EXPLORER_NAME", "Explorer"),
        url: env(
          "NEXT_PUBLIC_TESTNET_EXPLORER_URL",
          "https://explorer.testnet.chain.robinhood.com",
        ),
      },
    },
  },
  mainnet: {
    id: Number(env("NEXT_PUBLIC_MAINNET_CHAIN_ID", "4663")),
    name: env("NEXT_PUBLIC_MAINNET_NAME", "Robinhood Chain"),
    nativeCurrency,
    rpcUrls: {
      default: {
        http: [env("NEXT_PUBLIC_MAINNET_RPC_URL", "https://rpc.mainnet.chain.robinhood.com")],
      },
    },
    blockExplorers: {
      default: {
        name: env("NEXT_PUBLIC_MAINNET_EXPLORER_NAME", "Blockscout"),
        url: env("NEXT_PUBLIC_MAINNET_EXPLORER_URL", "https://robinhoodchain.blockscout.com"),
      },
    },
  },
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

const key = process.env.DEPLOYER_KEY;
if (!key) {
  fail(
    "DEPLOYER_KEY is required.\n" +
      "Put a funded testnet key in .env.local, then:\n" +
      "  npm run deploy:factory -- --chain testnet",
  );
}

const chainKey = flag("chain", env("NEXT_PUBLIC_CHAIN", "testnet"));
const chain = CHAINS[chainKey];
if (!chain) fail(`Unknown --chain "${chainKey}". Use one of: ${Object.keys(CHAINS).join(", ")}`);

const presetKey = flag("preset", chainKey);
if (!CHAINS[presetKey]) fail(`Unknown --preset "${presetKey}". Use testnet or mainnet.`);
const preset = presetFor(presetKey);

const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const treasury = flag("treasury", env("NEXT_PUBLIC_TREASURY_ADDRESS", account.address));
const router = flag("router", env("NEXT_PUBLIC_ROUTER_ADDRESS", ZERO));
const existing = flag("update");

for (const [label, value] of [
  ["--treasury", treasury],
  ["--router", router],
  ...(existing ? [["--update", existing]] : []),
]) {
  if (!isAddress(value)) fail(`${label} is not a valid address: ${value}`);
}

const publicClient = createPublicClient({ chain, transport: http() });
const walletClient = createWalletClient({ account, chain, transport: http() });

const balance = await publicClient.getBalance({ address: account.address });
const symbol = nativeCurrency.symbol;

console.log(`chain     ${chain.name} (${chain.id})`);
console.log(`deployer  ${account.address}`);
console.log(`balance   ${formatEther(balance)} ${symbol}`);
console.log(`treasury  ${treasury}`);
console.log(`router    ${router === ZERO ? "none — curves keep trading past their target" : router}`);
console.log(`preset    ${presetKey}`);
console.log(`  launch fee        ${formatEther(preset.baseFee)} ${symbol}`);
console.log(`  anti-bot          ${formatEther(preset.antiBotFee)} ${symbol}`);
console.log(`  anti-whale        ${formatEther(preset.antiWhaleFee)} ${symbol}`);
console.log(`  custom tax        ${formatEther(preset.taxFee)} ${symbol}`);
console.log(`  virtual reserve   ${formatEther(preset.virtualEth)} ${symbol}`);
console.log(`  graduates at      ${formatEther(preset.graduationTarget)} ${symbol}`);
console.log(`  curve trade fee   ${Number(preset.tradeFeeBps) / 100}%`);
console.log(`  transfer tax      ${Number(preset.platformTaxBps) / 100}%`);

if (balance === 0n) {
  fail(
    `\nDeployer has no ${symbol} on ${chain.name}.` +
      (chain.id === 46630
        ? "\nFund it at https://faucet.testnet.chain.robinhood.com" +
          "\nAlternatives: https://faucet.quicknode.com/robinhood/testnet" +
          "\n              https://faucets.chain.link/robinhood-testnet"
        : ""),
  );
}

async function send(label, request) {
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") fail(`${label} reverted (${hash})`);
  console.log(`  ${label} ✓  ${hash}`);
  return receipt;
}

let address = existing;

if (existing) {
  console.log(`\nreconfiguring existing factory ${existing}`);
  const owner = await publicClient.readContract({
    address: existing,
    abi: MEME_FACTORY_ABI,
    functionName: "owner",
  });
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    fail(`Deployer is not the factory owner (owner is ${owner}).`);
  }
} else {
  console.log("\ndeploying MemeFactory...");
  const hash = await walletClient.deployContract({
    abi: MEME_FACTORY_ABI,
    bytecode: MEME_FACTORY_BYTECODE,
    args: [treasury, router],
  });
  console.log(`  tx ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") fail("Deployment reverted.");
  address = receipt.contractAddress;
  console.log(`  deployed at ${address}  (gas ${receipt.gasUsed})`);
}

// The constructor uses the mainnet figures, so a testnet deployment is tuned
// straight afterwards rather than needing a second contract.
console.log("\napplying the preset...");

const feeRequest = await publicClient.simulateContract({
  address,
  abi: MEME_FACTORY_ABI,
  functionName: "setFees",
  args: [preset.baseFee, preset.antiBotFee, preset.antiWhaleFee, preset.taxFee],
  account,
});
await send("setFees", feeRequest.request);

const curveRequest = await publicClient.simulateContract({
  address,
  abi: MEME_FACTORY_ABI,
  functionName: "setCurveParams",
  args: [preset.virtualEth, preset.graduationTarget, preset.tradeFeeBps, preset.platformTaxBps],
  account,
});
await send("setCurveParams", curveRequest.request);

const explorer = chain.blockExplorers.default.url;
console.log(`\nMemeFactory is live at ${address}`);
console.log(`${explorer}/address/${address}`);

if (has("write-env")) {
  const path = ".env.local";
  let contents = "";
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    contents = "";
  }
  contents = contents.includes("NEXT_PUBLIC_FACTORY_ADDRESS=")
    ? contents.replace(/^NEXT_PUBLIC_FACTORY_ADDRESS=.*$/m, `NEXT_PUBLIC_FACTORY_ADDRESS=${address}`)
    : `${contents.trimEnd()}\nNEXT_PUBLIC_FACTORY_ADDRESS=${address}\n`;
  writeFileSync(path, contents);
  console.log(`\nWrote NEXT_PUBLIC_FACTORY_ADDRESS to ${path}. Restart the dev server.`);
} else {
  console.log(`\nAdd this to .env.local:\n\nNEXT_PUBLIC_FACTORY_ADDRESS=${address}`);
}
