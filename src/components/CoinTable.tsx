"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import CoinAvatar from "@/components/CoinAvatar";
import Progress from "@/components/ui/Progress";
import { progress } from "@/lib/curve";
import { NATIVE_SYMBOL } from "@/lib/env";
import { formatEth, formatUsd, timeAgo } from "@/lib/format";
import type { Coin } from "@/lib/types";

/** The board as a dense, scannable market table. Rows open the coin page. */
export default function CoinTable({ coins }: { coins: readonly Coin[] }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <table className="data-table">
        <thead>
          <tr>
            <th>Coin</th>
            <th>Market cap</th>
            <th>Price ({NATIVE_SYMBOL})</th>
            <th>Volume ({NATIVE_SYMBOL})</th>
            <th>Curve</th>
            <th>Age</th>
          </tr>
        </thead>
        <tbody>
          {coins.map((coin, index) => {
            const live = coin.curveSupply > 0n && !coin.graduated;
            const filled = progress(coin);
            return (
              <tr key={coin.address} onClick={() => router.push(`/coin/${coin.address}`)}>
                <td>
                  <div className="flex items-center gap-2.5 font-sans">
                    <span className="mono inline-block w-[34px] text-dim">{index + 1}</span>
                    <CoinAvatar
                      address={coin.address}
                      symbol={coin.symbol}
                      image={coin.meta.image}
                      size={28}
                    />
                    <Link
                      href={`/coin/${coin.address}`}
                      onClick={(event) => event.stopPropagation()}
                      className="font-semibold"
                    >
                      {coin.name}
                    </Link>
                    <span className="font-mono text-xs font-semibold text-accent">${coin.symbol}</span>
                  </div>
                </td>
                <td>{formatUsd(coin.marketCapWei) ?? formatEth(coin.marketCapWei, 3)}</td>
                <td>{formatEth(coin.price)}</td>
                <td>{formatEth(coin.volume, 3)}</td>
                <td>
                  {coin.graduated ? (
                    <span className="chip chip-up">Graduated</span>
                  ) : live ? (
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20">
                        <Progress value={filled} label={`${coin.symbol} curve progress`} />
                      </div>
                      <span className="min-w-9 text-accent">{Math.round(filled * 100)}%</span>
                    </div>
                  ) : (
                    <span className="chip">Fixed</span>
                  )}
                </td>
                <td className="text-dim">{coin.launchedAt ? timeAgo(coin.launchedAt) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
