import type { EIP1193Provider } from "viem";
import { ACTIVE_CHAIN } from "@/lib/chains";

const LAST_WALLET_KEY = `robinhood-launchpad:${ACTIVE_CHAIN.id}:last-wallet`;

export interface WalletInfo {
  uuid: string;
  rdns: string;
  name: string;
  icon: string | null;
}

export interface DiscoveredWallet {
  info: WalletInfo;
  provider: EIP1193Provider;
}

interface AnnounceEvent extends CustomEvent {
  detail: { info: WalletInfo; provider: EIP1193Provider };
}

const EMPTY: DiscoveredWallet[] = [];

let announced: DiscoveredWallet[] = [];
let snapshot: DiscoveredWallet[] = EMPTY;
let fallback: DiscoveredWallet[] | null = null;
let started = false;
const listeners = new Set<() => void>();

/**
 * Wallets that predate EIP-6963 only expose window.ethereum. Wrapping it means
 * the picker still has something to show when nothing announces itself.
 */
function injectedFallback(): DiscoveredWallet[] {
  if (typeof window === "undefined") return EMPTY;
  const injected = (window as { ethereum?: EIP1193Provider & { isMetaMask?: boolean } }).ethereum;
  if (!injected) return EMPTY;

  fallback ??= [
    {
      info: {
        uuid: "injected",
        rdns: "injected",
        name: injected.isMetaMask ? "MetaMask" : "Injected wallet",
        icon: null,
      },
      provider: injected,
    },
  ];
  return fallback;
}

function recompute() {
  snapshot = announced.length > 0 ? announced : injectedFallback();
}

function handleAnnounce(event: Event) {
  const { detail } = event as AnnounceEvent;
  if (!detail?.info?.rdns || !detail.provider) return;
  if (announced.some((wallet) => wallet.info.rdns === detail.info.rdns)) return;

  // A new array each time, so useSyncExternalStore sees the change.
  announced = [...announced, { info: detail.info, provider: detail.provider }];
  recompute();
  listeners.forEach((listener) => listener());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("eip6963:announceProvider", handleAnnounce);
  // Wallets answer this synchronously with one announce event each.
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  recompute();
}

/**
 * EIP-6963 wallet discovery as an external store. The user picks which
 * installed wallet to use, rather than whichever one won the race for
 * window.ethereum.
 */
export const walletStore = {
  subscribe(listener: () => void) {
    // Registered before discovery starts, so wallets announcing during start()
    // still reach this listener.
    listeners.add(listener);
    start();
    // Wallets injected after first paint announce late; ask again.
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot: () => snapshot,
  getServerSnapshot: () => EMPTY,
};

/** Remembering the chosen wallet lets a reload reconnect without a prompt. */
export function rememberWallet(rdns: string) {
  try {
    window.localStorage.setItem(LAST_WALLET_KEY, rdns);
  } catch {
    // Storage can be unavailable; remembering is a convenience only.
  }
}

export function forgetWallet() {
  try {
    window.localStorage.removeItem(LAST_WALLET_KEY);
  } catch {
    // See above.
  }
}

export function rememberedWallet(): string | null {
  try {
    return window.localStorage.getItem(LAST_WALLET_KEY);
  } catch {
    return null;
  }
}
