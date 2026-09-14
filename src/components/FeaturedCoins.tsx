"use client";

import Link from "next/link";
import CoinGrid from "@/components/CoinGrid";
import MetricStrip from "@/components/MetricStrip";
import { sortCoins, useCoins } from "@/hooks/useCoins";
import { ACTIVE_CHAIN } from "@/lib/chains";

/** Live market numbers and the six busiest coins, for the landing page. */
export default function FeaturedCoins() {
  const { coins, loading } = useCoins({ limit: 24 });
  const top = sortCoins(coins, "trending").slice(0, 6);

  return (
    <>
      {coins.length > 0 ? <MetricStrip coins={coins} /> : null}

      <section className="mt-11">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">
              <span className="live-dot" /> Live
            </span>
            <h2 className="mt-2.5 text-[clamp(20px,2.6vw,26px)] tracking-[-0.04em]">
              Trending on {ACTIVE_CHAIN.name}
            </h2>
          </div>
          <Link href="/coins" className="btn">
            Open the board →
          </Link>
        </div>
        <CoinGrid
          coins={top}
          loading={loading}
          empty={
            <div className="empty">
              <strong>No coins yet.</strong>
              Be the first —{" "}
              <Link href="/create" className="text-accent">
                launch one
              </Link>
              .
            </div>
          }
        />
      </section>
    </>
  );
}
