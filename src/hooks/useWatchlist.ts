"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Address } from "viem";
import { watchStore } from "@/lib/storage";

/** Per-browser watchlist. Nothing to sign, nothing stored on-chain. */
export function useWatchlist() {
  const watched = useSyncExternalStore(
    watchStore.subscribe,
    watchStore.getSnapshot,
    watchStore.getServerSnapshot,
  );

  const isWatched = useCallback(
    (address: string) => watched.some((entry) => entry.toLowerCase() === address.toLowerCase()),
    [watched],
  );

  const toggle = useCallback((address: Address) => watchStore.toggle(address), []);

  return { watched, isWatched, toggle };
}
