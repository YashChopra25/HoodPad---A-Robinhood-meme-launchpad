import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type Chain,
  type EIP1193Provider,
  type PublicClient,
  type WalletClient,
} from "viem";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { RPC_BATCH_SIZE } from "@/lib/env";

let cached: { chainId: number; client: PublicClient } | null = null;

/**
 * Read-only client against the network's own RPC.
 *
 * Calls are batched at the JSON-RPC layer — several `eth_call`s ride in one
 * HTTP request — rather than through an on-chain aggregator, so no third-party
 * contract is trusted with what the UI displays. The contracts help here too:
 * `getState()` returns a whole coin in a single call.
 */
export function getPublicClient(chain: Chain = ACTIVE_CHAIN): PublicClient {
  if (cached?.chainId === chain.id) return cached.client;
  const client = createPublicClient({
    chain,
    transport: http(undefined, { batch: { batchSize: RPC_BATCH_SIZE, wait: 16 } }),
  });
  cached = { chainId: chain.id, client };
  return client;
}

/** Signing client bound to the chosen wallet's provider and account. */
export function getWalletClient(
  provider: EIP1193Provider | null,
  account: Address | null,
  chain: Chain = ACTIVE_CHAIN,
): WalletClient {
  if (!provider) throw new Error("Connect a wallet first.");
  if (!account) throw new Error("No account selected in your wallet.");
  return createWalletClient({ account, chain, transport: custom(provider) });
}
