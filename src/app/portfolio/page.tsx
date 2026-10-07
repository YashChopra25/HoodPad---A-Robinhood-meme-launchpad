"use client";

import Link from "next/link";
import CoinGrid from "@/components/CoinGrid";
import ImportCoin from "@/components/ImportCoin";
import Notice from "@/components/ui/Notice";
import { Stat, StatGrid } from "@/components/ui/Stat";
import { useWalletContext } from "@/components/WalletProvider";
import { useCoins } from "@/hooks/useCoins";
import { useCoinsByCreator } from "@/hooks/useCoins";
import { useWatchlist } from "@/hooks/useWatchlist";
import { HAS_FACTORY, NATIVE_SYMBOL } from "@/lib/env";
import { formatEth, shortenAddress } from "@/lib/format";

const MAIN = "page flex-1 pt-3";
const SECTION_HEAD = "mb-3 flex items-center justify-between gap-3";

export default function PortfolioPage() {
  const wallet = useWalletContext();
  const { coins, loading } = useCoins({ pollMs: 0 });
  const { coins: created, loading: creatingLoading } = useCoinsByCreator(wallet.account);
  const { watched } = useWatchlist();

  const mine = HAS_FACTORY
    ? created
    : coins.filter(
        (coin) =>
          wallet.account && coin.creator.toLowerCase() === wallet.account.toLowerCase(),
      );

  const watchedCoins = coins.filter((coin) =>
    watched.some((entry) => entry.toLowerCase() === coin.address.toLowerCase()),
  );

  if (!wallet.isConnected) {
    return (
      <main className={MAIN}>
        <div className="mb-5">
          <h1 className="stamp">Portfolio</h1>
          <p className="mt-3 text-[13.5px] text-muted">Your launches and watchlist.</p>
        </div>
        <Notice>Connect a wallet to see the coins you have created.</Notice>
      </main>
    );
  }

  return (
    <main className={`${MAIN} flex flex-col gap-8`}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="stamp">Portfolio</h1>
        <span className="mono rounded-xl bg-panel px-3 py-2 text-[13px] text-muted dark:border dark:border-line">
          {shortenAddress(wallet.account)}
        </span>
      </div>

      <StatGrid>
        <Stat
          label="Balance"
          value={`${formatEth(wallet.balance, 4)} ${NATIVE_SYMBOL}`}
          sub={wallet.chainName ?? undefined}
        />
        <Stat label="Coins created" value={mine.length} />
        <Stat label="Watching" value={watchedCoins.length} />
      </StatGrid>

      <section>
        <div className={SECTION_HEAD}>
          <h2 className="pixel text-[22px]">Coins you created</h2>
          <Link href="/create" className="btn btn-sm">
            Create another
          </Link>
        </div>
        <CoinGrid
          coins={mine}
          loading={creatingLoading || loading}
          empty={
            <div className="empty">
              <strong>You have not launched a coin yet.</strong>
              <Link href="/create" className="font-semibold text-fg underline underline-offset-2">
                Launch your first
              </Link>
            </div>
          }
        />
      </section>

      <section>
        <div className={SECTION_HEAD}>
          <h2 className="pixel text-[22px]">Watchlist</h2>
          <ImportCoin />
        </div>
        <CoinGrid
          coins={watchedCoins}
          loading={loading}
          empty={
            <div className="empty">
              <strong>Nothing on the watchlist.</strong>
              Star a coin on its page and it will show up here.
            </div>
          }
        />
      </section>
    </main>
  );
}
