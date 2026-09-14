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

const MAIN = "page flex-1 pt-7 pb-20 max-sm:pt-5";
const TITLE = "mt-3 text-[clamp(22px,3vw,30px)] tracking-[-0.04em]";
const SECTION_HEAD = "mb-3.5 flex items-center justify-between gap-3";

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
        <div className="mb-[18px]">
          <span className="eyebrow">Portfolio</span>
          <h2 className={TITLE}>Your launches and watchlist</h2>
        </div>
        <Notice>Connect a wallet to see the coins you have created.</Notice>
      </main>
    );
  }

  return (
    <main className={`${MAIN} flex flex-col gap-[26px]`}>
      <div>
        <span className="eyebrow">Portfolio</span>
        <h2 className={TITLE}>
          <span className="mono">{shortenAddress(wallet.account)}</span>
        </h2>
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
          <h3>Coins you created</h3>
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
              <Link href="/create" className="text-accent">
                Launch your first
              </Link>
            </div>
          }
        />
      </section>

      <section>
        <div className={SECTION_HEAD}>
          <h3>Watchlist</h3>
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
