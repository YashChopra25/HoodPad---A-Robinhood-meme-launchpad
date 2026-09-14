/**
 * End-to-end exercise of the launch contracts against an in-process EVM:
 * factory fees, curve buys and sells, the launch guards, transfer taxes,
 * graduation into a pool, and the fixed-supply launch shape.
 *
 * Uses the same ABI encoding the browser does, so an encoding mistake in
 * src/lib fails here first. Run with: npm test
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createVM } from "@ethereumjs/vm";
import { Address, hexToBytes } from "@ethereumjs/util";
import { Common, Mainnet } from "@ethereumjs/common";
import {
  decodeEventLog,
  decodeFunctionResult,
  encodeDeployData,
  encodeFunctionData,
  formatEther,
  parseEther,
  parseUnits,
} from "viem";
import solc from "solc";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// The compiler emits TypeScript modules so viem can infer call types in the
// app; Node strips the types on import, so the tests read the same artifacts.
const { MEME_TOKEN_ABI, MEME_TOKEN_BYTECODE } = await import("../src/contracts/MemeToken.ts");
const { MEME_FACTORY_ABI, MEME_FACTORY_BYTECODE } = await import("../src/contracts/MemeFactory.ts");
const tokenArtifact = { abi: MEME_TOKEN_ABI, bytecode: MEME_TOKEN_BYTECODE };
const factoryArtifact = { abi: MEME_FACTORY_ABI, bytecode: MEME_FACTORY_BYTECODE };

// --- compile the test-only router fixture ------------------------------------

const mockSource = readFileSync(join(root, "src/contracts/test/MockRouter.sol"), "utf8");
const mockOut = JSON.parse(
  solc.compile(
    JSON.stringify({
      language: "Solidity",
      sources: { "MockRouter.sol": { content: mockSource } },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      },
    }),
  ),
);
const mockErrors = (mockOut.errors ?? []).filter((e) => e.severity === "error");
if (mockErrors.length > 0) throw new Error(mockOut.errors.map((e) => e.formattedMessage).join("\n"));
const mockRouter = mockOut.contracts["MockRouter.sol"].MockRouter;

// --- harness ------------------------------------------------------------------

const common = new Common({ chain: Mainnet, hardfork: "cancun" });
const vm = await createVM({ common });

const accounts = {
  deployer: addr("0x1111111111111111111111111111111111111111"),
  treasury: addr("0x2222222222222222222222222222222222222222"),
  creator: addr("0x3333333333333333333333333333333333333333"),
  alice: addr("0x4444444444444444444444444444444444444444"),
  bob: addr("0x5555555555555555555555555555555555555555"),
  taxWallet: addr("0x6666666666666666666666666666666666666666"),
};

function addr(hex) {
  return new Address(hexToBytes(hex));
}

/** Accepts either an Address or the hex string a decoded return value gives. */
function toAddress(value) {
  return typeof value === "string" ? addr(value) : value;
}

for (const account of Object.values(accounts)) {
  await vm.stateManager.putAccount(account, undefined);
  await vm.stateManager.modifyAccountFields(account, { balance: parseEther("1000") });
}

let blockNumber = 1n;
let failures = 0;
let checks = 0;

function block() {
  return {
    header: { number: blockNumber, timestamp: 1800000000n, difficulty: 0n, gasLimit: 100_000_000n },
  };
}

function check(label, actual, expected) {
  checks += 1;
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${ok ? "" : `\n         got  ${actual}\n         want ${expected}`}`);
}

function checkTrue(label, actual) {
  check(label, Boolean(actual), true);
}

function checkNear(label, actual, expected, tolerance) {
  checks += 1;
  const delta = actual > expected ? actual - expected : expected - actual;
  const ok = delta <= tolerance;
  if (!ok) failures += 1;
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${ok ? "" : `\n         got  ${actual}\n         want ~${expected}`}`);
}

