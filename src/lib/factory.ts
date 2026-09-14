import { parseAbiItem, type Address, type EIP1193Provider } from "viem";
import { MEME_FACTORY_ABI, MEME_FACTORY_BYTECODE } from "@/contracts/MemeFactory";
import { getPublicClient, getWalletClient } from "@/lib/clients";
import {
  ACTIVE_NETWORK,
  FACTORY_ADDRESS,
  LOG_CHUNK,
  ROUTER_ADDRESS,
  TREASURY_ADDRESS,
  ZERO_ADDRESS,
} from "@/lib/env";
import { presetFor } from "@/lib/presets";
import type { Economics, LaunchConfig, LaunchOptions } from "@/lib/types";

export { MEME_FACTORY_ABI, MEME_FACTORY_BYTECODE };

/**
 * The active network's preset, used when no factory is deployed so a direct
 * launch still gets sensible curve parameters and the create form can quote
 * real numbers. `deploy:factory` writes these same values into the factory.
 */
export const DEFAULT_ECONOMICS: Economics = {
  ...presetFor(ACTIVE_NETWORK),
  treasury: TREASURY_ADDRESS,
  defaultRouter: ROUTER_ADDRESS,
  source: "defaults",
};

/**
 * Fees and curve parameters read off the deployed factory, so the UI always
 * quotes what the contract will actually charge.
 */
export async function readEconomics(): Promise<Economics> {
  if (!FACTORY_ADDRESS) return DEFAULT_ECONOMICS;

  const publicClient = getPublicClient();
  const contract = { address: FACTORY_ADDRESS, abi: MEME_FACTORY_ABI } as const;

  const [
    baseFee,
    antiBotFee,
    antiWhaleFee,
    taxFee,
    tradeFeeBps,
    platformTaxBps,
    virtualEth,
    graduationTarget,
    treasury,
    defaultRouter,
  ] = await Promise.all([
    publicClient.readContract({ ...contract, functionName: "baseFee" }),
    publicClient.readContract({ ...contract, functionName: "antiBotFee" }),
    publicClient.readContract({ ...contract, functionName: "antiWhaleFee" }),
    publicClient.readContract({ ...contract, functionName: "taxFee" }),
    publicClient.readContract({ ...contract, functionName: "tradeFeeBps" }),
    publicClient.readContract({ ...contract, functionName: "platformTaxBps" }),
    publicClient.readContract({ ...contract, functionName: "virtualEth" }),
    publicClient.readContract({ ...contract, functionName: "graduationTarget" }),
    publicClient.readContract({ ...contract, functionName: "treasury" }),
    publicClient.readContract({ ...contract, functionName: "defaultRouter" }),
  ]);

  return {
    baseFee,
    antiBotFee,
    antiWhaleFee,
    taxFee,
    tradeFeeBps,
    platformTaxBps,
    virtualEth,
    graduationTarget,
    treasury,
    defaultRouter: defaultRouter === ZERO_ADDRESS ? null : defaultRouter,
    source: "factory",
  };
}

export function quoteFee(economics: Economics, options: LaunchOptions): bigint {
  return (
    economics.baseFee +
    (options.antiBot ? economics.antiBotFee : 0n) +
    (options.antiWhale ? economics.antiWhaleFee : 0n) +
    (options.customTax ? economics.taxFee : 0n)
  );
}

// --- registry ----------------------------------------------------------------

/** Newest-first page of launch addresses, straight from the registry. */
export async function readLatest(offset = 0, limit = 48): Promise<readonly Address[]> {
  if (!FACTORY_ADDRESS) return [];
  return getPublicClient().readContract({
    address: FACTORY_ADDRESS,
    abi: MEME_FACTORY_ABI,
    functionName: "tokensLatest",
    args: [BigInt(offset), BigInt(limit)],
  });
}

export async function readCreatedBy(creator: Address | null): Promise<readonly Address[]> {
  if (!FACTORY_ADDRESS || !creator) return [];
  return getPublicClient().readContract({
    address: FACTORY_ADDRESS,
    abi: MEME_FACTORY_ABI,
    functionName: "tokensOf",
    args: [creator],
  });
}

export interface LaunchRecord {
  timestamp: number;
  creator: Address;
  blockNumber: bigint;
}

/**
 * Launch timestamps, pulled from `Launched` logs.
 *
 * Orbit RPCs cap `eth_getLogs` ranges, so the scan is chunked and walks
 * backwards from the head: recent launches resolve in the first window and the
 * walk stops as soon as every address is accounted for.
 */
export async function readLaunchTimes(
  addresses: readonly Address[],
  { maxChunks = 10 }: { maxChunks?: number } = {},
): Promise<Map<string, LaunchRecord>> {
  const found = new Map<string, LaunchRecord>();
  if (!FACTORY_ADDRESS || addresses.length === 0) return found;

  const publicClient = getPublicClient();
  const wanted = new Set(addresses.map((address) => address.toLowerCase()));
  const step = BigInt(LOG_CHUNK);
  let to = await publicClient.getBlockNumber();

  for (let chunk = 0; chunk < maxChunks && to > 0n && found.size < wanted.size; chunk++) {
    const from = to > step ? to - step : 0n;

    try {
      const logs = await publicClient.getLogs({
        address: FACTORY_ADDRESS,
        event: LAUNCHED_EVENT,
        fromBlock: from,
        toBlock: to,
      });

      for (const log of logs) {
        const token = log.args.token?.toLowerCase();
        if (!token || !wanted.has(token) || found.has(token)) continue;
        found.set(token, {
          timestamp: Number(log.args.timestamp ?? 0n),
          creator: log.args.creator as Address,
          blockNumber: log.blockNumber,
        });
      }
    } catch {
      // A range the RPC refuses is not worth retrying smaller: the board just
      // renders those coins without a launch time.
      break;
    }

    if (from === 0n) break;
    to = from - 1n;
  }

  return found;
}

/**
 * Spelled out rather than looked up in the generated ABI so the decoded log
 * arrives fully typed. Must stay in step with MemeFactory's `Launched` event.
 */
const LAUNCHED_EVENT = parseAbiItem(
  "event Launched(address indexed token, address indexed creator, string name, string symbol, bool hasCurve, uint256 timestamp)",
);

// --- writes ------------------------------------------------------------------

/**
 * Launch through the factory. Anything sent above the fee becomes the
 * creator's opening buy on the new curve, settled in the same transaction.
 */
export async function launch({
  provider,
  account,
  config,
  fee,
  openingBuyWei = 0n,
}: {
  provider: EIP1193Provider | null;
  account: Address | null;
  config: LaunchConfig;
  fee: bigint;
  openingBuyWei?: bigint;
}): Promise<{ hash: `0x${string}`; address: Address }> {
  if (!FACTORY_ADDRESS) throw new Error("No factory is configured.");
  if (!account) throw new Error("Connect a wallet first.");

  const publicClient = getPublicClient();
  const { request, result } = await publicClient.simulateContract({
    address: FACTORY_ADDRESS,
    abi: MEME_FACTORY_ABI,
    functionName: "launch",
    args: [config],
    account,
    value: fee + openingBuyWei,
  });

  const hash = await getWalletClient(provider, account).writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Launch reverted");

  return { hash, address: result };
}
