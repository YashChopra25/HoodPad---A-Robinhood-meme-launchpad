import Link from "next/link";
import CaChip from "@/components/CaChip";
import CoinAvatar from "@/components/CoinAvatar";
import Progress from "@/components/ui/Progress";
import { progress } from "@/lib/curve";
import { formatEth, formatUsd, timeAgo } from "@/lib/format";
import { NATIVE_SYMBOL } from "@/lib/env";
import type { Coin } from "@/lib/types";

const STATS = "flex items-center justify-between gap-2.5 text-xs";

/**
 * One coin on the board. Leads with market cap in large type, then how close
 * the curve is to graduating — the two numbers that decide a tap-through.
 */
export default function CoinCard({ coin }: { coin: Coin }) {
  const hasCurve = coin.curveSupply > 0n;
  const live = hasCurve && !coin.graduated;
  const filled = progress(coin);
  const usd = formatUsd(coin.marketCapWei);

  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-line bg-[linear-gradient(180deg,var(--color-panel-2),var(--color-panel)_60%)] p-4 transition duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_14px_34px_rgb(0_0_0/0.45)]">
      {/* Decorative orbit behind the card, borrowed from market dashboards. */}
      <span
        className="pointer-events-none absolute -right-[46px] -bottom-[46px] size-[150px] rounded-full border border-line after:absolute after:inset-[18px] after:rounded-full after:border after:border-dashed after:border-line after:content-['']"
        aria-hidden="true"
      />

      <div className="flex items-center gap-[11px]">
        <CoinAvatar address={coin.address} symbol={coin.symbol} image={coin.meta.image} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs font-semibold text-accent">${coin.symbol}</div>
          {/* The whole card is clickable through this link's overlay, which keeps
              the copy chip a real button instead of a button nested in a link. */}
          <Link
            href={`/coin/${coin.address}`}
            className="block truncate text-[14.5px] font-semibold text-muted after:absolute after:inset-0 after:z-[1] after:content-['']"
          >
            {coin.name}
          </Link>
        </div>
        <CaChip address={coin.address} />
      </div>

      <div>
        <div className="mono text-[26px] leading-[1.05] font-semibold tracking-[-0.04em]">
          {usd ?? (
            <>
              {formatEth(coin.marketCapWei, 3)}
              <small className="ml-[5px] text-[13px] tracking-normal text-dim">{NATIVE_SYMBOL}</small>
            </>
          )}
        </div>
        <div className="mt-1 text-xs text-dim">
          Market cap{coin.launchedAt ? ` · ${timeAgo(coin.launchedAt)}` : ""}
        </div>
      </div>

      <p className="line-clamp-2 min-h-[2.9em] text-[12.5px] leading-[1.45] text-dim">
        {coin.meta.description?.trim() || <span>No description yet.</span>}
      </p>

      <div className="border-t border-line pt-3">
        {live ? (
          <>
            <div className={`${STATS} mb-[7px]`}>
              <span className="text-dim">Bonding curve</span>
              <span className="mono text-accent">{Math.round(filled * 100)}%</span>
            </div>
            <Progress value={filled} label={`${coin.symbol} curve progress`} />
            <div className={`${STATS} mt-[7px]`}>
              <span className="mono text-dim">
                Vol {formatEth(coin.volume, 3)} {NATIVE_SYMBOL}
              </span>
              <span className="mono text-dim">
                {formatEth(coin.ethReserve, 3)} / {formatEth(coin.graduationTarget, 3)}
              </span>
            </div>
          </>
        ) : (
          <div className={STATS}>
            {coin.graduated ? (
              <span className="chip chip-up">Graduated · pool live</span>
            ) : (
              <span className="chip">Fixed supply</span>
            )}
            <span className="mono text-dim">
              Vol {formatEth(coin.volume, 3)} {NATIVE_SYMBOL}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
