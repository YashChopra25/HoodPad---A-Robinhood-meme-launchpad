"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Address } from "viem";
import { readCreatedBy, readLatest, readLaunchTimes, type LaunchRecord } from "@/lib/factory";
import { readCoins } from "@/lib/token";
import { HAS_FACTORY } from "@/lib/env";
import { readableError } from "@/lib/format";
import { launchStore } from "@/lib/storage";
import type { Coin, StoredLaunch } from "@/lib/types";

export type SortKey = "new" | "trending" | "mcap" | "graduated";

interface CoinsResult {
  coins: Coin[];
  loading: boolean;
  error: string;
  /** True once the local registry has been read, which SSR cannot do. */
  hydrated: boolean;
  refresh: () => Promise<void>;
}

/**
 * The coin board.
 *
 * With a factory configured the list comes off the chain and every visitor
 * sees the same launches. Without one it falls back to whatever this browser
 * recorded — the app stays usable with nothing deployed, and the UI says which
 * of the two it is rather than pretending the list is global.
 *
 * Addresses from both sources are merged, so a coin imported by address shows
 * up alongside the registry.
 */
export function useCoins({
  pollMs = 20000,
  limit = 48,
}: { pollMs?: number; limit?: number } = {}): CoinsResult {
  const stored = useSyncExternalStore(
    launchStore.subscribe,
    launchStore.getSnapshot,
    launchStore.getServerSnapshot,
  );
  const hydrated = useSyncExternalStore(
    launchStore.subscribe,
    () => true,
    () => false,
  );

  const [result, setResult] = useState<{ coins: Coin[]; error: string } | null>(null);

  const load = useCallback(async (): Promise<{ coins: Coin[]; error: string }> => {
    try {
      const fromChain = HAS_FACTORY ? await readLatest(0, limit) : [];
      const seen = new Set(fromChain.map((address) => address.toLowerCase()));
      const extras = stored
        .map((entry) => entry.address)
        .filter((address) => !seen.has(address.toLowerCase()));

      const addresses = [...fromChain, ...extras] as Address[];
      const coins = await readCoins(addresses);

      // Launch times come from logs, which some RPCs refuse for wide ranges. A
      // coin without one still renders, just without an age.
      const times = await readLaunchTimes(addresses).catch(
        () => new Map<string, LaunchRecord>(),
      );

      return { coins: coins.map((coin) => withLaunchTime(coin, times, stored)), error: "" };
    } catch (err) {
      return { coins: [], error: readableError(err) };
    }
  }, [limit, stored]);

  const refresh = useCallback(async () => {
    setResult(await load());
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await load();
      if (!cancelled) setResult(next);
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
  }, [load, refresh, pollMs]);

  return {
    coins: result?.coins ?? EMPTY,
    loading: result === null,
    error: result?.error ?? "",
    hydrated,
    refresh,
  };
}

function withLaunchTime(
  coin: Coin,
  times: Map<string, LaunchRecord>,
  stored: readonly StoredLaunch[],
): Coin {
  const key = coin.address.toLowerCase();
  return {
    ...coin,
    launchedAt:
      times.get(key)?.timestamp ??
      stored.find((entry) => entry.address.toLowerCase() === key)?.addedAt,
  };
}

/**
 * Orders the board. "Trending" ranks by the volume that has moved through a
 * coin — the only such figure available without an indexer, and a fair proxy
 * for how much attention it is actually getting.
 */
export function sortCoins(coins: readonly Coin[], key: SortKey): Coin[] {
  const list = [...coins];
  switch (key) {
    case "trending":
      return list.sort((a, b) => compare(b.volume, a.volume) || compare(b.ethReserve, a.ethReserve));
    case "mcap":
      return list.sort((a, b) => compare(b.marketCapWei, a.marketCapWei));
    case "graduated":
      return list.filter((coin) => coin.graduated).sort((a, b) => compare(b.volume, a.volume));
    case "new":
    default:
      return list.sort((a, b) => (b.launchedAt ?? 0) - (a.launchedAt ?? 0));
  }
}

function compare(a: bigint, b: bigint): number {
  return a === b ? 0 : a > b ? 1 : -1;
}

export function filterCoins(coins: readonly Coin[], query: string): Coin[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...coins];
  return coins.filter((coin) =>
    [coin.name, coin.symbol, coin.address, coin.meta.description]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}

/** Launches created by one wallet, straight from the factory's own index. */
export function useCoinsByCreator(creator: Address | null) {
  const [result, setResult] = useState<{ creator: Address; coins: Coin[] } | null>(null);

  useEffect(() => {
    if (!creator) return undefined;

    let cancelled = false;
    void (async () => {
      try {
        const addresses = await readCreatedBy(creator);
        const coins = await readCoins(addresses);
        if (!cancelled) setResult({ creator, coins: coins.reverse() });
      } catch {
        if (!cancelled) setResult({ creator, coins: [] });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [creator]);

  const current = result?.creator === creator ? result : null;

  return useMemo(
    () => ({ coins: current?.coins ?? EMPTY, loading: Boolean(creator) && current === null }),
    [current, creator],
  );
}

const EMPTY: Coin[] = [];
