import type { CoinState } from "@/lib/types";

/**
 * Client-side mirror of MemeToken's curve math, so the trade panel can quote on
 * every keystroke without a round trip. The contract stays the source of truth:
 * every trade is simulated against it before the user is asked to sign.
 */

type CurveLike = Pick<
  CoinState,
  | "curveSupply"
  | "tokenReserve"
  | "ethReserve"
  | "virtualEth"
  | "graduationTarget"
  | "tradeFeeBps"
  | "graduated"
>;

function ceilDiv(a: bigint, b: bigint): bigint {
  return a === 0n ? 0n : (a - 1n) / b + 1n;
}

function isLive(state: CurveLike | null | undefined): state is CurveLike {
  return Boolean(state) && state!.curveSupply > 0n && !state!.graduated;
}

/** Tokens `ethIn` buys, and the curve fee taken out of it. */
export function quoteBuy(
  state: CurveLike | null | undefined,
  ethIn: bigint,
): { tokensOut: bigint; fee: bigint } {
  if (!isLive(state) || ethIn <= 0n) return { tokensOut: 0n, fee: 0n };

  const fee = (ethIn * state.tradeFeeBps) / 10000n;
  const k = state.virtualEth * state.curveSupply;
  const next = ceilDiv(k, state.virtualEth + state.ethReserve + (ethIn - fee));
  return { tokensOut: state.tokenReserve > next ? state.tokenReserve - next : 0n, fee };
}

/** ETH `tokensIn` returns, and the curve fee taken out of it. */
export function quoteSell(
  state: CurveLike | null | undefined,
  tokensIn: bigint,
): { ethOut: bigint; fee: bigint } {
  if (!isLive(state) || tokensIn <= 0n) return { ethOut: 0n, fee: 0n };

  const k = state.virtualEth * state.curveSupply;
  const nextTotal = k / (state.tokenReserve + tokensIn);
  const total = state.virtualEth + state.ethReserve;
  let gross = total > nextTotal ? total - nextTotal : 0n;
  if (gross > state.ethReserve) gross = state.ethReserve;

  const fee = (gross * state.tradeFeeBps) / 10000n;
  return { ethOut: gross - fee, fee };
}

/** How far the curve has come towards graduating, 0–1. */
export function progress(state: CurveLike | null | undefined): number {
  if (!state || state.curveSupply === 0n) return 0;
  if (state.graduated) return 1;
  if (state.graduationTarget === 0n) return 0;
  return Math.min(1, Number((state.ethReserve * 10000n) / state.graduationTarget) / 10000);
}

/** Applies a slippage tolerance, in percent, to a quoted output. */
export function withSlippage(amount: bigint, tolerancePercent: number): bigint {
  const clamped = Math.max(0, Math.min(50, tolerancePercent));
  return (amount * (10000n - BigInt(Math.round(clamped * 100)))) / 10000n;
}

/**
 * What the pool will hold at graduation. Shown on the coin page so a buyer can
 * see what will back the market once the curve closes.
 */
export function reservesAtGraduation(state: CurveLike | null | undefined): {
  tokens: bigint;
  eth: bigint;
} {
  if (!state || state.curveSupply === 0n) return { tokens: 0n, eth: 0n };
  const k = state.virtualEth * state.curveSupply;
  return { tokens: k / (state.virtualEth + state.graduationTarget), eth: state.graduationTarget };
}
