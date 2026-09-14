import { isAddress, type Address } from "viem";
import { ACTIVE_CHAIN } from "@/lib/chains";
import type { StoredLaunch } from "@/lib/types";

/**
 * A small localStorage-backed registry, exposed as an external store for
 * useSyncExternalStore.
 *
 * With a factory configured the coin board comes from the chain and this only
 * holds extras: coins imported by address, and the watchlist. Without a factory
 * it is the only record of a launch this browser made, which is what keeps the
 * app usable with no deployment at all.
 */
function createStore<T>(name: string, validate: (entry: unknown) => entry is T) {
  const key = `robinhood-launchpad:${ACTIVE_CHAIN.id}:${name}`;
  const EMPTY: T[] = [];

  let snapshot: T[] = EMPTY;
  let snapshotRaw: string | null | undefined;
  const listeners = new Set<() => void>();

  function read(): T[] {
    if (typeof window === "undefined") return EMPTY;

    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return EMPTY;
    }

    // Cached against the raw string so getSnapshot stays referentially stable
    // across renders, which useSyncExternalStore requires.
    if (raw === snapshotRaw) return snapshot;
    snapshotRaw = raw;

    try {
      const parsed: unknown = raw ? JSON.parse(raw) : EMPTY;
      snapshot = Array.isArray(parsed) ? parsed.filter(validate) : EMPTY;
    } catch {
      snapshot = EMPTY;
    }
    return snapshot;
  }

  function write(next: T[]) {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Private-mode storage failures are not worth breaking a launch over.
    }
    snapshotRaw = undefined;
    read();
    listeners.forEach((listener) => listener());
  }

  return {
    read,
    write,
    subscribe(listener: () => void) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) {
          snapshotRaw = undefined;
          listener();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot: read,
    getServerSnapshot: () => EMPTY,
  };
}

function isStoredLaunch(entry: unknown): entry is StoredLaunch {
  return (
    typeof entry === "object" &&
    entry !== null &&
    typeof (entry as StoredLaunch).address === "string" &&
    isAddress((entry as StoredLaunch).address)
  );
}

function isAddressEntry(entry: unknown): entry is Address {
  return typeof entry === "string" && isAddress(entry);
}

const launches = createStore("launches", isStoredLaunch);
const watchlist = createStore("watchlist", isAddressEntry);

function same(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a) && Boolean(b) && a!.toLowerCase() === b!.toLowerCase();
}

export const launchStore = {
  subscribe: launches.subscribe,
  getSnapshot: launches.getSnapshot,
  getServerSnapshot: launches.getServerSnapshot,

  add(launch: Omit<StoredLaunch, "addedAt"> & { addedAt?: number }) {
    const current = launches.read();
    if (current.some((entry) => same(entry.address, launch.address))) return;
    launches.write([{ addedAt: Date.now(), ...launch }, ...current]);
  },

  remove(address: Address) {
    launches.write(launches.read().filter((entry) => !same(entry.address, address)));
  },
};

export const watchStore = {
  subscribe: watchlist.subscribe,
  getSnapshot: watchlist.getSnapshot,
  getServerSnapshot: watchlist.getServerSnapshot,

  toggle(address: Address) {
    const current = watchlist.read();
    watchlist.write(
      current.some((entry) => same(entry, address))
        ? current.filter((entry) => !same(entry, address))
        : [address, ...current],
    );
  },
};
