import { parseAbiItem, type Address } from "viem";
import { getPublicClient } from "@/lib/clients";
import { LOG_CHUNK, TRADE_LOOKBACK_BLOCKS } from "@/lib/env";
import type { CoinState, PricePoint, Trade } from "@/lib/types";

/**
 * Spelled out rather than looked up in the generated ABI so the decoded log
 * arrives fully typed. It must stay in step with MemeToken's `Trade` event —
 * a mismatch shows up immediately as an empty feed.
 */
const TRADE_EVENT = parseAbiItem(
  "event Trade(address indexed trader, bool indexed isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 ethReserveAfter, uint256 tokenReserveAfter, uint256 timestamp)",
);

/**
 * Trade history for one coin, read straight from its `Trade` logs. The price
 * chart and the trade feed are both built from this, so the app needs no
 * indexer and no server.
 *
 * Scans backwards in chunks from the head and stops once it has enough, which
 * keeps a busy coin cheap and a quiet one bounded.
 */
export async function readTrades(
  address: Address,
  { limit = 300, fromBlock }: { limit?: number; fromBlock?: bigint | null } = {},
): Promise<Trade[]> {
  const publicClient = getPublicClient();
  const latest = await publicClient.getBlockNumber();
  const step = BigInt(LOG_CHUNK);
  const lookback = BigInt(TRADE_LOOKBACK_BLOCKS);

  const floor =
    fromBlock !== undefined && fromBlock !== null
      ? fromBlock
      : latest > lookback
        ? latest - lookback
        : 0n;

  const collected: Trade[] = [];
  let to = latest;

  while (to >= floor && collected.length < limit) {
    const from = to - step > floor ? to - step : floor;

    try {
      const logs = await publicClient.getLogs({
        address,
        event: TRADE_EVENT,
        fromBlock: from,
        toBlock: to,
      });
      for (const log of logs) {
        collected.push({
          trader: log.args.trader as Address,
          isBuy: Boolean(log.args.isBuy),
          ethAmount: log.args.ethAmount ?? 0n,
          tokenAmount: log.args.tokenAmount ?? 0n,
          ethReserveAfter: log.args.ethReserveAfter ?? 0n,
          tokenReserveAfter: log.args.tokenReserveAfter ?? 0n,
          timestamp: Number(log.args.timestamp ?? 0n),
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          hash: log.transactionHash,
          key: `${log.transactionHash}-${log.logIndex}`,
        });
      }
    } catch {
      break;
    }

    if (from === floor) break;
    to = from - 1n;
  }

  // Windows arrive newest-first but are ascending within each one.
  collected.sort((a, b) =>
    a.blockNumber === b.blockNumber
      ? a.logIndex - b.logIndex
      : Number(a.blockNumber - b.blockNumber),
  );

  return collected.slice(-limit);
}

/**
 * The price series the chart draws. Price comes from the reserves the contract
 * recorded with each trade, so the line matches what the curve actually
 * charged rather than an average of fills.
 */
export function toPriceSeries(trades: readonly Trade[], state: CoinState | null): PricePoint[] {
  if (!state || state.curveSupply === 0n) return [];

  const points: PricePoint[] = trades.map((trade) => ({
    t: trade.timestamp,
    price:
      trade.tokenReserveAfter === 0n
        ? 0
        : Number(state.virtualEth + trade.ethReserveAfter) / Number(trade.tokenReserveAfter),
    isBuy: trade.isBuy,
  }));

  // Seed the line at the opening price so a coin with a single trade still
  // draws a slope rather than one dot.
  const opening = Number(state.virtualEth) / Number(state.curveSupply);
  const first = points[0];
  if (first) points.unshift({ t: first.t - 60, price: opening, isBuy: true });
  else points.push({ t: Math.floor(Date.now() / 1000), price: opening, isBuy: true });

  return points;
}

/**
 * Price change over the window, as a fraction. Compares the current curve
 * price against the earliest trade that still falls inside it.
 */
export function priceChange(
  trades: readonly Trade[],
  state: CoinState | null,
  windowSeconds = 86400,
): number | null {
  if (!state || trades.length === 0) return null;

  const cutoff = Math.floor(Date.now() / 1000) - windowSeconds;
  const baseline = trades.find((trade) => trade.timestamp >= cutoff) ?? trades[0];
  if (baseline.tokenReserveAfter === 0n) return null;

  const then =
    Number(state.virtualEth + baseline.ethReserveAfter) / Number(baseline.tokenReserveAfter);
  const now = state.tokenReserve === 0n
    ? then
    : Number(state.virtualEth + state.ethReserve) / Number(state.tokenReserve);

  return then === 0 ? null : (now - then) / then;
}