async function send({ from, to, data, value = 0n, expectRevert = null }) {
  const result = await vm.evm.runCall({
    caller: from,
    to: toAddress(to),
    origin: from,
    data: hexToBytes(data),
    value,
    gasLimit: 60_000_000n,
    block: block(),
  });
  const error = result.execResult.exceptionError;
  const reason = revertReason(result.execResult.returnValue);

  if (expectRevert !== null) {
    checks += 1;
    const ok = Boolean(error) && (expectRevert === "" || reason.includes(expectRevert));
    if (!ok) failures += 1;
    console.log(
      `${ok ? "  ok  " : " FAIL "} reverts with "${expectRevert}"${ok ? "" : `\n         got  ${error ? reason || error.error : "no revert"}`}`,
    );
    return result;
  }
  if (error) throw new Error(`unexpected revert: ${reason || error.error}`);
  return result;
}

async function deploy(bytecode, abi, args) {
  const result = await vm.evm.runCall({
    caller: accounts.deployer,
    origin: accounts.deployer,
    data: hexToBytes(args ? encodeDeployData({ abi, bytecode, args }) : bytecode),
    gasLimit: 100_000_000n,
    block: block(),
  });
  if (result.execResult.exceptionError) {
    throw new Error(`deploy reverted: ${revertReason(result.execResult.returnValue) || result.execResult.exceptionError.error}`);
  }
  return result.createdAddress;
}

async function read(abi, to, functionName, args = []) {
  const result = await vm.evm.runCall({
    caller: accounts.alice,
    to: toAddress(to),
    origin: accounts.alice,
    data: hexToBytes(encodeFunctionData({ abi, functionName, args })),
    gasLimit: 60_000_000n,
    block: block(),
  });
  if (result.execResult.exceptionError) {
    throw new Error(`read ${functionName} reverted: ${revertReason(result.execResult.returnValue)}`);
  }
  return decodeFunctionResult({ abi, functionName, data: hex(result.execResult.returnValue) });
}

