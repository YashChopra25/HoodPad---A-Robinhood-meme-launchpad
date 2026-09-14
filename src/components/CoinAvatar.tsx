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
  const [broken, setBroken] = useState(false);
  const src = broken ? null : safeImageSrc(image);
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
        // Data URIs and arbitrary remote hosts are both possible here, so this
        // stays a plain <img> rather than next/image with a host allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setBroken(true)} loading="lazy" />
      ) : (
        symbol.slice(0, 3).toUpperCase()
      )}
    </div>
  );
}
