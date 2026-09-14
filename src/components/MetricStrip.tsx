import { NATIVE_SYMBOL } from "@/lib/env";
import { formatEth, formatUsd } from "@/lib/format";
import type { Coin } from "@/lib/types";

/**
 * Headline market numbers for the listed coins, summed from the same on-chain
 * state the board renders — nothing here is estimated or backfilled.
 */
export default function MetricStrip({ coins }: { coins: readonly Coin[] }) {
  const live = coins.filter((coin) => coin.curveSupply > 0n && !coin.graduated);
  const graduated = coins.filter((coin) => coin.graduated).length;
  const volume = coins.reduce((sum, coin) => sum + coin.volume, 0n);
  const raised = live.reduce((sum, coin) => sum + coin.ethReserve, 0n);
  const top = coins.reduce<Coin | null>(
    (best, coin) => (!best || coin.marketCapWei > best.marketCapWei ? coin : best),
    null,
  );

  const metrics = [
    {
      label: "Coins listed",
      value: coins.length.toLocaleString("en-US"),
      sub: `${live.length} trading on a curve`,
    },
    {
      label: "All-time volume",
      value: `${formatEth(volume, 3)} ${NATIVE_SYMBOL}`,
      sub: formatUsd(volume) ?? "through every curve",
    },
    {
      label: "Raised on live curves",
      value: `${formatEth(raised, 3)} ${NATIVE_SYMBOL}`,
      sub: formatUsd(raised) ?? "waiting to graduate",
    },
    {
      label: "Graduated",
      value: graduated.toLocaleString("en-US"),
      sub:
        coins.length === 0
          ? "no launches yet"
          : `${Math.round((graduated / coins.length) * 100)}% of launches`,
    },
    {
      label: "Top market cap",
      value: top ? `$${top.symbol}` : "—",
      sub: top ? (formatUsd(top.marketCapWei) ?? `${formatEth(top.marketCapWei, 3)} ${NATIVE_SYMBOL}`) : "—",
    },
  ];

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5 max-sm:grid-cols-2">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="relative overflow-hidden rounded-xl border border-line bg-panel px-4 py-3.5 max-sm:px-3 max-sm:last:col-span-2"
        >
          <div className="flex items-center gap-1.5 text-xs text-muted">{metric.label}</div>
          <div className="mono mt-1.5 text-[22px] leading-[1.1] font-semibold tracking-[-0.03em] max-sm:text-base">
            {metric.value}
          </div>
          <div className="mt-1 text-xs text-dim">{metric.sub}</div>
        </div>
      ))}
    </div>
  );
}
