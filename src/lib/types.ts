import type { Address, Hash } from "viem";

/** Mirror of MemeToken's `getState()` struct, plus the address it came from. */
export interface CoinState {
  address: Address;
  name: string;
  symbol: string;
  totalSupply: bigint;
  creator: Address;
  owner: Address;
  pair: Address;
  router: Address;
  curveSupply: bigint;
  tokenReserve: bigint;
  ethReserve: bigint;
  virtualEth: bigint;
  graduationTarget: bigint;
  tradeFeeBps: bigint;
  volume: bigint;
  price: bigint;
  marketCapWei: bigint;
  graduated: boolean;
  antiBot: boolean;
  maxWallet: bigint;
  taxBps: bigint;
  platformTaxBps: bigint;
}

/** Mirror of MemeToken's `getMeta()` struct. */
export interface CoinMeta {
  image: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
}

export interface Coin extends CoinState {
  meta: CoinMeta;
  /** Unix seconds, when the launch block could be resolved. */
  launchedAt?: number;
}

/** Mirror of MemeToken's `Config` constructor struct. */
export interface LaunchConfig {
  name: string;
  symbol: string;
  totalSupply: bigint;
  /** Share of supply placed on the curve, in bps. Zero for a fixed launch. */
  curveBps: bigint;
  image: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  antiBot: boolean;
  maxWalletBps: bigint;
  taxBps: bigint;
  taxWallet: Address;
}

/** Mirror of MemeToken's `Curve` constructor struct. */
export interface CurveConfig {
  creator: Address;
  treasury: Address;
  router: Address;
  virtualEth: bigint;
  graduationTarget: bigint;
  tradeFeeBps: bigint;
  platformTaxBps: bigint;
}

/** Fees and curve parameters, read from the factory when one is configured. */
export interface Economics {
  baseFee: bigint;
  antiBotFee: bigint;
  antiWhaleFee: bigint;
  taxFee: bigint;
  tradeFeeBps: bigint;
  platformTaxBps: bigint;
  virtualEth: bigint;
  graduationTarget: bigint;
  treasury: Address | null;
  defaultRouter: Address | null;
  /** Whether these came off the chain or from the compiled-in defaults. */
  source: "factory" | "defaults";
}

export interface Trade {
  trader: Address;
  isBuy: boolean;
  ethAmount: bigint;
  tokenAmount: bigint;
  ethReserveAfter: bigint;
  tokenReserveAfter: bigint;
  timestamp: number;
  blockNumber: bigint;
  logIndex: number;
  hash: Hash;
  key: string;
}

export interface PricePoint {
  t: number;
  price: number;
  isBuy: boolean;
}

export interface TxResult {
  hash: Hash;
}

/** A launch this browser recorded, used when no factory is configured. */
export interface StoredLaunch {
  address: Address;
  name: string;
  symbol: string;
  addedAt: number;
  hash?: Hash;
}

export type LaunchOptions = {
  antiBot: boolean;
  antiWhale: boolean;
  customTax: boolean;
};

export interface PoolInfo {
  pair: Address | null;
  weth: Address;
  pairFactory: Address;
  tokenReserve?: bigint;
  ethReserve?: bigint;
  lpTotalSupply?: bigint;
  lpBalance?: bigint | null;
}
