"use client";

import { useEffect, useState } from "react";
import { formatUnits, maxUint256, parseUnits, type Address } from "viem";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Notice from "@/components/ui/Notice";
import { Stat, StatGrid } from "@/components/ui/Stat";
import { useToast } from "@/components/ui/Toast";
import { useWalletContext } from "@/components/WalletProvider";
import { usePool } from "@/hooks/usePool";
import { approve, readAllowance, readBalance, setPair } from "@/lib/token";
import { addLiquidity, approvePair, createPair, readPairAllowance, removeLiquidity } from "@/lib/uniswap";
import { ACTIVE_CHAIN, explorerAddressUrl } from "@/lib/chains";
import { HAS_ROUTER, NATIVE_SYMBOL, ROUTER_ADDRESS, ZERO_ADDRESS } from "@/lib/env";
import { formatEth, formatTokens, readableError, shortenAddress } from "@/lib/format";
import type { Coin } from "@/lib/types";

type Tab = "add" | "remove";

/**
 * Opening and managing a Uniswap V2 pool for a fixed-supply launch.
 *
 * A curve launch reaches a pool on its own at graduation, with the LP burned;
 * this is the manual path, where the creator supplies and keeps the liquidity.
 */
export default function LiquidityPanel({ coin, onDone }: { coin: Coin; onDone: () => void }) {
  const wallet = useWalletContext();
  const toast = useToast();
  const { pool, available, loading, refresh } = usePool(coin.address, wallet.account);

  const [tab, setTab] = useState<Tab>("add");
  const [tokenAmount, setTokenAmount] = useState("");
  const [ethAmount, setEthAmount] = useState("");
  const [removePercent, setRemovePercent] = useState(100);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [lpAllowance, setLpAllowance] = useState<bigint>(0n);
  const [busy, setBusy] = useState("");
  // Bumped after every confirmed transaction, to re-read the balances and
  // allowances that it just changed.
  const [version, setVersion] = useState(0);

  const signer = { provider: wallet.provider, account: wallet.account };
  const taxed = coin.taxBps > 0n || coin.platformTaxBps > 0n;
  const pairRegistered = coin.pair !== ZERO_ADDRESS;
  const account = wallet.account;
  const pair = pool?.pair ?? null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next =
        account && ROUTER_ADDRESS
          ? await Promise.all([
              readBalance(coin.address, account).catch(() => null),
              readAllowance(coin.address, account, ROUTER_ADDRESS).catch(() => 0n),
            ])
          : ([null, 0n] as const);

      if (cancelled) return;
      setBalance(next[0]);
      setAllowance(next[1]);
    })();

    return () => {
      cancelled = true;
    };
  }, [coin.address, account, version]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next =
        account && pair ? await readPairAllowance(pair, account).catch(() => 0n) : 0n;
      if (!cancelled) setLpAllowance(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [pair, account, version]);

  const parsedToken = safeParse(tokenAmount, 18);
  const parsedEth = safeParse(ethAmount, 18);
  const lpAmount = pool?.lpBalance
    ? (pool.lpBalance * BigInt(Math.round(removePercent * 100))) / 10000n
    : 0n;

  if (!HAS_ROUTER) {
    return (
      <Notice tone="warn">
        No Uniswap V2 router is configured for {ACTIVE_CHAIN.name}. Set{" "}
        <span className="mono">NEXT_PUBLIC_ROUTER_ADDRESS</span> to a V2 router deployed on this
        network to manage pools here. Bonding-curve launches do not need one to trade — they only
        need it to graduate.
      </Notice>
    );
  }

  if (available === false) {
    return (
      <Notice tone="error">
        The configured router at{" "}
        <span className="mono">{shortenAddress(ROUTER_ADDRESS ?? "")}</span> has no contract code on{" "}
        {ACTIVE_CHAIN.name}. Check <span className="mono">NEXT_PUBLIC_ROUTER_ADDRESS</span>.
      </Notice>
    );
  }

  async function run(label: string, action: () => Promise<{ hash: string }>) {
    setBusy(label);
    try {
      const { hash } = await action();
      toast.success(`${label} confirmed.`, hash);
      setVersion((current) => current + 1);
      await refresh();
      onDone();
    } catch (err) {
      toast.error(readableError(err));
    } finally {
      setBusy("");
    }
  }

  const needsApproval = parsedToken > 0n && allowance < parsedToken;

  return (
    <div className="flex flex-col gap-4">
      {pool?.pair ? (
        <StatGrid>
          <Stat
            label="Pooled tokens"
            value={formatTokens(pool.tokenReserve)}
            sub={coin.symbol}
          />
          <Stat
            label={`Pooled ${NATIVE_SYMBOL}`}
            value={formatEth(pool.ethReserve, 4)}
          />
          <Stat
            label="Your LP"
            value={pool.lpBalance === null ? "—" : formatTokens(pool.lpBalance)}
            sub={
              pool.lpBalance && pool.lpTotalSupply
                ? `${((Number(pool.lpBalance) / Number(pool.lpTotalSupply)) * 100).toFixed(2)}% of pool`
                : undefined
            }
          />
        </StatGrid>
      ) : loading ? (
        <div className="skeleton h-[74px]" />
      ) : (
        <Notice>No pool exists for this coin yet. Adding liquidity will create one.</Notice>
      )}

      {taxed && !pairRegistered ? (
        <Notice tone="warn">
          This token charges a transfer tax. Create the pool first and register it on the contract,
          otherwise the router receives less than it asked for and the transaction reverts.
          {pool?.pair && coin.owner !== ZERO_ADDRESS ? (
            <>
              {" "}
              <button
                className="btn btn-sm mt-2"
                disabled={busy !== ""}
                onClick={() =>
                  void run("Pool registration", () =>
                    setPair(signer, coin.address, pool.pair as Address),
                  )
                }
              >
                Register {shortenAddress(pool.pair)}
              </button>
            </>
          ) : null}
        </Notice>
      ) : null}

      <div className="segmented self-start">
        <button type="button" aria-pressed={tab === "add"} onClick={() => setTab("add")}>
          Add liquidity
        </button>
        <button type="button" aria-pressed={tab === "remove"} onClick={() => setTab("remove")}>
          Remove
        </button>
      </div>

      {tab === "add" ? (
        <div className="card flex flex-col gap-3.5">
          <Field
            label={`${coin.symbol} amount`}
            aside={
              <button
                className="btn btn-ghost btn-sm"
                disabled={!balance}
                onClick={() => balance && setTokenAmount(formatUnits(balance, 18))}
              >
                Max {formatTokens(balance)}
              </button>
            }
          >
            <input
              className="input mono"
              inputMode="decimal"
              placeholder="0.0"
              value={tokenAmount}
              onChange={(event) => setTokenAmount(event.target.value)}
            />
          </Field>

          <Field
            label={`${NATIVE_SYMBOL} amount`}
            hint="The ratio of these two amounts sets the opening price of the pool."
            aside={<span className="mono text-dim">{formatEth(wallet.balance, 4)} available</span>}
          >
            <input
              className="input mono"
              inputMode="decimal"
              placeholder="0.0"
              value={ethAmount}
              onChange={(event) => setEthAmount(event.target.value)}
            />
          </Field>

          {!pool?.pair ? (
            <Button
              loading={busy === "Pool creation"}
              onClick={() => void run("Pool creation", () => createPair(signer, coin.address))}
            >
              1 · Create the pool
            </Button>
          ) : null}

          {needsApproval ? (
            <Button
              loading={busy === "Approval"}
              onClick={() =>
                void run("Approval", () =>
                  approve(signer, coin.address, ROUTER_ADDRESS as Address, maxUint256),
                )
              }
            >
              {pool?.pair ? "1" : "2"} · Approve {coin.symbol}
            </Button>
          ) : null}

          <Button
            variant="primary"
            disabled={parsedToken <= 0n || parsedEth <= 0n || needsApproval}
            loading={busy === "Add liquidity"}
            onClick={() =>
              void run("Add liquidity", () =>
                addLiquidity(signer, {
                  token: coin.address,
                  tokenAmount: parsedToken,
                  ethAmount: parsedEth,
                  slippagePercent: taxed ? 12 : 1,
                }),
              )
            }
          >
            Add liquidity
          </Button>

          {taxed ? (
            <p className="field-hint">
              Slippage tolerance is widened automatically for taxed tokens, because the pool
              receives the post-tax amount.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="card flex flex-col gap-3.5">
          {!pool?.lpBalance ? (
            <Notice>You hold no LP tokens for this pool.</Notice>
          ) : (
            <>
              <Field label="Amount to remove" aside={<span className="mono">{removePercent}%</span>}>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={removePercent}
                  onChange={(event) => setRemovePercent(Number(event.target.value))}
                  className="w-full accent-accent"
                />
              </Field>

              {lpAllowance < lpAmount ? (
                <Button
                  loading={busy === "LP approval"}
                  onClick={() =>
                    void run("LP approval", () =>
                      approvePair(signer, { pair: pool.pair as Address, amount: maxUint256 }),
                    )
                  }
                >
                  Approve LP tokens
                </Button>
              ) : null}

              <Button
                variant="sell"
                disabled={lpAmount <= 0n || lpAllowance < lpAmount}
                loading={busy === "Remove liquidity"}
                onClick={() =>
                  void run("Remove liquidity", () =>
                    removeLiquidity(signer, { token: coin.address, lpAmount, taxed }),
                  )
                }
              >
                Remove liquidity
              </Button>
            </>
          )}
        </div>
      )}

      {pool?.pair ? (
        <p className="field-hint">
          Pool:{" "}
          <a href={explorerAddressUrl(pool.pair)} target="_blank" rel="noreferrer" className="mono">
            {shortenAddress(pool.pair, 6)}
          </a>
        </p>
      ) : null}
    </div>
  );
}

/** Parses a user-typed amount, treating anything unparseable as zero. */
function safeParse(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!trimmed) return 0n;
  try {
    return parseUnits(trimmed, decimals);
  } catch {
    return 0n;
  }
}
