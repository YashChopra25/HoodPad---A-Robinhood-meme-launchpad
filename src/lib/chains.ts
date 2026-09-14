import { defineChain, type Chain } from "viem";
import {
  ACTIVE_NETWORK,
  MAINNET_ENV,
  NATIVE_NAME,
  NATIVE_SYMBOL,
  SEPOLIA_ENV,
  TESTNET_ENV,
  type NetworkEnv,
} from "@/lib/env";

/**
 * Robinhood Chain is a public Arbitrum Orbit network that uses ETH for gas.
 * The ids, endpoints and explorers all come from the environment, so pointing
 * the app at a fork or a private RPC needs no code change.
 *
 * No aggregator contract is registered here on purpose: every read goes
 * straight to the RPC, so nothing the app renders depends on a third-party
 * deployment. Batching happens at the transport level instead.
 */
function toChain(env: NetworkEnv): Chain {
  return defineChain({
    id: env.id,
    name: env.name,
    nativeCurrency: { name: NATIVE_NAME, symbol: NATIVE_SYMBOL, decimals: 18 },
    rpcUrls: { default: { http: [env.rpcUrl] } },
    blockExplorers: { default: { name: env.explorerName, url: env.explorerUrl } },
    testnet: env.key === "testnet",
  });
}

const robinhoodMainnet = toChain(MAINNET_ENV);
const robinhoodTestnet = toChain(TESTNET_ENV);
const ethereumSepolia = toChain(SEPOLIA_ENV);

const SUPPORTED_CHAINS: Chain[] = [robinhoodMainnet, robinhoodTestnet, ethereumSepolia];

const CHAIN_BY_NETWORK = {
  mainnet: robinhoodMainnet,
  testnet: robinhoodTestnet,
  sepolia: ethereumSepolia,
} as const;

export const ACTIVE_CHAIN: Chain = CHAIN_BY_NETWORK[ACTIVE_NETWORK];

export const IS_TESTNET = ACTIVE_CHAIN.testnet === true;

export function getChainById(chainId: number | null): Chain | undefined {
  return SUPPORTED_CHAINS.find((chain) => chain.id === chainId);
}

function explorerBase(chain: Chain): string {
  return chain.blockExplorers?.default.url ?? "";
}

export function explorerAddressUrl(address: string, chain: Chain = ACTIVE_CHAIN): string {
  return `${explorerBase(chain)}/address/${address}`;
}

export function explorerTxUrl(hash: string, chain: Chain = ACTIVE_CHAIN): string {
  return `${explorerBase(chain)}/tx/${hash}`;
}

/** Shape `wallet_addEthereumChain` expects when the wallet lacks the network. */
export function toAddChainParams(chain: Chain = ACTIVE_CHAIN) {
  return {
    chainId: `0x${chain.id.toString(16)}`,
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: [...chain.rpcUrls.default.http],
    blockExplorerUrls: [explorerBase(chain)],
  };
}
