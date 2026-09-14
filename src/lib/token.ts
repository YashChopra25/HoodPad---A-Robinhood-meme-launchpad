import { parseEther, type Address, type EIP1193Provider } from "viem";
import { MEME_TOKEN_ABI, MEME_TOKEN_BYTECODE } from "@/contracts/MemeToken";
import { getPublicClient, getWalletClient } from "@/lib/clients";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { ZERO_ADDRESS } from "@/lib/env";
import type { Coin, CoinMeta, CoinState, CurveConfig, LaunchConfig, TxResult } from "@/lib/types";

export { MEME_TOKEN_ABI, MEME_TOKEN_BYTECODE };

interface Signer {
  provider: EIP1193Provider | null;
  account: Address | null;
}

/**
 * A whole coin comes back from one `getState()` call, so a card on the board
 * costs a single request rather than fifteen.
 */
async function readState(address: Address): Promise<CoinState> {
  const state = await getPublicClient().readContract({
    address,
    abi: MEME_TOKEN_ABI,
    functionName: "getState",
  });
  return { address, ...state } as CoinState;
}

/** Fetched separately from the state: `image` can be an inline data URI. */
async function readMeta(address: Address): Promise<CoinMeta> {
  const meta = await getPublicClient().readContract({
    address,
    abi: MEME_TOKEN_ABI,
    functionName: "getMeta",
  });
  return meta as CoinMeta;
}

export async function readCoin(address: Address): Promise<Coin> {
  const [state, meta] = await Promise.all([readState(address), readMeta(address)]);
  return { ...state, meta };
}

/** Reads many coins at once. Addresses that fail to read are dropped. */
export async function readCoins(addresses: readonly Address[]): Promise<Coin[]> {
  const settled = await Promise.allSettled(addresses.map(readCoin));
  return settled
    .filter((entry): entry is PromiseFulfilledResult<Coin> => entry.status === "fulfilled")
    .map((entry) => entry.value);
}

export async function readBalance(
  address: Address,
  account: Address | null,
): Promise<bigint | null> {
  if (!account) return null;
  return getPublicClient().readContract({
    address,
    abi: MEME_TOKEN_ABI,
    functionName: "balanceOf",
    args: [account],
  });
}

export function readAllowance(address: Address, owner: Address, spender: Address) {
  return getPublicClient().readContract({
    address,
    abi: MEME_TOKEN_ABI,
    functionName: "allowance",
    args: [owner, spender],
  });
}

// --- writes ------------------------------------------------------------------

/**
 * Every write simulates first, so a revert surfaces as a readable message
 * before the user is asked to sign anything.
 */
async function write<TArgs extends readonly unknown[]>(
  { provider, account }: Signer,
  address: Address,
  functionName: string,
  args: TArgs,
  value?: bigint,
): Promise<TxResult> {
  if (!account) throw new Error("Connect a wallet first.");
  const publicClient = getPublicClient();

  const { request } = await publicClient.simulateContract({
    address,
    abi: MEME_TOKEN_ABI,
    // The ABI is a const assertion, so viem narrows these per function; the
    // generic wrapper is deliberately looser than each individual call.
    functionName: functionName as never,
    args: args as never,
    account,
    value,
  });

  const hash = await getWalletClient(provider, account).writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${functionName} reverted`);
  return { hash };
}

export function buy(
  signer: Signer,
  address: Address,
  ethAmount: string,
  minTokensOut: bigint = 0n,
): Promise<TxResult> {
  return write(signer, address, "buy", [minTokensOut, ZERO_ADDRESS], parseEther(ethAmount));
}

export function sell(
  signer: Signer,
  address: Address,
  tokenAmount: bigint,
  minEthOut: bigint = 0n,
): Promise<TxResult> {
  return write(signer, address, "sell", [tokenAmount, minEthOut]);
}

export function approve(
  signer: Signer,
  address: Address,
  spender: Address,
  amount: bigint,
): Promise<TxResult> {
  return write(signer, address, "approve", [spender, amount]);
}

export function graduate(signer: Signer, address: Address): Promise<TxResult> {
  return write(signer, address, "graduate", []);
}

export function renounceOwnership(signer: Signer, address: Address): Promise<TxResult> {
  return write(signer, address, "renounceOwnership", []);
}

export function setRouter(signer: Signer, address: Address, router: Address): Promise<TxResult> {
  return write(signer, address, "setRouter", [router]);
}

export function setPair(signer: Signer, address: Address, pair: Address): Promise<TxResult> {
  return write(signer, address, "setPair", [pair]);
}

export function updateMetadata(
  signer: Signer,
  address: Address,
  meta: CoinMeta,
): Promise<TxResult> {
  return write(signer, address, "updateMetadata", [
    meta.image,
    meta.description,
    meta.website,
    meta.twitter,
    meta.telegram,
  ]);
}

/**
 * Deploys a launch straight from the wallet, with no factory in between. Used
 * when NEXT_PUBLIC_FACTORY_ADDRESS is unset; the coin is then discoverable only
 * by address or through this browser's local registry.
 */
export async function deployDirect(
  { provider, account }: Signer,
  config: LaunchConfig,
  curve: CurveConfig,
): Promise<{ hash: `0x${string}`; address: Address }> {
  if (!account) throw new Error("Connect a wallet first.");
  const publicClient = getPublicClient();

  const hash = await getWalletClient(provider, account).deployContract({
    abi: MEME_TOKEN_ABI,
    bytecode: MEME_TOKEN_BYTECODE,
    args: [config, curve],
    account,
    chain: ACTIVE_CHAIN,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Deployment reverted");
  if (!receipt.contractAddress) throw new Error("Deployment produced no address");

  return { hash, address: receipt.contractAddress };
}
