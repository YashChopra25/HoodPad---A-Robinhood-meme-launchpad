"use client";

import { useMemo } from "react";
import Link from "next/link";
import CoinCard from "@/components/CoinCard";
import ImportCoin from "@/components/ImportCoin";
import Notice from "@/components/ui/Notice";
import Progress from "@/components/ui/Progress";
import { sortCoins, useCoins } from "@/hooks/useCoins";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { progress } from "@/lib/curve";
import { HAS_FACTORY, NATIVE_SYMBOL } from "@/lib/env";
import { formatEth, formatUsd } from "@/lib/format";
import type { Coin } from "@/lib/types";

/** A live curve at or past this share of its target moves to "Almost graduated". */
const ALMOST = 0.5;

const STEPS = [
  ["Create", "Name it, add a picture, pick guards. One signature deploys token and market."],
  ["Trade", "Buy and sell on the bonding curve from the very first block."],
  ["Graduate", "A full curve seeds a Uniswap V2 pool and burns the LP tokens."],
];

export default function TrenchesPage() {
  const { coins, loading, error, refresh } = useCoins();

  const columns = useMemo(() => {
    const live = coins.filter((coin) => coin.curveSupply > 0n && !coin.graduated);
    return [
      {
        key: "new",
        title: "New",
        hint: "Fresh launches on the curve",
        coins: sortCoins(live.filter((coin) => progress(coin) < ALMOST), "new"),
      },
      {
        key: "almost",
        title: "Almost graduated",
        hint: `Curves past ${ALMOST * 100}%`,
        coins: live.filter((coin) => progress(coin) >= ALMOST).sort((a, b) => progress(b) - progress(a)),
      },
      {
        key: "graduated",
        title: "Graduated",
        hint: "Pools live on Uniswap V2",
        coins: sortCoins(
          coins.filter((coin) => coin.graduated || coin.curveSupply === 0n),
          "mcap",
        ),
      },
    ];
  }, [coins]);

  return (
    <main className="page flex-1 pt-3">
      <div className="grid items-start gap-4 lg:grid-cols-[264px_minmax(0,1fr)]">
        <Sidebar coins={coins} loading={loading} />

        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="stamp">Trenches</h1>
              <span className="flex items-center gap-2 font-mono text-xs text-muted">
                <span className="live-dot" /> {ACTIVE_CHAIN.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ImportCoin />
              <button className="btn size-10 p-0" onClick={() => void refresh()} aria-label="Refresh" title="Refresh">
                ↻
              </button>
            </div>
          </div>

          {!HAS_FACTORY ? (
            <Notice tone="warn">
              <strong>Running without a factory.</strong> Coins still launch and trade, but this
              list only shows what this browser created or imported. Set{" "}
              <span className="mono">NEXT_PUBLIC_FACTORY_ADDRESS</span> to make every launch
              discoverable.
            </Notice>
          ) : null}
          {error ? <Notice tone="error">{error}</Notice> : null}

          <div className="grid gap-3 xl:grid-cols-3">
            {columns.map((column) => (
              <div key={column.key} className="flex min-w-0 flex-col rounded-3xl border border-line">
                <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-3">
                  <div className="min-w-0">
                    <h2 className="pixel text-[20px] leading-tight">{column.title}</h2>
                    <p className="truncate text-xs text-dim">{column.hint}</p>
                  </div>
                  <span className="mono rounded-lg bg-panel px-2 py-1 text-xs font-semibold text-muted">
                    {loading ? "…" : column.coins.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 px-2.5 pb-2.5 xl:h-[calc(100dvh-236px)] xl:min-h-[420px] xl:overflow-y-auto">
                  {loading && coins.length === 0 ? (
                    Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton h-[112px] shrink-0" />)
                  ) : column.coins.length === 0 ? (
                    <div className="grid flex-1 place-items-center px-4 py-12 text-center text-[13px] text-dim">
                      {column.key === "new" ? (
                        <span>
                          Nothing new yet.{" "}
                          <Link href="/create" className="font-semibold text-fg underline underline-offset-2">
                            Launch one
                          </Link>
                        </span>
                      ) : column.key === "almost" ? (
                        "No curve is past halfway yet."
                      ) : (
                        "No coin has graduated yet."
                      )}
                    </div>
                  ) : (
                    column.coins.map((coin) => <CoinCard key={coin.address} coin={coin} />)
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Sidebar({ coins, loading }: { coins: readonly Coin[]; loading: boolean }) {
  const live = coins.filter((coin) => coin.curveSupply > 0n && !coin.graduated);
  const graduated = coins.filter((coin) => coin.graduated).length;
  const volume = coins.reduce((sum, coin) => sum + coin.volume, 0n);
  const raised = live.reduce((sum, coin) => sum + coin.ethReserve, 0n);
  const blank = loading && coins.length === 0;

  return (
    <aside className="grid gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1 lg:sticky lg:top-[88px]">
      <div className="card">
        <div className="card-title">Coins launched</div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="pixel text-[44px] leading-none">{blank ? "—" : coins.length.toLocaleString("en-US")}</span>
          <span className="font-mono text-xs text-dim">/ {live.length} live</span>
        </div>
        <div className="mt-4">
          <Progress value={coins.length ? graduated / coins.length : 0} label="Share graduated" />
        </div>
        <div className="mt-1.5 text-xs text-dim">{graduated} graduated</div>
      </div>

      <div className="card">
        <div className="card-title">All-time volume</div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="pixel text-[34px] leading-none">{blank ? "—" : formatEth(volume, 3)}</span>
          <span className="font-mono text-xs text-dim">{NATIVE_SYMBOL}</span>
        </div>
        {formatUsd(volume) ? <div className="mt-1.5 text-xs text-dim">≈ {formatUsd(volume)}</div> : null}
      </div>

      <div className="card">
        <div className="card-title">Raised on live curves</div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="pixel text-[34px] leading-none">{blank ? "—" : formatEth(raised, 3)}</span>
          <span className="font-mono text-xs text-dim">{NATIVE_SYMBOL}</span>
        </div>
        <div className="mt-1.5 text-xs text-dim">waiting to graduate</div>
      </div>

      <Link href="/create" className="btn btn-primary btn-lg w-full justify-center">
        Launch a coin <span aria-hidden="true">→</span>
      </Link>

      <div className="card max-lg:col-span-full">
        <div className="card-title mb-3">How it works</div>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {STEPS.map(([title, body], index) => (
            <li key={title} className="flex gap-3">
              <span className="pixel grid size-6 shrink-0 place-items-center rounded-md bg-bg text-[13px] dark:bg-panel-3">
                {index + 1}
              </span>
              <div>
                <div className="text-[13px] font-semibold">{title}</div>
                <p className="text-xs leading-[1.5] text-dim">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
