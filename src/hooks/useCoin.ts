"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { readBalance, readCoin } from "@/lib/token";
import { readableError } from "@/lib/format";
import type { Coin } from "@/lib/types";

interface Snapshot {
  address: Address;
  account: Address | null;
  coin: Coin | null;
  balance: bigint | null;
  error: string;
}

interface CoinResult {
  coin: Coin | null;
  balance: bigint | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}

/**
 * On-chain state for one coin, plus the connected wallet's balance in it.
 *
 * Fetching is kept separate from state: `load` is pure and returns a snapshot
 * tagged with the address and account it was read for, and only the caller
 * commits it. That is what lets a stale response from a previous coin be
 * dropped, and it keeps every setState behind an await.
 */
export function useCoin(
  address: Address | null,
  account: Address | null,
  { pollMs = 12000 }: { pollMs?: number } = {},
): CoinResult {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const load = useCallback(async (): Promise<Snapshot | null> => {
    if (!address) return null;
    try {
      const [coin, balance] = await Promise.all([readCoin(address), readBalance(address, account)]);
      return { address, account, coin, balance, error: "" };
    } catch (err) {
      return { address, account, coin: null, balance: null, error: readableError(err) };
    }
  }, [address, account]);

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

  // Anything tagged with a different address or account belongs to a previous
  // selection, so it reads as "still loading" rather than showing stale numbers.
  const current =
    snapshot && snapshot.address === address && snapshot.account === account ? snapshot : null;

  return {
    coin: current?.coin ?? null,
    balance: current?.balance ?? null,
    error: current?.error ?? "",
    loading: Boolean(address) && current === null,
    refresh,
  };
}
