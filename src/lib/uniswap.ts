import { parseAbi, type Address, type EIP1193Provider } from "viem";
import { getPublicClient, getWalletClient } from "@/lib/clients";
import { ROUTER_ADDRESS, ZERO_ADDRESS } from "@/lib/env";
import type { PoolInfo, TxResult } from "@/lib/types";

/**
 * The slice of the Uniswap V2 interface the liquidity page needs.
 *
 * A curve launch reaches a pool on its own at graduation; this is for the
 * fixed-supply shape, where the creator seeds and manages the pool themselves.
 */
const ROUTER_ABI = parseAbi([
  "function factory() view returns (address)",
  "function WETH() view returns (address)",
  "function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)",
  "function removeLiquidityETH(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) returns (uint256 amountToken, uint256 amountETH)",
  "function removeLiquidityETHSupportingFeeOnTransferTokens(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) returns (uint256 amountETH)",
]);

const PAIR_FACTORY_ABI = parseAbi([
  "function getPair(address tokenA, address tokenB) view returns (address)",
  "function createPair(address tokenA, address tokenB) returns (address)",
]);

const PAIR_ABI = parseAbi([
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
]);

interface Signer {
  provider: EIP1193Provider | null;
  account: Address | null;
}

function requireRouter(): Address {
  if (!ROUTER_ADDRESS) {
    throw new Error("No Uniswap V2 router is configured for this network.");
  }
  return ROUTER_ADDRESS;
}

/** True when a router address is configured and actually holds code. */
export async function routerAvailable(): Promise<boolean> {
  if (!ROUTER_ADDRESS) return false;
  try {
    const code = await getPublicClient().getCode({ address: ROUTER_ADDRESS });
    return Boolean(code) && code !== "0x";
  } catch {
    return false;
  }
}

async function readRouterInfo(): Promise<{
  router: Address;
  pairFactory: Address;
  weth: Address;
}> {
  const router = requireRouter();
  const publicClient = getPublicClient();
  const [pairFactory, weth] = await Promise.all([
    publicClient.readContract({ address: router, abi: ROUTER_ABI, functionName: "factory" }),
    publicClient.readContract({ address: router, abi: ROUTER_ABI, functionName: "WETH" }),
  ]);
  return { router, pairFactory, weth };
}

/** Locates the token/WETH pool, and reads it when one exists. */
export async function readPool(token: Address, account: Address | null): Promise<PoolInfo> {
  const publicClient = getPublicClient();
  const { pairFactory, weth } = await readRouterInfo();

  const pair = await publicClient.readContract({
    address: pairFactory,
    abi: PAIR_FACTORY_ABI,
    functionName: "getPair",
    args: [token, weth],
  });

  if (!pair || pair === ZERO_ADDRESS) return { pair: null, weth, pairFactory };

  const [reserves, token0, lpTotalSupply, lpBalance] = await Promise.all([
    publicClient.readContract({ address: pair, abi: PAIR_ABI, functionName: "getReserves" }),
    publicClient.readContract({ address: pair, abi: PAIR_ABI, functionName: "token0" }),
    publicClient.readContract({ address: pair, abi: PAIR_ABI, functionName: "totalSupply" }),
    account
      ? publicClient.readContract({
          address: pair,
          abi: PAIR_ABI,
          functionName: "balanceOf",
          args: [account],
        })
      : Promise.resolve(null),
  ]);

  const tokenIsFirst = token0.toLowerCase() === token.toLowerCase();
  return {
    pair,
    weth,
    pairFactory,
    tokenReserve: tokenIsFirst ? BigInt(reserves[0]) : BigInt(reserves[1]),
    ethReserve: tokenIsFirst ? BigInt(reserves[1]) : BigInt(reserves[0]),
    lpTotalSupply,
    lpBalance,
  };
}

function deadline(minutes = 20): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + minutes * 60);
}

/**
 * Signs and waits on a request that `simulateContract` already validated, so
 * the shape is correct by construction; the cast only bridges viem's per-call
 * request types to this shared helper.
 */
async function submit({ provider, account }: Signer, request: unknown): Promise<TxResult> {
  const publicClient = getPublicClient();
  const hash = await getWalletClient(provider, account).writeContract(request as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Transaction reverted");
  return { hash };
}

/**
 * Creates the pool up front. Worth doing before funding it on a taxed token:
 * the pair can then be exempted, so the router is not handed less than it
 * asked for.
 */
export async function createPair(signer: Signer, token: Address): Promise<TxResult> {
  const { pairFactory, weth } = await readRouterInfo();
  const { request } = await getPublicClient().simulateContract({
    address: pairFactory,
    abi: PAIR_FACTORY_ABI,
    functionName: "createPair",
    args: [token, weth],
    account: signer.account!,
  });
  return submit(signer, request);
}

export async function addLiquidity(
  signer: Signer,
  {
    token,
    tokenAmount,
    ethAmount,
    slippagePercent = 1,
  }: { token: Address; tokenAmount: bigint; ethAmount: bigint; slippagePercent?: number },
): Promise<TxResult> {
  const router = requireRouter();
  const bps = BigInt(Math.round(Math.max(0, Math.min(50, slippagePercent)) * 100));

  const { request } = await getPublicClient().simulateContract({
    address: router,
    abi: ROUTER_ABI,
    functionName: "addLiquidityETH",
    args: [
      token,
      tokenAmount,
      (tokenAmount * (10000n - bps)) / 10000n,
      (ethAmount * (10000n - bps)) / 10000n,
      signer.account!,
      deadline(),
    ],
    account: signer.account!,
    value: ethAmount,
  });
  return submit(signer, request);
}

export async function removeLiquidity(
  signer: Signer,
  { token, lpAmount, taxed }: { token: Address; lpAmount: bigint; taxed: boolean },
): Promise<TxResult> {
  const router = requireRouter();
  // A token with a transfer tax hands the router less than it asked for, so
  // the fee-on-transfer variant is the only one that will not revert.
  const functionName = taxed
    ? "removeLiquidityETHSupportingFeeOnTransferTokens"
    : "removeLiquidityETH";

  const { request } = await getPublicClient().simulateContract({
    address: router,
    abi: ROUTER_ABI,
    functionName,
    args: [token, lpAmount, 0n, 0n, signer.account!, deadline()],
    account: signer.account!,
  });
  return submit(signer, request);
}

export async function approvePair(
  signer: Signer,
  { pair, amount }: { pair: Address; amount: bigint },
): Promise<TxResult> {
  const router = requireRouter();
  const { request } = await getPublicClient().simulateContract({
    address: pair,
    abi: PAIR_ABI,
    functionName: "approve",
    args: [router, amount],
    account: signer.account!,
  });
  return submit(signer, request);
}

export function readPairAllowance(pair: Address, owner: Address): Promise<bigint> {
  return getPublicClient().readContract({
    address: pair,
    abi: PAIR_ABI,
    functionName: "allowance",
    args: [owner, requireRouter()],
  });
}
