"use client";

import { explorerAddressUrl, explorerTxUrl } from "@/lib/chains";
import { NATIVE_SYMBOL } from "@/lib/env";
import { formatEth, formatTokens, shortenAddress, timeAgo } from "@/lib/format";
import type { Trade } from "@/lib/types";

// Shared by the header and every row so the columns line up. The token column
// is dropped on phones.
const GRID =
  "grid grid-cols-[64px_minmax(0,1fr)_110px_90px] items-center gap-3 px-[18px] py-[9px] max-sm:grid-cols-[52px_minmax(0,1fr)_92px] max-sm:px-3.5";

/** Every trade against the curve, newest first, straight from its own logs. */
export default function TradeFeed({
  trades,
  symbol,
  loading,
}: {
  trades: readonly Trade[];
  symbol: string;
  loading?: boolean;
}) {
  if (loading && trades.length === 0) {
    return (
      <div className="flex flex-col gap-1.5 p-4">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="skeleton h-[30px]" />
        ))}
      </div>
    );
  }

  if (trades.length === 0) {
    return <p className="field-hint p-[18px]">No trades yet — be the first.</p>;
  }

  return (
    <div className="flex max-h-[440px] flex-col overflow-y-auto">
      <div
        className={`${GRID} border-b border-line font-mono text-[10.5px] tracking-[0.1em] text-dim uppercase`}
      >
        <span>Side</span>
        <span>Trader</span>
        <span className="text-right">{NATIVE_SYMBOL}</span>
        <span className="text-right max-sm:hidden">{symbol}</span>
      </div>

      {[...trades].reverse().map((trade) => (
        <div
          key={trade.key}
          className={`${GRID} mono border-b border-line text-[12.5px] last:border-b-0 hover:bg-white/5`}
        >
          <span
            className={`justify-self-start rounded-[5px] px-[7px] py-px text-[10.5px] font-bold tracking-[0.06em] uppercase ${
              trade.isBuy ? "bg-up/12 text-up" : "bg-sell/12 text-sell"
            }`}
          >
            {trade.isBuy ? "Buy" : "Sell"}
          </span>

          <span className="min-w-0 overflow-hidden text-ellipsis">
            <a href={explorerAddressUrl(trade.trader)} target="_blank" rel="noreferrer" title={trade.trader}>
              {shortenAddress(trade.trader)}
            </a>
            <span className="text-dim"> · {timeAgo(trade.timestamp)}</span>
          </span>

          <a
            href={explorerTxUrl(trade.hash)}
            target="_blank"
            rel="noreferrer"
            className={`text-right whitespace-nowrap ${trade.isBuy ? "text-up" : "text-sell"}`}
            title="View transaction"
          >
            {trade.isBuy ? "+" : "−"}
            {formatEth(trade.ethAmount, 4)}
          </a>

          <span className="text-right whitespace-nowrap text-dim max-sm:hidden">
            {formatTokens(trade.tokenAmount)}
          </span>
        </div>
      ))}
    </div>
  );
}
