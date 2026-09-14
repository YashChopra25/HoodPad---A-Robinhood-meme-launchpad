"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { readPool, routerAvailable } from "@/lib/uniswap";
import { HAS_ROUTER } from "@/lib/env";
import { readableError } from "@/lib/format";
import type { PoolInfo } from "@/lib/types";

interface Snapshot {
  token: Address | null;
  pool: PoolInfo | null;
  available: boolean;
  error: string;
}

/**
 * The Uniswap V2 pool for one token, when a router is configured. `available`
 * separates "no router set" from "router set but not deployed on this chain",
 * because the liquidity page needs to say which it is.
 */
export function usePool(token: Address | null, account: Address | null) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const load = useCallback(async (): Promise<Snapshot> => {
    if (!token || !HAS_ROUTER) {
      return { token, pool: null, available: HAS_ROUTER, error: "" };
    }
    try {
      const available = await routerAvailable();
      return {
        token,
        available,
        pool: available ? await readPool(token, account) : null,
        error: "",
      };
    } catch (err) {
      return { token, pool: null, available: true, error: readableError(err) };
    }
  }, [token, account]);

  const refresh = useCallback(async () => {
    setSnapshot(await load());
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await load();
      if (!cancelled) setSnapshot(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const current = snapshot?.token === token ? snapshot : null;

  return {
    pool: current?.pool ?? null,
    available: HAS_ROUTER ? (current?.available ?? null) : false,
    loading: Boolean(token) && current === null,
    error: current?.error ?? "",
    refresh,
  };
}
