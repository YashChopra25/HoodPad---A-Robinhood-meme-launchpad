"use client";

import { useMemo, useState } from "react";
import { formatUnits, parseEther, parseUnits } from "viem";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";
import { useWalletContext } from "@/components/WalletProvider";
import { quoteBuy, quoteSell, withSlippage } from "@/lib/curve";
import { buy, sell } from "@/lib/token";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { NATIVE_SYMBOL } from "@/lib/env";
import { formatEth, formatTokens, formatPercent, readableError } from "@/lib/format";
import type { Coin } from "@/lib/types";

type Side = "buy" | "sell";

const ETH_PRESETS = ["0.01", "0.05", "0.1", "0.5"];
const SELL_PRESETS: Array<[string, number]> = [
  ["25%", 0.25],
  ["50%", 0.5],
  ["75%", 0.75],
  ["Max", 1],
];

/**
 * Buying and selling against the curve.
 *
 * Quotes are computed locally from the reserves so they update on every
 * keystroke, then the trade is simulated against the contract before signing —
 * the number shown and the number executed come from the same maths.
 */
export default function TradePanel({
  coin,
  balance,
  onDone,
}: {
  coin: Coin;
  balance: bigint | null;
  onDone: () => void;
}) {
  const wallet = useWalletContext();
  const toast = useToast();

  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(2);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => {
    const raw = amount.trim();
    if (!raw) return null;
    try {
      return side === "buy" ? parseEther(raw) : parseUnits(raw, 18);
    } catch {
      return null;
    }
  }, [amount, side]);

  const quote = useMemo(() => {
    if (!parsed || parsed <= 0n) return null;
    return side === "buy" ? quoteBuy(coin, parsed) : quoteSell(coin, parsed);
  }, [coin, parsed, side]);

  if (coin.curveSupply === 0n) {
    return (
      <div className="card flex flex-col gap-4">
        <div className="card-title">Trade</div>
        <Notice>
          This is a fixed-supply launch with no bonding curve. It trades only where its creator has
          opened a pool.
        </Notice>
      </div>
    );
  }

  if (coin.graduated) {
    return (
      <div className="card flex flex-col gap-4">
        <div className="card-title">Trade</div>
        <Notice tone="accent">
          This coin has graduated. The curve is closed and its whole raise sits in a Uniswap V2 pool
          with the LP tokens burned — trade it on any DEX front-end for {ACTIVE_CHAIN.name}.
        </Notice>
      </div>
    );
  }

  const insufficient =
    parsed !== null &&
    (side === "buy"
      ? wallet.balance !== null && parsed > wallet.balance
      : balance !== null && parsed > balance);

  const disabled = !parsed || parsed <= 0n || !quote || insufficient;

  async function submit() {
    if (!parsed || !quote || !wallet.account) return;
    setBusy(true);
    try {
      if (side === "buy") {
        const minOut = withSlippage((quote as { tokensOut: bigint }).tokensOut, slippage);
        const { hash } = await buy(
          { provider: wallet.provider, account: wallet.account },
          coin.address,
          amount.trim(),
          minOut,
        );
        toast.success(`Bought ${coin.symbol}.`, hash);
      } else {
        const minOut = withSlippage((quote as { ethOut: bigint }).ethOut, slippage);
        const { hash } = await sell(
          { provider: wallet.provider, account: wallet.account },
          coin.address,
          parsed,
          minOut,
        );
        toast.success(`Sold ${coin.symbol}.`, hash);
      }
      setAmount("");
      onDone();
      void wallet.refreshBalance();
    } catch (err) {
      toast.error(readableError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col gap-3.5">
      <div className="segmented segmented-buy flex">
        <button
          type="button"
          data-side="buy"
          aria-pressed={side === "buy"}
          onClick={() => {
            setSide("buy");
            setAmount("");
          }}
          className="flex-1"
        >
          Buy
        </button>
        <button
          type="button"
          data-side="sell"
          aria-pressed={side === "sell"}
          onClick={() => {
            setSide("sell");
            setAmount("");
          }}
          className="flex-1"
        >
          Sell
        </button>
      </div>

      <div>
        <div className="field-label mb-1.5">
          <span>{side === "buy" ? `You pay (${NATIVE_SYMBOL})` : `You sell (${coin.symbol})`}</span>
          <span className="mono text-dim">
            {side === "buy"
              ? `${formatEth(wallet.balance, 4)} ${NATIVE_SYMBOL}`
              : `${formatTokens(balance)} ${coin.symbol}`}
          </span>
        </div>
        <input
          className={`input input-amount ${insufficient ? "input-invalid" : ""}`.trim()}
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {side === "buy"
            ? ETH_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setAmount(preset)}
                >
                  {preset}
                </button>
              ))
            : SELL_PRESETS.map(([label, fraction]) => (
                <button
                  key={label}
                  type="button"
                  className="btn btn-sm"
                  disabled={!balance}
                  onClick={() => {
                    if (!balance) return;
                    const portion = (balance * BigInt(Math.round(fraction * 10000))) / 10000n;
                    setAmount(formatUnits(portion, 18));
                  }}
                >
                  {label}
                </button>
              ))}
        </div>
      </div>

      <dl className="facts">
        <dt>You receive</dt>
        <dd className="mono">
          {!quote
            ? "—"
            : side === "buy"
              ? `${formatTokens((quote as { tokensOut: bigint }).tokensOut)} ${coin.symbol}`
              : `${formatEth((quote as { ethOut: bigint }).ethOut)} ${NATIVE_SYMBOL}`}
        </dd>

        <dt>Curve fee ({formatPercent(coin.tradeFeeBps)})</dt>
        <dd className="mono">{quote ? `${formatEth(quote.fee)} ${NATIVE_SYMBOL}` : "—"}</dd>

        <dt>Max slippage</dt>
        <dd>
          <div className="segmented p-0.5">
            {[1, 2, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={slippage === value}
                onClick={() => setSlippage(value)}
                className="px-[9px] py-[3px] text-xs"
              >
                {value}%
              </button>
            ))}
          </div>
        </dd>
      </dl>

      {insufficient ? (
        <Notice tone="warn">
          {side === "buy"
            ? `Not enough ${NATIVE_SYMBOL} in your wallet.`
            : `You do not hold that many ${coin.symbol}.`}
        </Notice>
      ) : null}

      {!wallet.isConnected ? (
        <Notice>Connect a wallet to trade.</Notice>
      ) : !wallet.isCorrectChain ? (
        <Button variant="sell" block onClick={() => void wallet.switchChain()}>
          Switch to {ACTIVE_CHAIN.name}
        </Button>
      ) : (
        <Button
          variant={side === "buy" ? "buy" : "sell"}
          size="lg"
          block
          loading={busy}
          disabled={disabled}
          onClick={() => void submit()}
        >
          {side === "buy" ? `Buy ${coin.symbol}` : `Sell ${coin.symbol}`}
        </Button>
      )}

      {coin.antiBot ? (
        <p className="field-hint">
          Anti-bot is on: one buy per wallet per block. Selling is never throttled.
        </p>
      ) : null}
    </div>
  );
}
