"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { isAddress, type Address } from "viem";
import CoinFacts from "@/components/coin/CoinFacts";
import CoinHeader, { CurveProgress } from "@/components/coin/CoinHeader";
import CreatorTools from "@/components/coin/CreatorTools";
import PriceChart from "@/components/coin/PriceChart";
import TradeFeed from "@/components/coin/TradeFeed";
import TradePanel from "@/components/coin/TradePanel";
import LiquidityPanel from "@/components/liquidity/LiquidityPanel";
import Notice from "@/components/ui/Notice";
import { useWalletContext } from "@/components/WalletProvider";
import { useCoin } from "@/hooks/useCoin";
import { useTrades } from "@/hooks/useTrades";
import { priceChange, toPriceSeries } from "@/lib/trades";
import { NATIVE_SYMBOL, ZERO_ADDRESS } from "@/lib/env";

const MAIN = "page flex flex-1 flex-col pt-3";
const LAYOUT = "grid grid-cols-[minmax(0,1fr)] items-start gap-4 min-[1040px]:grid-cols-[minmax(0,1fr)_380px]";
const CARD_HEAD = "flex items-center justify-between gap-3 px-[18px] pt-4 pb-2";

export default function CoinPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const wallet = useWalletContext();

  const valid = isAddress(address);
  const target = valid ? (address as Address) : null;

  const { coin, balance, loading, error, refresh } = useCoin(target, wallet.account);
  const { trades, loading: tradesLoading, refresh: refreshTrades } = useTrades(target);

  const series = useMemo(() => toPriceSeries(trades, coin), [trades, coin]);
  const change = useMemo(() => priceChange(trades, coin), [trades, coin]);

  if (!valid) {
    return (
      <main className={MAIN}>
        <Notice tone="error">That is not a valid contract address.</Notice>
      </main>
    );
  }

  if (error && !coin) {
    return (
      <main className={`${MAIN} gap-4`}>
        <Notice tone="error">
          Could not load a launch at this address. It may be on a different network, or not a
          launchpad coin at all.
        </Notice>
        <Link href="/coins" className="btn self-start">
          ← Back to the board
        </Link>
      </main>
    );
  }

  if (loading || !coin) {
    return (
      <main className={`${MAIN} gap-4`}>
        <div className="skeleton h-[120px]" />
        <div className="skeleton h-[84px]" />
        <div className={LAYOUT}>
          <div className="skeleton h-[380px]" />
          <div className="skeleton h-[380px]" />
        </div>
      </main>
    );
  }

  function refreshAll() {
    void refresh();
    void refreshTrades();
  }

  const hasCurve = coin.curveSupply > 0n;
  const showLiquidity = !hasCurve || coin.graduated;
  const isOwner =
    wallet.account !== null &&
    coin.owner !== ZERO_ADDRESS &&
    wallet.account.toLowerCase() === coin.owner.toLowerCase();

  return (
    <main className={`${MAIN} gap-[18px]`}>
      <nav className="flex items-center gap-2" aria-label="Breadcrumb">
        <Link href="/coins" className="stamp text-[clamp(22px,2.6vw,30px)] transition-colors hover:bg-panel-2">
          Trade
        </Link>
        <span className="font-mono text-xs text-dim">/ {coin.symbol}</span>
      </nav>

      <CoinHeader coin={coin} balance={balance} change={change} volume={coin.volume} />

      <div className={LAYOUT}>
        <div className="flex flex-col gap-4">
          <div className="card overflow-hidden p-0">
            <div className={CARD_HEAD}>
              <span className="card-title">
                Price <span className="ml-1 font-mono text-xs text-dim">{NATIVE_SYMBOL} per token</span>
              </span>
              <span className="rounded-lg bg-bg px-2 py-1 font-mono text-xs text-muted dark:bg-panel-2">{trades.length} trades</span>
            </div>
            <div className="px-[18px] pt-3 pb-2.5">
              <PriceChart points={series} loading={tradesLoading} />
            </div>
          </div>

          <div className="card overflow-hidden p-0">
            <div className={CARD_HEAD}>
              <span className="pixel text-[20px]">Activity</span>
              <span className="flex items-center gap-[7px] font-mono text-xs text-dim">
                <span className="live-dot" /> live
              </span>
            </div>
            <TradeFeed trades={trades} symbol={coin.symbol} loading={tradesLoading} />
          </div>

          {showLiquidity ? (
            <div className="card">
              <div className="pixel mb-3.5 text-[20px]">Liquidity</div>
              <LiquidityPanel coin={coin} onDone={refreshAll} />
            </div>
          ) : null}
        </div>

        {/* Pinned while scrolling, except when creator tools make it taller than the screen. */}
        <aside
          className={`flex flex-col gap-4 ${isOwner ? "" : "min-[1040px]:sticky min-[1040px]:top-[88px]"}`.trim()}
        >
          <TradePanel coin={coin} balance={balance} onDone={refreshAll} />
          {hasCurve && !coin.graduated ? <CurveProgress coin={coin} /> : null}
          <CoinFacts coin={coin} />
          {isOwner ? <CreatorTools coin={coin} onDone={refreshAll} /> : null}
        </aside>
      </div>
    </main>
  );
}
