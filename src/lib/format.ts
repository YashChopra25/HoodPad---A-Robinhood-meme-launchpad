import { formatEther, formatUnits } from "viem";
import { ETH_USD, NATIVE_SYMBOL } from "@/lib/env";

const DECIMALS = 18;

function trim(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

/** Compact token amounts: 1.2K, 340M, 1.05B. */
export function formatTokens(value: bigint | null | undefined, decimals = DECIMALS): string {
  if (value === undefined || value === null) return "—";
  const whole = Number(formatUnits(value, decimals));
  if (whole === 0) return "0";
  if (whole < 0.0001) return "<0.0001";
  if (whole < 1000) return trim(whole.toFixed(4));

  const units: Array<[number, string]> = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (whole >= size) return `${trim((whole / size).toFixed(2))}${suffix}`;
  }
  return trim(whole.toFixed(2));
}

/**
 * ETH amounts. Curve prices run to nine or ten decimal places early on, so
 * sub-1 values keep four significant digits rather than a fixed width.
 */
export function formatEth(value: bigint | null | undefined, maxDecimals = 5): string {
  if (value === undefined || value === null) return "—";
  if (value === 0n) return "0";

  const [whole, fraction = ""] = formatEther(value).split(".");
  if (whole !== "0") return trim(`${whole}.${fraction.slice(0, maxDecimals)}`);

  const leadingZeros = /^0*/.exec(fraction)?.[0].length ?? 0;
  const result = trim(`0.${fraction.slice(0, Math.max(maxDecimals, leadingZeros + 4))}`);
  return result === "0" ? "<0.00001" : result;
}

/** Approximate USD, or null when no rate is configured. */
export function formatUsd(wei: bigint | null | undefined): string | null {
  if (wei === undefined || wei === null || !ETH_USD) return null;
  const usd = Number(formatEther(wei)) * ETH_USD;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(1)}K`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd > 0) return `$${usd.toFixed(4)}`;
  return "$0";
}

export function shortenAddress(address: string | null | undefined, size = 4): string {
  if (!address) return "—";
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`;
}

export function formatPercent(bps: bigint | number | null | undefined): string {
  if (bps === undefined || bps === null) return "—";
  return `${trim((Number(bps) / 100).toFixed(2))}%`;
}

/** "just now", "3m ago", "5d ago". */
export function timeAgo(timestampSeconds: number | undefined | null): string {
  if (!timestampSeconds) return "";
  const seconds = Math.floor(Date.now() / 1000) - timestampSeconds;
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** Wallet and RPC errors nest deeply; surface the one useful line. */
export function readableError(error: unknown): string {
  if (!error) return "";
  const candidate = error as {
    shortMessage?: string;
    details?: string;
    reason?: string;
    message?: string;
  };
  const message =
    candidate.shortMessage ?? candidate.details ?? candidate.reason ?? candidate.message ?? String(error);

  if (/user rejected|denied transaction|user denied/i.test(message)) {
    return "Transaction rejected in your wallet.";
  }
  if (/insufficient funds/i.test(message)) {
    return `Not enough ${NATIVE_SYMBOL} to cover this transaction and gas.`;
  }
  return message.split("\n")[0];
}

/** Deterministic accent hue for a coin with no image. */
export function addressHue(address: string | null | undefined): number {
  if (!address || address.length < 4) return 150;
  return parseInt(address.slice(-4), 16) % 360;
}

/** Strips whitespace and rejects anything that is not an http(s) link. */
export function safeLink(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/** Accepts "@handle", a bare handle, or a full URL; returns a profile link. */
export function twitterUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://x.com/${trimmed.replace(/^@/, "")}`;
}

export function telegramUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://t.me/${trimmed.replace(/^@/, "")}`;
}
