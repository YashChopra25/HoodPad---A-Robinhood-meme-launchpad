"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { readTrades } from "@/lib/trades";
import type { Trade } from "@/lib/types";

interface Snapshot {
  address: Address;
  trades: Trade[];
}

/**
 * Trade history for one coin, read from its own logs. Polls on a slower beat
 * than the coin state, since the log scan is the expensive half.
 *
 * Results are tagged with the address they were read for, so switching coins
 * shows an empty chart rather than the previous coin's history.
 */
export function useTrades(
  address: Address | null,
  { pollMs = 25000, limit = 300 }: { pollMs?: number; limit?: number } = {},
) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const load = useCallback(async (): Promise<Snapshot | null> => {
    if (!address) return null;
    try {
      return { address, trades: await readTrades(address, { limit }) };
    } catch {
      // A refused log range is not worth surfacing: the chart keeps whatever
      // points it already has.
      return null;
    }
  }, [address, limit]);

  const refresh = useCallback(async () => {
    const next = await load();
    if (next) setSnapshot(next);
  }, [load]);

  useEffect(() => {
    if (!address) return undefined;

    let cancelled = false;
    void (async () => {
      const next = await load();
      if (!cancelled && next) setSnapshot(next);
    })();

    if (!pollMs) {
      return () => {
        cancelled = true;
      };
    }

    const timer = setInterval(() => void refresh(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [address, load, refresh, pollMs]);

  const current = snapshot?.address === address ? snapshot : null;

  return {
    trades: current?.trades ?? EMPTY,
    loading: Boolean(address) && current === null,
    refresh,
  };
}

const EMPTY: Trade[] = [];
