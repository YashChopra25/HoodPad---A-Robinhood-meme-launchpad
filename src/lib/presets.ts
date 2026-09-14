/**
 * Launch economics per network.
 *
 * The same contracts run on both chains; only the numbers differ. Mainnet uses
 * figures in line with what a real launchpad charges. Testnet is scaled down by
 * roughly 100x, because a faucet hands out a fraction of an ETH every twelve
 * hours — a 3.4 ETH graduation target would make the most interesting part of
 * the app impossible to exercise.
 *
 * Deliberately dependency-free: `scripts/deploy-factory.mjs` imports this too,
 * so the factory is deployed with exactly the parameters the UI assumes.
 */

type NetworkKey = "mainnet" | "testnet" | "sepolia";

interface LaunchPreset {
  /** Flat fee per launch, in wei. */
  baseFee: bigint;
  antiBotFee: bigint;
  antiWhaleFee: bigint;
  taxFee: bigint;
  /** Curve fee on every buy and sell, in basis points. */
  tradeFeeBps: bigint;
  /** Transfer tax written into each new token, in basis points. */
  platformTaxBps: bigint;
  /** Synthetic reserve that sets a new curve's opening price, in wei. */
  virtualEth: bigint;
  /** Real ETH a curve must take in before it graduates, in wei. */
  graduationTarget: bigint;
}

const ETH = 1_000_000_000_000_000_000n;

/** Hundredths of an ETH, so the figures below read as decimals. */
function eth(whole: number): bigint {
  return (BigInt(Math.round(whole * 1e6)) * ETH) / 1_000_000n;
}

const MAINNET_PRESET: LaunchPreset = {
  baseFee: eth(0.01),
  antiBotFee: eth(0.005),
  antiWhaleFee: eth(0.005),
  taxFee: eth(0.01),
  tradeFeeBps: 100n,
  platformTaxBps: 250n,
  virtualEth: eth(1.2),
  graduationTarget: eth(3.4),
};

/**
 * Testnet: everything a buyer touches is ~100x smaller, so one faucet claim is
 * enough to launch a coin, trade it, and push it all the way to graduation.
 * The percentage figures are left alone on purpose — fees and taxes should
 * behave identically to mainnet under test.
 */
const TESTNET_PRESET: LaunchPreset = {
  baseFee: eth(0.0001),
  antiBotFee: eth(0.00005),
  antiWhaleFee: eth(0.00005),
  taxFee: eth(0.0001),
  tradeFeeBps: 100n,
  platformTaxBps: 250n,
  virtualEth: eth(0.012),
  graduationTarget: eth(0.034),
};

/** Every non-mainnet network uses the scaled-down figures. */
export function presetFor(network: NetworkKey): LaunchPreset {
  return network === "mainnet" ? MAINNET_PRESET : TESTNET_PRESET;
}
