"use client";

import { useEffect, useState } from "react";
import { shortenAddress } from "@/lib/format";

/** Compact "CA" copy chip. Stops the click so it can sit on top of a card link. */
export default function CaChip({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      // Raised above a card's stretched link overlay so it stays clickable.
      className="relative z-[2] inline-flex cursor-pointer items-center gap-[5px] rounded-md border border-line-strong bg-transparent px-[7px] py-0.5 font-mono text-[11px] text-muted transition-colors hover:border-line-hover hover:text-fg"
      title={address}
      aria-label="Copy contract address"
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(address);
          setCopied(true);
        } catch {
          // Clipboard access can be denied; the address is in the title regardless.
        }
      }}
    >
      {copied ? "Copied ✓" : `CA ${shortenAddress(address, 3)}`}
    </button>
  );
}
