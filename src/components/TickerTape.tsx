"use client";

import Link from "next/link";
import CoinAvatar from "@/components/CoinAvatar";
import { sortCoins, useCoins } from "@/hooks/useCoins";
import { progress } from "@/lib/curve";
import { NATIVE_SYMBOL } from "@/lib/env";
import { formatEth, formatUsd } from "@/lib/format";

/**
 * A scrolling tape of the busiest coins under the nav. It polls slowly — this
 * is ambient context, not the board — and stays hidden until there is
 * something to show.
 */
export default function TickerTape() {
  const { coins } = useCoins({ pollMs: 60000, limit: 24 });
  if (coins.length === 0) return null;

  // A short list is repeated so each loop still spans the bar on a quiet chain.
  const top = sortCoins(coins, "trending").slice(0, 16);
  const items = Array.from({ length: Math.ceil(8 / top.length) }, () => top).flat();

  return (
    <div
      className="group relative flex h-[34px] items-center overflow-hidden border-b border-line bg-elevated mask-[linear-gradient(90deg,transparent,#000_5%,#000_95%,transparent)]"
      aria-label="Live coins"
    >
      <div className="flex w-max animate-ticker group-hover:[animation-play-state:paused]">
        {/* Two identical groups, each with trailing padding instead of a gap, so
            translating by half the track loops without a jump. */}
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="flex items-center gap-7 pr-7"
            aria-hidden={copy === 1 ? true : undefined}
          >
            <span className="inline-flex items-center gap-[7px] font-mono text-[10.5px] tracking-[0.14em] whitespace-nowrap text-accent uppercase">
              <span className="live-dot" />
              Live
            </span>
            {items.map((coin, index) => {
              const live = coin.curveSupply > 0n && !coin.graduated;
              return (
                <Link
                  key={`${index}-${coin.address}`}
                  href={`/coin/${coin.address}`}
                  className="group/item inline-flex items-center gap-[7px] font-mono text-xs whitespace-nowrap text-muted"
                  tabIndex={copy === 1 ? -1 : undefined}
                >
                  <CoinAvatar
                    address={coin.address}
                    symbol={coin.symbol}
                    image={coin.meta.image}
                    size={18}
                  />
                  <strong className="font-semibold text-fg group-hover/item:text-accent">
                    ${coin.symbol}
                  </strong>
                  <span>
                    {formatUsd(coin.marketCapWei) ??
                      `${formatEth(coin.marketCapWei, 3)} ${NATIVE_SYMBOL}`}
                  </span>
                  {coin.graduated ? (
                    <span className="text-up">GRAD</span>
                  ) : live ? (
                    <span className="text-accent">{Math.round(progress(coin) * 100)}%</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
