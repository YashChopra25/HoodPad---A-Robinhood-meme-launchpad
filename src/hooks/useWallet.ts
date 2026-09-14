"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Address, EIP1193Provider } from "viem";
import { ACTIVE_CHAIN, getChainById, toAddChainParams } from "@/lib/chains";
import { getPublicClient } from "@/lib/clients";
import { readableError } from "@/lib/format";
import {
  forgetWallet,
  rememberWallet,
  rememberedWallet,
  walletStore,
  type DiscoveredWallet,
} from "@/lib/wallets";

export interface Wallet {
  wallets: DiscoveredWallet[];
  selectedWallet: DiscoveredWallet | null;
  provider: EIP1193Provider | null;
  account: Address | null;
  chainId: number | null;
  chainName: string | null;
  balance: bigint | null;
  status: "idle" | "connecting" | "switching";
  error: string;
  hasWallet: boolean;
  isConnected: boolean;
  isCorrectChain: boolean;
  connect: (wallet: DiscoveredWallet) => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

interface BalanceResult {
  account: Address | null;
  chainId: number | null;
  value: bigint | null;
}

/**
 * Wallet connection, chain awareness and native balance for the whole app.
 * Wallets come from EIP-6963 discovery, so the user picks which installed
 * wallet to use rather than whichever one won the window.ethereum race.
 */
export function useWallet(): Wallet {
  const wallets = useSyncExternalStore(
    walletStore.subscribe,
    walletStore.getSnapshot,
    walletStore.getServerSnapshot,
  );

  const [selectedRdns, setSelectedRdns] = useState<string | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balanceResult, setBalanceResult] = useState<BalanceResult | null>(null);
  const [status, setStatus] = useState<Wallet["status"]>("idle");
  const [error, setError] = useState("");

  const selected = wallets.find((wallet) => wallet.info.rdns === selectedRdns) ?? null;
  const provider = selected?.provider ?? null;

  // Tagged with what it was fetched for, so a wallet or network change never
  // leaves the previous balance on screen.
  const balance =
    balanceResult && balanceResult.account === account && balanceResult.chainId === chainId
      ? balanceResult.value
      : null;

  // A promise chain rather than async/await, so an effect calling this sets no
  // state synchronously.
  const refreshBalance = useCallback((address: Address | null, currentChainId: number | null) => {
    if (!address || currentChainId !== ACTIVE_CHAIN.id) return Promise.resolve();
    return getPublicClient()
      .getBalance({ address })
      .then((value) => setBalanceResult({ account: address, chainId: currentChainId, value }))
      .catch(() => setBalanceResult({ account: address, chainId: currentChainId, value: null }));
  }, []);

  const connect = useCallback(
    async (wallet: DiscoveredWallet) => {
      if (!wallet) return;
      setStatus("connecting");
      setError("");
      try {
        const accounts = (await wallet.provider.request({
          method: "eth_requestAccounts",
        })) as Address[];
        const hexChainId = (await wallet.provider.request({ method: "eth_chainId" })) as string;
        const nextChainId = Number(hexChainId);

        setSelectedRdns(wallet.info.rdns);
        setAccount(accounts[0] ?? null);
        setChainId(nextChainId);
        rememberWallet(wallet.info.rdns);
        await refreshBalance(accounts[0] ?? null, nextChainId);
      } catch (err) {
        setError(readableError(err));
      } finally {
        setStatus("idle");
      }
    },
    [refreshBalance],
  );

  const disconnect = useCallback(() => {
    setSelectedRdns(null);
    setAccount(null);
    setChainId(null);
    setBalanceResult(null);
    setError("");
    forgetWallet();
  }, []);

  // Silently restore the last wallet once discovery finds it again. Uses
  // eth_accounts, which never prompts.
  useEffect(() => {
    if (account || wallets.length === 0) return undefined;
    const wallet = wallets.find((entry) => entry.info.rdns === rememberedWallet());
    if (!wallet) return undefined;

    let cancelled = false;
    void (async () => {
      const accounts = (await wallet.provider.request({ method: "eth_accounts" })) as Address[];
      if (cancelled || !accounts?.[0]) return;
      const hexChainId = (await wallet.provider.request({ method: "eth_chainId" })) as string;
      if (cancelled) return;
      setSelectedRdns(wallet.info.rdns);
      setAccount(accounts[0]);
      setChainId(Number(hexChainId));
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [wallets, account]);

  // Follow account and network changes made inside the wallet.
  useEffect(() => {
    if (!provider) return undefined;

    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as Address[];
      setAccount(accounts?.[0] ?? null);
    };
    const onChainChanged = (...args: unknown[]) => setChainId(Number(args[0] as string));

    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, [provider]);

  // Keep the native balance in step with the current account and network.
  useEffect(() => {
    if (!account || chainId !== ACTIVE_CHAIN.id) return;
    void refreshBalance(account, chainId);
  }, [account, chainId, refreshBalance]);

  /** Switch to the active chain, registering the network if the wallet lacks it. */
  const switchChain = useCallback(async () => {
    if (!provider) return;
    setStatus("switching");
    setError("");
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${ACTIVE_CHAIN.id.toString(16)}` }],
      });
    } catch (err) {
      // 4902: the wallet has never heard of this chain, so register it first.
      const code = (err as { code?: number; data?: { originalError?: { code?: number } } })?.code;
      const nested = (err as { data?: { originalError?: { code?: number } } })?.data?.originalError
        ?.code;
      if (code === 4902 || nested === 4902) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [toAddChainParams()],
          });
        } catch (addError) {
          setError(readableError(addError));
        }
      } else {
        setError(readableError(err));
      }
    } finally {
      setStatus("idle");
    }
  }, [provider]);

  return useMemo(
    () => ({
      wallets,
      selectedWallet: selected,
      provider,
      account,
      chainId,
      chainName: getChainById(chainId)?.name ?? (chainId ? `Chain ${chainId}` : null),
      balance,
      status,
      error,
      hasWallet: wallets.length > 0,
      isConnected: Boolean(account) && Boolean(provider),
      isCorrectChain: chainId === ACTIVE_CHAIN.id,
      connect,
      disconnect,
      switchChain,
      refreshBalance: () => refreshBalance(account, chainId),
    }),
    [
      wallets,
      selected,
      provider,
      account,
      chainId,
      balance,
      status,
      error,
      connect,
      disconnect,
      switchChain,
      refreshBalance,
    ],
  );
}
