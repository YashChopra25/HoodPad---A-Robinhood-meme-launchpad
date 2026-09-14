"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useWallet, type Wallet } from "@/hooks/useWallet";

const WalletContext = createContext<Wallet | null>(null);

/**
 * One wallet connection shared by the whole app, so the nav, the trade panel
 * and the create form all see the same account without each running their own
 * discovery and balance polling.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}

export function useWalletContext(): Wallet {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error("useWalletContext must be used inside a WalletProvider.");
  return wallet;
}
