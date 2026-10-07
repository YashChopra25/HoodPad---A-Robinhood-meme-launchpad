"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { shortAge } from "@/components/CoinCard";
import CoinAvatar from "@/components/CoinAvatar";
import Progress from "@/components/ui/Progress";
import { progress } from "@/lib/curve";
import { NATIVE_SYMBOL } from "@/lib/env";
import { formatEth, formatPercent, formatUsd, shortenAddress } from "@/lib/format";
import type { Coin } from "@/lib/types";

/** The board as a dense, scannable market table. Rows open the coin page. */
export default function CoinTable({ coins }: { coins: readonly Coin[] }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="data-table">
        <thead>
          <tr>
            <th>Token</th>
            <th>Age</th>
            <th>Market cap</th>
            <th>Price ({NATIVE_SYMBOL})</th>
            <th>Volume</th>
            <th>Curve</th>
            <th>Guards</th>
          </tr>
        </thead>
        <tbody>
          {coins.map((coin, index) => {
            const live = coin.curveSupply > 0n && !coin.graduated;
            const filled = progress(coin);
            return (
              <tr key={coin.address} onClick={() => router.push(`/coin/${coin.address}`)}>
                <td>
                  <div className="flex items-center gap-3 font-sans">
                    <span className="mono inline-block w-6 text-xs text-dim">{index + 1}</span>
                    <CoinAvatar address={coin.address} symbol={coin.symbol} image={coin.meta.image} size={36} />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <Link
                          href={`/coin/${coin.address}`}
                          onClick={(event) => event.stopPropagation()}
                          className="font-bold"
                        >
                          {coin.symbol}
                        </Link>
                        <span className="max-w-[180px] truncate text-[12.5px] text-muted">{coin.name}</span>
                      </div>
                      <div className="font-mono text-[11px] text-dim">{shortenAddress(coin.address)}</div>
                    </div>
                  </div>
                </td>
                <td className="font-semibold text-up">{coin.launchedAt ? shortAge(coin.launchedAt) : "—"}</td>
                <td className="font-semibold">
                  {formatUsd(coin.marketCapWei) ?? `${formatEth(coin.marketCapWei, 3)} ${NATIVE_SYMBOL}`}
                </td>
                <td>{formatEth(coin.price)}</td>
                <td>{formatUsd(coin.volume) ?? `${formatEth(coin.volume, 3)} ${NATIVE_SYMBOL}`}</td>
                <td>
                  {coin.graduated ? (
                    <span className="chip chip-up">Graduated</span>
                  ) : live ? (
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20">
                        <Progress value={filled} label={`${coin.symbol} curve progress`} />
                      </div>
                      <span className="min-w-9">{Math.round(filled * 100)}%</span>
                    </div>
                  ) : (
                    <span className="chip">Fixed</span>
                  )}
                </td>
                <td>
                  <div className="flex justify-end gap-1 font-sans">
                    {coin.antiBot ? <span className="chip">Bot</span> : null}
                    {coin.maxWallet > 0n ? <span className="chip">Whale</span> : null}
                    {coin.taxBps > 0n ? <span className="chip chip-warn">{formatPercent(coin.taxBps)}</span> : null}
                    {!coin.antiBot && coin.maxWallet === 0n && coin.taxBps === 0n ? (
                      <span className="text-dim">—</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