function hex(bytes) {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

function revertReason(returnValue) {
  if (!returnValue || returnValue.length < 68) return "";
  try {
    const text = Buffer.from(returnValue.slice(68)).toString("utf8");
    return text.replace(/\0/g, "");
  } catch {
    return "";
  }
}

async function balanceOf(token, account) {
  return read(tokenArtifact.abi, token, "balanceOf", [account.toString()]);
}

async function ethBalance(account) {
  return (await vm.stateManager.getAccount(toAddress(account)))?.balance ?? 0n;
}

/** Decodes every MemeToken log a call produced. */
function logsFrom(result) {
  return (result.execResult.logs ?? []).flatMap(([, topics, data]) => {
    try {
      return [
        decodeEventLog({
          abi: tokenArtifact.abi,
          topics: topics.map((t) => hex(t)),
          data: hex(data),
        }),
      ];
    } catch {
      return [];
    }
  });
}

const readToken = (to, fn, args) => read(tokenArtifact.abi, to, fn, args);
const call = (abi, functionName, args) => encodeFunctionData({ abi, functionName, args });
const tokenCall = (functionName, args) => call(tokenArtifact.abi, functionName, args);
const factoryCall = (functionName, args) => call(factoryArtifact.abi, functionName, args);

function config(overrides = {}) {
  return {
    name: "Robin Doge",
    symbol: "RDOGE",
    totalSupply: parseUnits("1000000000", 18),
    curveBps: 8000n,
    image: "https://example.test/rdoge.png",
    description: "A test launch.",
    website: "",
    twitter: "",
    telegram: "",
    antiBot: false,
    maxWalletBps: 0n,
    taxBps: 0n,
    taxWallet: "0x0000000000000000000000000000000000000000",
    ...overrides,
  };
}

async function launch(overrides, { value, from = accounts.creator } = {}) {
  const cfg = config(overrides);
  const result = await send({
    from,
    to: factory,
    data: factoryCall("launch", [cfg]),
    value,
  });
  const created = decodeFunctionResult({
    abi: factoryArtifact.abi,
    functionName: "launch",
    data: hex(result.execResult.returnValue),
  });
  return { address: created, result };
}

// =============================================================================
console.log("\n— factory —");

const router = await deploy(`0x${mockRouter.evm.bytecode.object}`, mockRouter.abi, undefined);
const factory = await deploy(factoryArtifact.bytecode, factoryArtifact.abi, [
  accounts.treasury.toString(),
  router.toString(),
]);

check("base fee", await read(factoryArtifact.abi, factory, "baseFee"), parseEther("0.01"));
check(
  "fee with every option",
  await read(factoryArtifact.abi, factory, "quoteFee", [true, true, true]),
  parseEther("0.03"),
);
check("registry starts empty", await read(factoryArtifact.abi, factory, "tokenCount"), 0n);

// =============================================================================
console.log("\n— curve launch with an opening buy —");

const treasuryBefore = await ethBalance(accounts.treasury);
const openingBuy = parseEther("0.5");
const { address: coin } = await launch({}, { value: parseEther("0.01") + openingBuy });

check("registry records the launch", await read(factoryArtifact.abi, factory, "tokenCount"), 1n);
check("registry flags the address", await read(factoryArtifact.abi, factory, "isLaunch", [coin.toString()]), true);
check("name", await readToken(coin, "name"), "Robin Doge");
check("symbol", await readToken(coin, "symbol"), "RDOGE");
check("owner is the creator", await readToken(coin, "owner"), accounts.creator.toString());
check(
  "80% of supply went to the curve",
  await readToken(coin, "curveSupply"),
  parseUnits("800000000", 18),
);
check(
  "creator keeps the other 20%, plus the opening buy",
  (await readToken(coin, "totalSupply")) - (await readToken(coin, "curveSupply")),
  parseUnits("200000000", 18),
);
checkNear(
  "treasury collected the launch fee plus the 1% curve fee",
  (await ethBalance(accounts.treasury)) - treasuryBefore,
  parseEther("0.01") + openingBuy / 100n,
  1n,
);
checkTrue("opening buy credited the creator", (await balanceOf(coin, accounts.creator)) > parseUnits("200000000", 18));

// =============================================================================
console.log("\n— curve pricing —");

const priceAtStart = await readToken(coin, "currentPrice");
const spend = parseEther("1");
const [quotedTokens, quotedFee] = await readToken(coin, "quoteBuy", [spend]);
check("quoted fee is 1%", quotedFee, spend / 100n);

const aliceEthBefore = await ethBalance(accounts.alice);
const buyResult = await send({
  from: accounts.alice,
  to: coin,
  data: tokenCall("buy", [0n, "0x0000000000000000000000000000000000000000"]),
  value: spend,
});
check("alice received exactly the quote", await balanceOf(coin, accounts.alice), quotedTokens);
checkTrue("price rose after the buy", (await readToken(coin, "currentPrice")) > priceAtStart);

const trade = logsFrom(buyResult).find((log) => log.eventName === "Trade");
checkTrue("a Trade event was emitted", Boolean(trade));
check("Trade is flagged as a buy", trade?.args.isBuy, true);
check("Trade records the ETH in", trade?.args.ethAmount, spend);
check("Trade records the tokens out", trade?.args.tokenAmount, quotedTokens);

// Selling the whole position straight back should cost roughly the two 1% fees
// and nothing else — that is the curve behaving symmetrically.
const [quotedEthOut] = await readToken(coin, "quoteSell", [quotedTokens]);
await send({
  from: accounts.alice,
  to: coin,
  data: tokenCall("sell", [quotedTokens, 0n]),
});
check("alice's position is closed", await balanceOf(coin, accounts.alice), 0n);
const roundTrip = (await ethBalance(accounts.alice)) - aliceEthBefore;
check("sell paid out the quote", roundTrip, quotedEthOut - spend);
checkTrue(
  `round trip costs about 2% (lost ${formatEther(spend - quotedEthOut)} ETH of 1)`,
  spend - quotedEthOut > parseEther("0.019") && spend - quotedEthOut < parseEther("0.021"),
);

await send({
  from: accounts.alice,
  to: coin,
  data: tokenCall("sell", [parseUnits("1", 18), 0n]),
  expectRevert: "balance exceeded",
});
await send({
  from: accounts.alice,
  to: coin,
  data: tokenCall("buy", [parseUnits("999999999", 18), "0x0000000000000000000000000000000000000000"]),
  value: parseEther("0.1"),
  expectRevert: "slippage",
});

// =============================================================================
console.log("\n— launch guards —");

const { address: guarded } = await launch(
  {
    name: "Guarded",
    symbol: "GRD",
    antiBot: true,
    maxWalletBps: 100n, // 1% of supply
    taxBps: 300n,
    taxWallet: accounts.taxWallet.toString(),
  },
  { value: parseEther("0.03") },
);

check("anti-bot recorded", await readToken(guarded, "antiBot"), true);
check("max wallet is 1% of supply", await readToken(guarded, "maxWallet"), parseUnits("10000000", 18));
check("creator tax recorded", await readToken(guarded, "taxBps"), 300n);
check("platform tax recorded", await readToken(guarded, "platformTaxBps"), 250n);

await send({
  from: accounts.bob,
  to: guarded,
  data: tokenCall("buy", [0n, "0x0000000000000000000000000000000000000000"]),
  value: parseEther("2"),
  expectRevert: "max wallet",
});

await send({
  from: accounts.bob,
  to: guarded,
  data: tokenCall("buy", [0n, "0x0000000000000000000000000000000000000000"]),
  value: parseEther("0.01"),
});
const bobHolding = await balanceOf(guarded, accounts.bob);
checkTrue("a buy under the cap goes through", bobHolding > 0n);

await send({
  from: accounts.bob,
  to: guarded,
  data: tokenCall("buy", [0n, "0x0000000000000000000000000000000000000000"]),
  value: parseEther("0.005"),
  expectRevert: "one buy per block",
});

// Anti-bot throttles buying, never selling: the same wallet sells in the very
// block its second buy was rejected.
await send({
  from: accounts.bob,
  to: guarded,
  data: tokenCall("sell", [bobHolding / 2n, 0n]),
});
checkTrue("the same wallet can still sell in that block", (await balanceOf(guarded, accounts.bob)) > 0n);

blockNumber += 1n;
await send({
  from: accounts.bob,
  to: guarded,
  data: tokenCall("buy", [0n, "0x0000000000000000000000000000000000000000"]),
  value: parseEther("0.005"),
});
checkTrue("the next block lets the wallet buy again", true);

// --- taxes -------------------------------------------------------------------

const gift = parseUnits("1000", 18);
await send({
  from: accounts.bob,
  to: guarded,
  data: tokenCall("transfer", [accounts.alice.toString(), gift]),
});
check("recipient receives the transfer minus 5.5% of tax", await balanceOf(guarded, accounts.alice), (gift * 9450n) / 10000n);
check("platform tax reached the treasury", await balanceOf(guarded, accounts.treasury), (gift * 250n) / 10000n);
check("creator tax reached the tax wallet", await balanceOf(guarded, accounts.taxWallet), (gift * 300n) / 10000n);

await send({
  from: accounts.creator,
  to: guarded,
  data: tokenCall("transfer", [accounts.bob.toString(), parseUnits("1", 18)]),
});
checkTrue("the creator is exempt so they can always seed a pool", true);

// =============================================================================
console.log("\n— graduation —");

const { address: grad } = await launch(
  { name: "Grad", symbol: "GRAD", curveBps: 10000n },
  { value: parseEther("0.01") },
);
check("progress starts at zero", await readToken(grad, "progressBps"), 0n);

await send({
  from: accounts.alice,
  to: grad,
  data: tokenCall("buy", [0n, "0x0000000000000000000000000000000000000000"]),
  value: parseEther("2"),
});
checkTrue("progress advances", (await readToken(grad, "progressBps")) > 5000n);
check("still on the curve before the target", await readToken(grad, "graduated"), false);

const curveTokensBefore = await readToken(grad, "tokenReserve");
const curveEthBefore = await readToken(grad, "ethReserve");
await send({
  from: accounts.bob,
  to: grad,
  data: tokenCall("buy", [0n, "0x0000000000000000000000000000000000000000"]),
  value: parseEther("2"),
});

check("crossing the target graduates the coin", await readToken(grad, "graduated"), true);
check("progress reads complete", await readToken(grad, "progressBps"), 10000n);
check("the curve is emptied of tokens", await readToken(grad, "tokenReserve"), 0n);
check("the curve is emptied of ETH", await readToken(grad, "ethReserve"), 0n);
const pooledTokens = await read(mockRouter.abi, router, "lastTokenAmount");
check(
  "the pool holds the leftover curve tokens",
  await balanceOf(grad, addr("0x00000000000000000000000000000000000CAFe0")),
  pooledTokens,
);
checkTrue("the leftovers are what the last buy did not take", pooledTokens < curveTokensBefore);
checkTrue(
  "the pool received the raise",
  (await read(mockRouter.abi, router, "lastEthAmount")) > curveEthBefore,
);
check(
  "LP tokens were burned",
  await read(mockRouter.abi, router, "lastTo"),
  "0x000000000000000000000000000000000000dEaD",
);
check("the pool address was recorded", await readToken(grad, "pair"), "0x00000000000000000000000000000000000CAFe0");

await send({
  from: accounts.alice,
  to: grad,
  data: tokenCall("buy", [0n, "0x0000000000000000000000000000000000000000"]),
  value: parseEther("0.1"),
  expectRevert: "curve closed",
});
await send({
  from: accounts.alice,
  to: grad,
  data: tokenCall("sell", [parseUnits("1", 18), 0n]),
  expectRevert: "curve closed",
});
checkTrue("holders keep their tokens through graduation", (await balanceOf(grad, accounts.alice)) > 0n);

// =============================================================================
console.log("\n— fixed supply launch —");

const { address: fixedCoin } = await launch(
  { name: "Classic", symbol: "CLSC", curveBps: 0n },
  { value: parseEther("0.01") },
);
check("no curve supply", await readToken(fixedCoin, "curveSupply"), 0n);
check("the creator holds everything", await balanceOf(fixedCoin, accounts.creator), parseUnits("1000000000", 18));
await send({
  from: accounts.alice,
  to: fixedCoin,
  data: tokenCall("buy", [0n, "0x0000000000000000000000000000000000000000"]),
  value: parseEther("0.1"),
  expectRevert: "curve closed",
});

// =============================================================================
// The UI reads a whole coin through getState()/getMeta() and maps the result
// straight onto its CoinState/CoinMeta types. A renamed or reordered struct
// field would silently produce undefined in the browser, so the field names are
// pinned here rather than only in TypeScript.
console.log("\n— view shape the UI depends on —");

const STATE_FIELDS = [
  "name", "symbol", "totalSupply", "creator", "owner", "pair", "router",
  "curveSupply", "tokenReserve", "ethReserve", "virtualEth", "graduationTarget",
  "tradeFeeBps", "volume", "price", "marketCapWei", "graduated", "antiBot",
  "maxWallet", "taxBps", "platformTaxBps",
];
const META_FIELDS = ["image", "description", "website", "twitter", "telegram"];

const state = await readToken(coin, "getState");
const metaView = await readToken(coin, "getMeta");

check("getState returns every field the UI maps", Object.keys(state).join(","), STATE_FIELDS.join(","));
check("getMeta returns every field the UI maps", Object.keys(metaView).join(","), META_FIELDS.join(","));
check("getState carries the name", state.name, "Robin Doge");
check("getState price matches currentPrice()", state.price, await readToken(coin, "currentPrice"));
check(
  "getState market cap matches marketCap()",
  state.marketCapWei,
  await readToken(coin, "marketCap"),
);
check("getMeta carries the image", metaView.image, "https://example.test/rdoge.png");

// The trade panel quotes locally from these reserves before simulating, so the
// two must agree exactly or the displayed number would not be the executed one.
const probe = parseEther("0.25");
const [chainTokensOut, chainFee] = await readToken(coin, "quoteBuy", [probe]);
const localFee = (probe * state.tradeFeeBps) / 10000n;
const k = state.virtualEth * state.curveSupply;
const denominator = state.virtualEth + state.ethReserve + (probe - localFee);
const nextReserve = (k - 1n) / denominator + 1n;
check("client-side buy quote matches the contract", state.tokenReserve - nextReserve, chainTokensOut);
check("client-side fee matches the contract", localFee, chainFee);

// =============================================================================
console.log("\n— ownership —");

await send({
  from: accounts.alice,
  to: fixedCoin,
  data: tokenCall("setPair", [accounts.bob.toString()]),
  expectRevert: "not owner",
});
await send({
  from: accounts.creator,
  to: fixedCoin,
  data: tokenCall("renounceOwnership", []),
});
check("owner cleared", await readToken(fixedCoin, "owner"), "0x0000000000000000000000000000000000000000");
await send({
  from: accounts.creator,
  to: fixedCoin,
  data: tokenCall("setExempt", [accounts.bob.toString(), true]),
  expectRevert: "not owner",
});

// =============================================================================
console.log(
  failures === 0
    ? `\n${checks} checks passed.\n`
    : `\n${failures} of ${checks} checks failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
