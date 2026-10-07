"use client";

import CaChip from "@/components/CaChip";
import CoinAvatar from "@/components/CoinAvatar";
import Change from "@/components/ui/Change";
import Progress from "@/components/ui/Progress";
import { Stat, StatGrid } from "@/components/ui/Stat";
import { useWatchlist } from "@/hooks/useWatchlist";
import { progress } from "@/lib/curve";
import { NATIVE_SYMBOL } from "@/lib/env";
import {
  formatEth,
  formatTokens,
  formatUsd,
  safeLink,
  telegramUrl,
  timeAgo,
  twitterUrl,
} from "@/lib/format";
import type { Coin } from "@/lib/types";

export default function CoinHeader({
  coin,
  balance,
  change,
  volume,
}: {
  coin: Coin;
  balance: bigint | null;
  change: number | null;
  volume: bigint;
}) {
  const { isWatched, toggle } = useWatchlist();
  const hasCurve = coin.curveSupply > 0n;
  const live = hasCurve && !coin.graduated;
  const watched = isWatched(coin.address);
  const priceUsd = formatUsd(coin.price);
  const mcapUsd = formatUsd(coin.marketCapWei);

  const links: Array<[string, string | null]> = [
    ["Website", safeLink(coin.meta.website)],
    ["X", twitterUrl(coin.meta.twitter)],
    ["Telegram", telegramUrl(coin.meta.telegram)],
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_420px] items-start gap-4">
          <CoinAvatar address={coin.address} symbol={coin.symbol} image={coin.meta.image} size={68} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="pixel text-[clamp(28px,3.4vw,40px)] leading-none">{coin.name}</h1>
              {coin.graduated ? <span className="chip chip-up">✓ Graduated</span> : null}
              {live ? <span className="chip chip-accent">Bonding curve</span> : null}
              {!hasCurve ? <span className="chip">Fixed supply</span> : null}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[13px] text-muted">
              <span>{coin.symbol}</span>
              <span className="text-dim">/</span>
              <span>{NATIVE_SYMBOL}</span>
              {coin.launchedAt ? <span className="text-dim">· {timeAgo(coin.launchedAt)}</span> : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <CaChip address={coin.address} />
              {coin.antiBot ? <span className="chip">Anti-bot</span> : null}
              {coin.maxWallet > 0n ? <span className="chip">Anti-whale</span> : null}
              {coin.taxBps > 0n ? <span className="chip chip-warn">Taxed</span> : null}
              {links.map(([label, href]) =>
                href ? (
                  <a key={label} className="btn btn-sm" href={href} target="_blank" rel="noreferrer">
                    {label} ↗
                  </a>
                ) : null,
              )}
              <button className="btn btn-sm aria-pressed:bg-lime aria-pressed:text-lime-ink" onClick={() => toggle(coin.address)} aria-pressed={watched}>
                {watched ? "★ Watching" : "☆ Watch"}
              </button>
            </div>

            {coin.meta.description ? (
              <p className="mt-3 max-w-[640px] text-[13.5px] text-muted">{coin.meta.description}</p>
            ) : null}
          </div>
        </div>

        <div className="text-right max-sm:text-left">
          <div className="pixel text-[clamp(28px,3.6vw,42px)] leading-none">{priceUsd ?? formatEth(coin.price)}</div>
          <div className="mt-2 flex items-center justify-end gap-2 max-sm:justify-start">
            <span className="mono text-xs text-dim">
              {priceUsd ? `${formatEth(coin.price)} ${NATIVE_SYMBOL}` : `${NATIVE_SYMBOL} per token`}
            </span>
            <Change value={change} />
          </div>
        </div>
      </div>

      <StatGrid>
        <Stat
          label="Market cap"
          value={mcapUsd ?? `${formatEth(coin.marketCapWei, 3)} ${NATIVE_SYMBOL}`}
          sub={mcapUsd ? `${formatEth(coin.marketCapWei, 3)} ${NATIVE_SYMBOL}` : undefined}
        />
        <Stat label="Volume" value={`${formatEth(volume, 3)} ${NATIVE_SYMBOL}`} sub="all time" />
        <Stat
          label={live ? "Raised" : "Supply"}
          value={
            live
              ? `${formatEth(coin.ethReserve, 3)} ${NATIVE_SYMBOL}`
              : formatTokens(coin.totalSupply)
          }
          sub={live ? `of ${formatEth(coin.graduationTarget, 3)} target` : coin.symbol}
        />
        <Stat
          label="Your holding"
          value={balance === null ? "—" : formatTokens(balance)}
          sub={balance === null ? "not connected" : coin.symbol}
        />
      </StatGrid>
    </div>
  );
}

/** How full the curve is, and what happens when it fills. Only for live curves. */
export function CurveProgress({ coin }: { coin: Coin }) {
  const filled = progress(coin);
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <span className="card-title">Bonding curve</span>
        <span className="font-mono text-xs text-dim">
          {formatEth(coin.ethReserve, 3)} / {formatEth(coin.graduationTarget, 3)} {NATIVE_SYMBOL}
        </span>
      </div>
      <div className="pixel mt-2 text-[40px] leading-none">{Math.round(filled * 100)}%</div>
      <div className="mt-3">
        <Progress value={filled} label="Curve progress" />
      </div>
      <p className="field-hint mt-3">
        When the curve fills, everything left on it plus the whole raise moves into a Uniswap V2
        pool and the LP tokens are burned — the liquidity can never be pulled.
      </p>
    </div>
  );
}
