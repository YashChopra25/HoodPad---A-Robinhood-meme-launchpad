"use client";

import { useMemo, useState } from "react";
import { formatEth } from "@/lib/format";
import { NATIVE_SYMBOL } from "@/lib/env";
import type { PricePoint } from "@/lib/types";

const WIDTH = 720;
const HEIGHT = 288;
const PADDING = { top: 18, right: 8, bottom: 24, left: 8 };

/**
 * The curve's price history, drawn as inline SVG.
 *
 * No charting library: the series is a few hundred points read from the
 * contract's own logs, and a hand-rolled path keeps the page dependency-free
 * and instant. Uses a viewBox so it scales to any width.
 */
export default function PriceChart({
  points,
  loading,
}: {
  points: readonly PricePoint[];
  loading?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const chart = useMemo(() => build(points), [points]);

  if (!chart) {
    return (
      <div className="relative h-[320px] w-full">
        <div className="absolute inset-0 grid place-items-center font-mono text-[13px] text-dim">
          {loading ? <span className="spinner" /> : "No trades yet — be the first."}
        </div>
      </div>
    );
  }

  const { path, area, coords, min, max, first, last } = chart;
  const rising = last >= first;
  // Tailwind exposes theme colours as CSS variables, which SVG attributes can read.
  const stroke = rising ? "var(--color-up)" : "var(--color-sell)";
  const active = hover === null ? coords.length - 1 : hover;
  const point = coords[active];

  return (
    <div className="relative h-[320px] w-full">
      <svg
        className="block size-full overflow-visible"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Price history: ${formatEth(BigInt(Math.round(first)))} to ${formatEth(
          BigInt(Math.round(last)),
        )} ${NATIVE_SYMBOL} per token`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - box.left) / box.width;
          const index = Math.round(ratio * (coords.length - 1));
          setHover(Math.max(0, Math.min(coords.length - 1, index)));
        }}
      >
        <defs>
          <linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.24" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal guides at the range edges and midpoint. */}
        {[0, 0.5, 1].map((fraction) => {
          const y = PADDING.top + fraction * (HEIGHT - PADDING.top - PADDING.bottom);
          return (
            <line
              key={fraction}
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.055)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        <path d={area} fill="url(#price-fill)" />
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {point ? (
          <>
            <line
              x1={point.x}
              x2={point.x}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              stroke="rgba(255,255,255,0.16)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={point.x} cy={point.y} r={4} fill={stroke} vectorEffect="non-scaling-stroke" />
          </>
        ) : null}
      </svg>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between text-xs text-dim">
        <span className="mono">
          {point ? formatEth(toWei(point.price), 4) : formatEth(toWei(max), 4)} {NATIVE_SYMBOL}
        </span>
        <span className="mono">{point ? whenLabel(point.t) : `low ${formatEth(toWei(min), 4)}`}</span>
      </div>
    </div>
  );
}

interface Coord {
  x: number;
  y: number;
  price: number;
  t: number;
}

function build(points: readonly PricePoint[]) {
  const usable = points.filter((point) => Number.isFinite(point.price) && point.price > 0);
  if (usable.length < 2) return null;

  const prices = usable.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  // A flat series would divide by zero; give it a nominal band instead.
  const span = max - min || max * 0.1 || 1;

  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const coords: Coord[] = usable.map((point, index) => ({
    x: PADDING.left + (index / (usable.length - 1)) * innerWidth,
    y: PADDING.top + (1 - (point.price - min + span * 0.06) / (span * 1.12)) * innerHeight,
    price: point.price,
    t: point.t,
  }));

  const path = coords
    .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x.toFixed(2)} ${coord.y.toFixed(2)}`)
    .join(" ");

  const area = `${path} L${coords[coords.length - 1].x.toFixed(2)} ${HEIGHT - PADDING.bottom} L${coords[0].x.toFixed(
    2,
  )} ${HEIGHT - PADDING.bottom} Z`;

  return { path, area, coords, min, max, first: prices[0], last: prices[prices.length - 1] };
}

/** The series carries ETH-per-token as a float; render it through formatEth. */
function toWei(price: number): bigint {
  return BigInt(Math.max(0, Math.round(price * 1e18)));
}

function whenLabel(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
