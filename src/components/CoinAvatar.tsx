"use client";

import { useState } from "react";
import { addressHue } from "@/lib/format";
import { safeImageSrc } from "@/lib/image";

/**
 * A coin's picture, or a generated mark when it has none. The fallback colour
 * is derived from the address, so a coin looks the same everywhere in the app.
 */
export default function CoinAvatar({
  address,
  symbol,
  image,
  size = 42,
}: {
  address: string;
  symbol: string;
  image?: string | null;
  size?: number;
}) {
  // Each load failure moves on to the next IPFS gateway; for anything else the
  // first failure leaves no candidates and the fallback mark shows.
  const [attempt, setAttempt] = useState(0);
  const src = safeImageSrc(image, attempt);
  // Tracked per src, so a gateway retry or a new image shows the spinner again.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loading = src !== null && loadedSrc !== src;
  const hue = addressHue(address);

  return (
    <div
      className="avatar"
      // Size and fallback colour come from props and the address at runtime.
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, size * 0.36),
        borderRadius: Math.max(8, size * 0.28),
        background: src
          ? undefined
          : `linear-gradient(145deg, hsl(${hue} 74% 58%), hsl(${(hue + 42) % 360} 70% 42%))`,
      }}
      aria-hidden="true"
    >
      {src ? (
        <>
          {/* Data URIs and arbitrary remote hosts are both possible here, so this
              stays a plain <img> rather than next/image with a host allowlist. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            loading="lazy"
            // An image can finish before hydration attaches onLoad, so a
            // cached one is caught here instead of spinning forever.
            ref={(img) => {
              if (img?.complete && img.naturalWidth > 0) setLoadedSrc(src);
            }}
            onLoad={() => setLoadedSrc(src)}
            onError={() => setAttempt((n) => n + 1)}
            className={`[grid-area:1/1] transition-opacity duration-200 ${loading ? "opacity-0" : ""}`}
          />
          {loading ? <span className="spinner [grid-area:1/1] text-dim" /> : null}
        </>
      ) : (
        symbol.slice(0, 3).toUpperCase()
      )}
    </div>
  );
}
