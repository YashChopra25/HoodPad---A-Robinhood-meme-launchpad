"use client";

import { useState } from "react";
import { useBlockNumber } from "@/hooks/useBlockNumber";
import { ACTIVE_CHAIN } from "@/lib/chains";

const LENGTH = 6;

/**
 * The chain growing in real time: the last few polled block heights as linked
 * tiles, newest on the right. Every number is read from the RPC.
 */
export default function BlockStream() {
  const block = useBlockNumber(2500);
  const [blocks, setBlocks] = useState<bigint[]>([]);

  // Adjusting state while rendering: append each new height exactly once.
  if (block !== null && blocks.at(-1) !== block) {
    setBlocks([...blocks, block].slice(-LENGTH));
  }

  const slots: Array<bigint | null> = [
    ...Array.from({ length: LENGTH - blocks.length }, () => null),
    ...blocks,
  ];

  return (
    <div className="mx-auto flex max-w-[980px] items-center justify-center" aria-label={`Latest blocks on ${ACTIVE_CHAIN.name}`}>
      {slots.map((height, index) => {
        const newest = index === LENGTH - 1;
        // Phones keep the three newest blocks.
        const hideOnPhone = index < LENGTH - 3 ? "max-sm:hidden" : "";
        return (
          <div key={height === null ? `empty-${index}` : height.toString()} className={`flex min-w-0 items-center ${index === 0 ? "flex-none" : "flex-1"} ${hideOnPhone}`}>
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={`h-px w-full min-w-3 flex-1 ${newest ? "bg-accent shadow-[0_0_8px_var(--color-accent)]" : "bg-line-strong"}`}
              />
            ) : null}
            <div
              className={`shrink-0 rounded-lg border px-3 py-2 font-mono backdrop-blur-sm ${
                height === null
                  ? "border-dashed border-line-strong bg-panel/40 text-dim"
                  : newest
                    ? "animate-block-in border-accent bg-accent/10 text-accent shadow-[0_0_24px_-4px_var(--color-accent)]"
                    : "animate-block-in border-line-strong bg-panel/80 text-muted"
              }`}
            >
              <span className="block text-[9px] tracking-[0.18em] uppercase opacity-70">
                {newest && height !== null ? "latest" : "block"}
              </span>
              <span className="block text-[12.5px] tabular-nums max-sm:text-[11.5px]">
                {height === null ? "········" : `#${height.toLocaleString("en-US")}`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
