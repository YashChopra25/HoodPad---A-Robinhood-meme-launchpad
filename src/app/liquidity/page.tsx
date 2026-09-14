"use client";

import { useState } from "react";
import Link from "next/link";
import { isAddress, type Address } from "viem";
import CoinAvatar from "@/components/CoinAvatar";
import LiquidityPanel from "@/components/liquidity/LiquidityPanel";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Notice from "@/components/ui/Notice";
import { useWalletContext } from "@/components/WalletProvider";
import { useCoin } from "@/hooks/useCoin";
import { useCoins, useCoinsByCreator } from "@/hooks/useCoins";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { HAS_FACTORY, HAS_ROUTER, ROUTER_ADDRESS } from "@/lib/env";
import { shortenAddress } from "@/lib/format";
import type { Coin } from "@/lib/types";

/**
 * Manual pool management, for fixed-supply launches and for graduated coins.
 * A live curve does not appear here: it is not tradable on a DEX until it
 * graduates, and graduation seeds the pool by itself.
 */
export default function LiquidityPage() {
  const wallet = useWalletContext();
  const { coins } = useCoins({ pollMs: 0 });
  const { coins: created } = useCoinsByCreator(wallet.account);
  const [address, setAddress] = useState<Address | null>(null);
  const [input, setInput] = useState("");

  const { coin, refresh } = useCoin(address, wallet.account);

  const candidates: Coin[] = (HAS_FACTORY ? created : coins).filter(
    (entry) =>
      wallet.account &&
      entry.creator.toLowerCase() === wallet.account.toLowerCase() &&
      (entry.curveSupply === 0n || entry.graduated),
  );

  return (
    <main className="page max-w-[780px] flex-1 pt-7 pb-20 max-sm:pt-5">
      <div className="mb-[18px]">
        <span className="eyebrow">Manage liquidity</span>
        <h2 className="mt-3 text-[clamp(22px,3vw,30px)] tracking-[-0.04em]">
          Uniswap V2 pools on {ACTIVE_CHAIN.name}
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          For fixed-supply launches, and for coins that have already graduated.
          A coin still on its bonding curve trades here without a pool and seeds
          one itself when it fills.
        </p>
      </div>

      {!HAS_ROUTER ? (
        <Notice tone="warn">No Uniswap V2 router is configured.</Notice>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="card flex flex-col gap-4">
            <Field
              label="Coin"
              hint={`Router: ${shortenAddress(ROUTER_ADDRESS ?? "", 6)}`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  className="input mono"
                  placeholder="0x… token address"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                />
                <Button
                  disabled={!isAddress(input.trim())}
                  onClick={() => setAddress(input.trim() as Address)}
                >
                  Load
                </Button>
              </div>
            </Field>

            {candidates.length > 0 ? (
              <>
                <div className="h-px bg-line" />
                <div className="card-title">Your coins</div>
                <div className="flex flex-col gap-[7px]">
                  {candidates.map((entry) => (
                    <button
                      key={entry.address}
                      className="wallet-option"
                      onClick={() => {
                        setAddress(entry.address);
                        setInput(entry.address);
                      }}
                    >
                      <CoinAvatar
                        address={entry.address}
                        symbol={entry.symbol}
                        image={entry.meta.image}
                        size={27}
                      />
                      <span className="flex-1 text-left">
                        {entry.name}{" "}
                        <span className="mono text-dim">${entry.symbol}</span>
                      </span>
                      <span className="mono text-[12.5px] text-dim">
                        {shortenAddress(entry.address)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {coin ? (
            coin.curveSupply > 0n && !coin.graduated ? (
              <Notice>
                <strong>{coin.name}</strong> is still on its bonding curve, so
                it does not need a pool yet — it opens one automatically at
                graduation and burns the LP tokens.{" "}
                <Link href={`/coin/${coin.address}`} className="text-accent">
                  Trade it here
                </Link>
                .
              </Notice>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5">
                  <CoinAvatar
                    address={coin.address}
                    symbol={coin.symbol}
                    image={coin.meta.image}
                    size={40}
                  />
                  <div>
                    <div className="font-semibold">{coin.name}</div>
                    <div className="mono text-[12.5px] text-dim">
                      ${coin.symbol}
                    </div>
                  </div>
                  <div className="flex-1" />
                  <Link href={`/coin/${coin.address}`} className="btn btn-sm">
                    Open coin page
                  </Link>
                </div>
                <LiquidityPanel coin={coin} onDone={() => void refresh()} />
              </div>
            )
          ) : address ? (
            <div className="skeleton h-[180px]" />
          ) : null}
        </div>
      )}
    </main>
  );
}
