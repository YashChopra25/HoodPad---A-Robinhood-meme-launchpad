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
  const filled = progress(coin);
  const watched = isWatched(coin.address);
  const priceUsd = formatUsd(coin.price);
  const mcapUsd = formatUsd(coin.marketCapWei);

  const links: Array<[string, string | null]> = [
    ["Website", safeLink(coin.meta.website)],
    ["X", twitterUrl(coin.meta.twitter)],
    ["Telegram", telegramUrl(coin.meta.telegram)],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-[18px]">
        <div className="flex min-w-0 flex-[1_1_420px] items-start gap-4">
          <CoinAvatar address={coin.address} symbol={coin.symbol} image={coin.meta.image} size={72} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[clamp(22px,2.8vw,32px)] tracking-[-0.045em]">{coin.name}</h1>
              <span className="font-mono text-sm font-semibold text-accent">${coin.symbol}</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {coin.graduated ? <span className="chip chip-up">Graduated</span> : null}
              {live ? <span className="chip chip-accent">Bonding curve</span> : null}
              {!hasCurve ? <span className="chip">Fixed supply</span> : null}
              {coin.antiBot ? <span className="chip">🤖 Anti-bot</span> : null}
              {coin.maxWallet > 0n ? <span className="chip">🐋 Anti-whale</span> : null}
              {coin.taxBps > 0n ? <span className="chip chip-warn">💸 Taxed</span> : null}
              {coin.launchedAt ? (
                <span className="font-mono text-xs text-dim">launched {timeAgo(coin.launchedAt)}</span>
              ) : null}
            </div>

            {coin.meta.description ? (
              <p className="mt-2.5 max-w-[620px] text-muted">{coin.meta.description}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <CaChip address={coin.address} />
              {links.map(([label, href]) =>
                href ? (
                  <a key={label} className="btn btn-sm" href={href} target="_blank" rel="noreferrer">
                    {label} ↗
                  </a>
                ) : null,
              )}
              <button className="btn btn-sm" onClick={() => toggle(coin.address)} aria-pressed={watched}>
                {watched ? "★ Watching" : "☆ Watch"}
              </button>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono text-[10.5px] font-medium tracking-[0.12em] text-dim uppercase">
            Price · {NATIVE_SYMBOL}
          </div>
          <div className="mono mt-2 text-[clamp(26px,3.4vw,36px)] leading-none font-semibold tracking-[-0.045em]">
            {formatEth(coin.price)}
          </div>
          <div className="mt-2.5 flex items-center justify-end gap-2">
            {priceUsd ? <span className="mono text-dim">{priceUsd}</span> : null}
            <Change value={change} />
            <span className="font-mono text-[11px] text-dim">24H</span>
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

      {live ? (
        <div className="card">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <span className="card-title">Bonding curve progress</span>
            <span className="mono text-lg font-semibold text-accent">{Math.round(filled * 100)}%</span>
          </div>
          <Progress value={filled} label="Curve progress" />
          <p className="field-hint mt-2.5">
            {formatEth(coin.ethReserve, 3)} of {formatEth(coin.graduationTarget, 3)} {NATIVE_SYMBOL}{" "}
            raised. When the curve fills, everything left on it plus the whole raise moves into a
            Uniswap V2 pool and the LP tokens are burned — the liquidity can never be pulled.
          </p>
        </div>
      ) : null}
    </div>
  );
}
