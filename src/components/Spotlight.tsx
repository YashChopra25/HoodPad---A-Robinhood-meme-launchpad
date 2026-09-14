import Link from "next/link";
import CoinAvatar from "@/components/CoinAvatar";
import Progress from "@/components/ui/Progress";
import { progress } from "@/lib/curve";
import { NATIVE_SYMBOL } from "@/lib/env";
import { formatEth, formatUsd } from "@/lib/format";
import type { Coin } from "@/lib/types";

/**
 * The live curve nearest to graduating, pinned above the board. Returns
 * nothing when no curve is live.
 */
export default function Spotlight({ coins }: { coins: readonly Coin[] }) {
  const live = coins.filter((coin) => coin.curveSupply > 0n && !coin.graduated);
  if (live.length === 0) return null;

  const coin = live.reduce((best, next) => {
    const delta = progress(next) - progress(best);
    return delta > 0 || (delta === 0 && next.volume > best.volume) ? next : best;
  });
  const filled = progress(coin);
  const href = `/coin/${coin.address}`;

  return (
    <section className="relative grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-6 overflow-hidden rounded-[18px] border border-line bg-[radial-gradient(420px_220px_at_90%_10%,rgb(200_240_49/0.08),transparent_70%),linear-gradient(180deg,var(--color-panel-2),var(--color-panel))] p-[26px] max-lg:grid-cols-1 max-sm:p-[18px]">
      <CurveGraphic coin={coin} filled={filled} />

      <div className="relative">
        <span className="inline-flex items-center gap-[7px] font-mono text-[11px] tracking-[0.14em] text-accent uppercase">
          <span className="live-dot" /> Closest to graduation
        </span>
        <h2 className="mt-3.5 text-[clamp(26px,3.6vw,42px)] tracking-[-0.05em]">{coin.name}</h2>
        <p className="mt-2 max-w-[440px] text-muted">
          {coin.meta.description?.trim() ||
            `${Math.round(filled * 100)}% of the way to a Uniswap V2 pool with burned liquidity.`}
        </p>
        <div className="mt-[22px] flex flex-wrap items-center gap-2.5">
          <Link href={href} className="btn btn-primary">
            Trade ${coin.symbol} →
          </Link>
          <Link href="/create" className="btn">
            Launch your own
          </Link>
        </div>
      </div>

      <Link
        href={href}
        className="relative w-full max-w-[340px] self-end justify-self-end rounded-xl border border-line-strong bg-[rgb(15_17_19/0.88)] p-4 backdrop-blur-sm max-lg:max-w-none max-lg:justify-self-stretch"
      >
        <div className="flex items-center gap-2.5">
          <CoinAvatar address={coin.address} symbol={coin.symbol} image={coin.meta.image} size={34} />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-xs font-semibold text-accent">${coin.symbol}</div>
            <div className="text-xs text-dim">Market cap</div>
          </div>
          <span className="chip chip-accent">{Math.round(filled * 100)}%</span>
        </div>
        <div className="mono mt-3 text-[26px] leading-[1.05] font-semibold tracking-[-0.04em]">
          {formatUsd(coin.marketCapWei) ?? (
            <>
              {formatEth(coin.marketCapWei, 3)}
              <small className="ml-[5px] text-[13px] tracking-normal text-dim">{NATIVE_SYMBOL}</small>
            </>
          )}
        </div>
        <div className="mt-3.5">
          <Progress value={filled} label={`${coin.symbol} curve progress`} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2.5 text-xs">
          <span className="text-dim">Raised</span>
          <span className="mono">
            {formatEth(coin.ethReserve, 3)} / {formatEth(coin.graduationTarget, 3)} {NATIVE_SYMBOL}
          </span>
        </div>
      </Link>
    </section>
  );
}

/**
 * The coin's actual price curve. On a constant-product curve with a virtual
 * reserve V, price after raising e is proportional to (V + e)², so the shape is
 * drawn from the coin's own parameters and the marker sits where it trades now.
 */
function CurveGraphic({ coin, filled }: { coin: Coin; filled: number }) {
  const ratio = coin.virtualEth === 0n ? 1 : Number(coin.graduationTarget) / Number(coin.virtualEth);
  const top = (1 + ratio) ** 2;
  const height = (x: number) => ((1 + ratio * x) ** 2 - 1) / (top - 1 || 1);

  const points = Array.from({ length: 41 }, (_, index) => {
    const x = index / 40;
    return `${(x * 100).toFixed(2)},${(100 - height(x) * 92).toFixed(2)}`;
  });
  const done = points.slice(0, Math.max(1, Math.round(filled * 40)) + 1);

  return (
    <div
      className="pointer-events-none absolute inset-[auto_0_0_38%] h-[70%] opacity-90 max-lg:inset-[auto_0_0_0] max-lg:h-[45%] max-lg:opacity-50"
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={done.join(" ")}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute -mt-1.5 -ml-1.5 size-3 rounded-full bg-accent shadow-[0_0_0_5px_rgb(200_240_49/0.18),0_0_18px_rgb(200_240_49/0.6)]"
        // Where the coin trades now on the curve, computed from its reserves.
        style={{ left: `${filled * 100}%`, top: `${100 - height(filled) * 92}%` }}
      />
    </div>
  );
}
