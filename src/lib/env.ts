/**
 * Every deployment-specific value the app reads, in one place.
 *
 * Next.js inlines `NEXT_PUBLIC_*` at build time only where it appears as a
 * literal `process.env.NEXT_PUBLIC_X` expression, so each variable is spelled
 * out here rather than looked up through a helper. Defaults are the public
 * Robinhood Chain endpoints, so the app runs with no .env file at all.
 */
import { isAddress, type Address } from "viem";

function text(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number(value?.trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function decimal(value: string | undefined): number | null {
  const parsed = Number(value?.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Returns a checksummed address, or null for blank, malformed or zero. */
function address(value: string | undefined): Address | null {
  const trimmed = value?.trim();
  if (!trimmed || !isAddress(trimmed)) return null;
  if (trimmed === ZERO_ADDRESS) return null;
  return trimmed as Address;
}

export const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

export type NetworkKey = "mainnet" | "testnet" | "sepolia";

export interface NetworkEnv {
  key: NetworkKey;
  id: number;
  name: string;
  rpcUrl: string;
  explorerName: string;
  explorerUrl: string;
}

export const NATIVE_SYMBOL = text(process.env.NEXT_PUBLIC_NATIVE_SYMBOL, "ETH");
export const NATIVE_NAME = text(process.env.NEXT_PUBLIC_NATIVE_NAME, "Ether");

export const MAINNET_ENV: NetworkEnv = {
  key: "mainnet",
  id: integer(process.env.NEXT_PUBLIC_MAINNET_CHAIN_ID, 4663),
  name: text(process.env.NEXT_PUBLIC_MAINNET_NAME, "Robinhood Chain"),
  rpcUrl: text(process.env.NEXT_PUBLIC_MAINNET_RPC_URL, "https://rpc.mainnet.chain.robinhood.com"),
  explorerName: text(process.env.NEXT_PUBLIC_MAINNET_EXPLORER_NAME, "Blockscout"),
  explorerUrl: text(
    process.env.NEXT_PUBLIC_MAINNET_EXPLORER_URL,
    "https://robinhoodchain.blockscout.com",
  ),
};

/**
 * Ethereum Sepolia, the target for the Foundry contracts in `contracts/`.
 * Present so the same UI can be pointed at a Sepolia deployment without a code
 * change — see contracts/ARCHITECTURE.md.
 */
export const SEPOLIA_ENV: NetworkEnv = {
  key: "sepolia",
  id: integer(process.env.NEXT_PUBLIC_SEPOLIA_CHAIN_ID, 11155111),
  name: text(process.env.NEXT_PUBLIC_SEPOLIA_NAME, "Ethereum Sepolia"),
  rpcUrl: text(
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
    "https://ethereum-sepolia-rpc.publicnode.com",
  ),
  explorerName: text(process.env.NEXT_PUBLIC_SEPOLIA_EXPLORER_NAME, "Etherscan"),
  explorerUrl: text(process.env.NEXT_PUBLIC_SEPOLIA_EXPLORER_URL, "https://sepolia.etherscan.io"),
};

export const TESTNET_ENV: NetworkEnv = {
  key: "testnet",
  id: integer(process.env.NEXT_PUBLIC_TESTNET_CHAIN_ID, 46630),
  name: text(process.env.NEXT_PUBLIC_TESTNET_NAME, "Robinhood Chain Testnet"),
  rpcUrl: text(process.env.NEXT_PUBLIC_TESTNET_RPC_URL, "https://rpc.testnet.chain.robinhood.com"),
  explorerName: text(
    process.env.NEXT_PUBLIC_TESTNET_EXPLORER_NAME,
    "Robinhood Testnet Explorer",
  ),
  explorerUrl: text(
    process.env.NEXT_PUBLIC_TESTNET_EXPLORER_URL,
    "https://explorer.testnet.chain.robinhood.com",
  ),
};

/** Testnet unless explicitly pointed elsewhere, so a first run costs nothing. */
function activeNetwork(): NetworkKey {
  const configured = text(process.env.NEXT_PUBLIC_CHAIN, "testnet").toLowerCase();
  if (configured === "mainnet") return "mainnet";
  if (configured === "sepolia") return "sepolia";
  return "testnet";
}

export const ACTIVE_NETWORK: NetworkKey = activeNetwork();

/**
 * MemeFactory. With it set, the coin board reads every launch from the chain.
 * Without it, launches deploy directly from the wallet and are listed only in
 * the browser that made them.
 */
export const FACTORY_ADDRESS = address(process.env.NEXT_PUBLIC_FACTORY_ADDRESS);

/** Uniswap V2 router: the graduation venue and the liquidity page's target. */
export const ROUTER_ADDRESS = address(process.env.NEXT_PUBLIC_ROUTER_ADDRESS);

/** Fee recipient for launches deployed without a factory. */
export const TREASURY_ADDRESS = address(process.env.NEXT_PUBLIC_TREASURY_ADDRESS);

/** LaunchpadToken (contracts/src/LaunchpadToken.sol), once deployed. */
export const LAUNCHPAD_TOKEN_ADDRESS = address(process.env.NEXT_PUBLIC_LAUNCHPAD_TOKEN_ADDRESS);

/** MerkleAirdrop (contracts/src/MerkleAirdrop.sol), once deployed. */
export const AIRDROP_ADDRESS = address(process.env.NEXT_PUBLIC_AIRDROP_ADDRESS);

/**
 * Reads are batched at the JSON-RPC transport level rather than through an
 * on-chain aggregator, so no third-party contract sits between the app and the
 * data it renders. This caps how many calls ride in one HTTP request.
 */
export const RPC_BATCH_SIZE = integer(process.env.NEXT_PUBLIC_RPC_BATCH_SIZE, 20);

export const LOG_CHUNK = integer(process.env.NEXT_PUBLIC_LOG_CHUNK, 9000);
export const TRADE_LOOKBACK_BLOCKS = integer(process.env.NEXT_PUBLIC_TRADE_LOOKBACK, 200000);

export const SITE_NAME = text(process.env.NEXT_PUBLIC_SITE_NAME, "Hoodpad");

/** Optional ETH/USD rate; USD figures are hidden entirely when unset. */
export const ETH_USD = decimal(process.env.NEXT_PUBLIC_ETH_USD);

export const HAS_FACTORY = FACTORY_ADDRESS !== null;
export const HAS_ROUTER = ROUTER_ADDRESS !== null;
