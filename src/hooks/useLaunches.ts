"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Address } from "viem";
import { launchStore } from "@/lib/storage";
import type { StoredLaunch } from "@/lib/types";

/**
 * The browser's own record of launches: coins created here and coins imported
 * by address. With a factory configured this supplements the on-chain board;
 * without one it is the board.
 */
export function useLaunches() {
  const launches = useSyncExternalStore(
    launchStore.subscribe,
    launchStore.getSnapshot,
    launchStore.getServerSnapshot,
  );

  // False during SSR and the first hydration pass, when localStorage is unread.
  const hydrated = useSyncExternalStore(
    launchStore.subscribe,
    () => true,
    () => false,
  );

  const register = useCallback(
    (launch: Omit<StoredLaunch, "addedAt"> & { addedAt?: number }) => launchStore.add(launch),
    [],
  );
  const forget = useCallback((address: Address) => launchStore.remove(address), []);

  return { launches, hydrated, register, forget };
}
