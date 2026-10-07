"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CoinGrid from "@/components/CoinGrid";
import CoinTable from "@/components/CoinTable";
import ImportCoin from "@/components/ImportCoin";
import Notice from "@/components/ui/Notice";
import { filterCoins, sortCoins, useCoins, type SortKey } from "@/hooks/useCoins";
import { useWatchlist } from "@/hooks/useWatchlist";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { HAS_FACTORY } from "@/lib/env";
import type { Coin } from "@/lib/types";

type Stage = "all" | "live" | "graduated" | "fixed" | "watchlist";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "trending", label: "Trending" },
  { key: "mcap", label: "Market cap" },
  { key: "new", label: "Newest" },
];

const STAGES: Array<{ key: Stage; label: string; match: (coin: Coin) => boolean }> = [
  { key: "all", label: "All", match: () => true },
  { key: "live", label: "On curve", match: (coin) => coin.curveSupply > 0n && !coin.graduated },
  { key: "graduated", label: "Graduated", match: (coin) => coin.graduated },
  { key: "fixed", label: "Fixed supply", match: (coin) => coin.curveSupply === 0n },
];

const MAIN = "page flex-1 pt-3";

// The search box reads `?q=` from the URL, which needs a Suspense boundary so
// the rest of the route can still prerender.
export default function CoinsPage() {
  return (
    <Suspense
      fallback={
        <main className={MAIN}>
          <div className="skeleton h-[420px]" />
        </main>
      }
    >
      <Board />
    </Suspense>
  );
}

function Board() {
  const params = useSearchParams();
  const { coins, loading, error, refresh } = useCoins();
  const { watched } = useWatchlist();
  const [sort, setSort] = useState<SortKey>("trending");
  const [stage, setStage] = useState<Stage>("all");
  const [view, setView] = useState<"grid" | "table">("table");

  // A new search from the nav replaces whatever was typed here.
  const urlQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);
  if (urlQuery !== seenUrlQuery) {
    setSeenUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  const isWatched = (coin: Coin) =>
    watched.some((entry) => entry.toLowerCase() === coin.address.toLowerCase());

  const visible = useMemo(() => {
    const pool =
      stage === "watchlist"
        ? coins.filter(isWatched)
        : coins.filter(STAGES.find((entry) => entry.key === stage)!.match);
    return filterCoins(sortCoins(pool, sort), query);
    // isWatched is derived from `watched`, which is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coins, stage, sort, query, watched]);

  const counts: Record<Stage, number> = {
    all: coins.length,
    live: coins.filter(STAGES[1].match).length,
    graduated: coins.filter(STAGES[2].match).length,
    fixed: coins.filter(STAGES[3].match).length,
    watchlist: coins.filter(isWatched).length,
  };

  return (
    <main className={`${MAIN} flex flex-col gap-5`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="stamp">Board</h1>
          <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
            <span className="live-dot" />
            {HAS_FACTORY
              ? `Every launch on ${ACTIVE_CHAIN.name}, read from the registry and refreshed every 20s.`
              : "No factory is configured, so this lists coins created or imported in this browser."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportCoin />
          <button className="btn size-10 p-0" onClick={() => void refresh()} aria-label="Refresh" title="Refresh">
            ↻
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className="pill"
                aria-pressed={stage === entry.key}
                onClick={() => setStage(entry.key)}
              >
                {entry.label} <span className="font-mono text-[11px] opacity-50">{counts[entry.key]}</span>
              </button>
            ))}
            <button
              type="button"
              className="pill"
              aria-pressed={stage === "watchlist"}
              onClick={() => setStage("watchlist")}
            >
              ★ Watchlist <span className="font-mono text-[11px] opacity-50">{counts.watchlist}</span>
            </button>
          </div>

          <div className="flex-1" />

          <input
            className="input max-w-[260px] border-transparent bg-panel dark:border-line dark:bg-panel"
            placeholder="Search name, ticker or contract"
            aria-label="Search coins"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="segmented" aria-label="Sort">
            {SORTS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                aria-pressed={sort === entry.key}
                onClick={() => setSort(entry.key)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="segmented" aria-label="View">
            <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")}>
              Cards
            </button>
            <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
              Table
            </button>
          </div>
        </div>

        {error ? <Notice tone="error">{error}</Notice> : null}

        {view === "table" && visible.length > 0 ? (
          <CoinTable coins={visible} />
        ) : (
          <CoinGrid
            coins={visible}
            loading={loading}
            empty={
              <div className="empty">
                <strong>
                  {query
                    ? "Nothing matches that search."
                    : stage === "watchlist"
                      ? "Your watchlist is empty."
                      : stage === "graduated"
                        ? "No coin has graduated yet."
                        : "No coins here yet."}
                </strong>
                {stage === "watchlist" ? (
                  "Star a coin on its page to keep an eye on it."
                ) : (
                  <>
                    Be the first —{" "}
                    <Link href="/create" className="font-semibold text-fg underline underline-offset-2">
                      launch one
                    </Link>
                    .
                  </>
                )}
              </div>
            }
          />
        )}
      </div>
    </main>
  );
}
