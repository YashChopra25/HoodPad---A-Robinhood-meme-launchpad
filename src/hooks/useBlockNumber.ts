"use client";

import { useEffect, useState } from "react";
import { getPublicClient } from "@/lib/clients";

/** The latest block number, polled from the RPC. Null until the first read lands. */
export function useBlockNumber(pollMs = 4000): bigint | null {
  const [block, setBlock] = useState<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await getPublicClient().getBlockNumber();
        if (!cancelled) setBlock(next);
      } catch {
        // A dropped poll just leaves the last block on screen.
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollMs]);

  return block;
}
