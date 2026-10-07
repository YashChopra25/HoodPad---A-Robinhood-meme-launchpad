import Link from "next/link";
import CaChip from "@/components/CaChip";
import CoinAvatar from "@/components/CoinAvatar";
import Progress from "@/components/ui/Progress";
import { progress } from "@/lib/curve";
import { NATIVE_SYMBOL } from "@/lib/env";
import {
  formatEth,
  formatPercent,
  formatUsd,
  safeLink,
  telegramUrl,
  timeAgo,
  twitterUrl,
} from "@/lib/format";
import type { Coin } from "@/lib/types";

// 24px stroke glyphs for the social row.
const GLYPHS = {
  web: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z",
  x: "M4 4l16 16M20 4 4 20",
  tg: "M21 4 3 11l6 2 2 6 3-4 5 4 2-15ZM9 13l9-6",
} as const;

function Social({ href, glyph, label }: { href: string; glyph: keyof typeof GLYPHS; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="relative z-[2] grid size-5 place-items-center rounded-md text-dim transition-colors hover:bg-panel-3 hover:text-fg"
    >
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={GLYPHS[glyph]} />
      </svg>
    </a>
  );
}

/** "3m ago" → "3m": the terminal reads ages as bare units. */
export function shortAge(timestamp?: number): string {
  return timeAgo(timestamp).replace(" ago", "").replace("just now", "now");
}

/**
 * One coin as a dense terminal row: picture and contract on the left, name,
 * age and guards in the middle, market cap, volume and curve on the right.
 */
export default function CoinCard({ coin }: { coin: Coin }) {
  const hasCurve = coin.curveSupply > 0n;
  const live = hasCurve && !coin.graduated;
  const filled = progress(coin);
  const mcap = formatUsd(coin.marketCapWei) ?? `${formatEth(coin.marketCapWei, 3)} ${NATIVE_SYMBOL}`;
  const volume = formatUsd(coin.volume) ?? `${formatEth(coin.volume, 3)} ${NATIVE_SYMBOL}`;

  const website = safeLink(coin.meta.website);
  const twitter = twitterUrl(coin.meta.twitter);
  const telegram = telegramUrl(coin.meta.telegram);

  return (
    <article className="group relative flex gap-3 rounded-2xl bg-panel p-3 transition-colors hover:bg-panel-2 dark:border dark:border-line dark:hover:border-line-strong">
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <div className="relative">
          <CoinAvatar address={coin.address} symbol={coin.symbol} image={coin.meta.image} size={60} />
          {coin.graduated ? (
            <span className="absolute -right-1 -bottom-1 grid size-[18px] place-items-center rounded-full border-2 border-panel bg-up text-[9px] font-bold text-up-ink" title="Graduated">
              ✓
            </span>
          ) : null}
        </div>
        <CaChip address={coin.address} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-baseline gap-1.5">
          {/* The whole card is clickable through this link's overlay, which keeps
              the copy chip and socials real controls instead of nested links. */}
          <Link
            href={`/coin/${coin.address}`}
            className="truncate text-[15px] font-bold tracking-[-0.01em] after:absolute after:inset-0 after:z-[1] after:content-['']"
          >
            {coin.symbol}
          </Link>
          <span className="truncate text-[13px] text-muted">{coin.name}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {coin.launchedAt ? (
            <span className="mono text-[12.5px] font-semibold text-up" title="Age">
              {shortAge(coin.launchedAt)}
            </span>
          ) : null}
          {website ? <Social href={website} glyph="web" label="Website" /> : null}
          {twitter ? <Social href={twitter} glyph="x" label="X" /> : null}
          {telegram ? <Social href={telegram} glyph="tg" label="Telegram" /> : null}
        </div>

        <div className="mt-auto flex flex-wrap gap-1">
          {live ? <span className="chip chip-accent">Curve</span> : null}
          {coin.graduated ? <span className="chip chip-up">Graduated</span> : null}
          {!hasCurve ? <span className="chip">Fixed</span> : null}
          {coin.antiBot ? <span className="chip">Anti-bot</span> : null}
          {coin.maxWallet > 0n ? <span className="chip">Anti-whale</span> : null}
          {coin.taxBps > 0n ? <span className="chip chip-warn">Tax {formatPercent(coin.taxBps)}</span> : null}
        </div>
      </div>

      <div className="flex w-[104px] shrink-0 flex-col items-end gap-0.5 text-right">
        <div className="flex items-baseline gap-1">
          <span className="text-[11px] text-dim">MC</span>
          <span className="mono text-[14.5px] font-bold">{mcap}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[11px] text-dim">V</span>
          <span className="mono text-[12.5px] font-semibold">{volume}</span>
        </div>
        <div className="mt-auto w-full">
          {live ? (
            <>
              <div className="mb-1 flex justify-between font-mono text-[10.5px] text-dim">
                <span>curve</span>
                <span className="text-fg">{Math.round(filled * 100)}%</span>
              </div>
              <Progress value={filled} label={`${coin.symbol} curve progress`} />
            </>
          ) : (
            <span className="font-mono text-[10.5px] text-dim">{coin.graduated ? "pool live" : "no curve"}</span>
          )}
        </div>
      </div>
    </article>
  );
}
