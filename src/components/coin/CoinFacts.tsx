import CopyButton from "@/components/ui/CopyButton";
import { explorerAddressUrl } from "@/lib/chains";
import { NATIVE_SYMBOL, ZERO_ADDRESS } from "@/lib/env";
import { formatEth, formatPercent, formatTokens, shortenAddress } from "@/lib/format";
import { reservesAtGraduation } from "@/lib/curve";
import type { Coin } from "@/lib/types";

/**
 * The parts of a launch a buyer should check before touching it: who holds
 * what, whether the owner can still change anything, and every tax in force.
 */
export default function CoinFacts({ coin }: { coin: Coin }) {
  const hasCurve = coin.curveSupply > 0n;
  const creatorShare = coin.totalSupply - coin.curveSupply;
  const creatorPercent = coin.totalSupply === 0n
    ? 0n
    : (creatorShare * 10000n) / coin.totalSupply;
  const pool = reservesAtGraduation(coin);
  const renounced = coin.owner === ZERO_ADDRESS;

  return (
    <div className="card flex flex-col gap-3.5">
      <div className="card-title">Contract</div>

      <div className="flex items-center justify-between gap-3">
        <a
          href={explorerAddressUrl(coin.address)}
          target="_blank"
          rel="noreferrer"
          className="mono text-[13px] wrap-anywhere"
        >
          {shortenAddress(coin.address, 8)}
        </a>
        <CopyButton value={coin.address} />
      </div>

      <dl className="facts">
        <dt>Total supply</dt>
        <dd className="mono">
          {formatTokens(coin.totalSupply)} {coin.symbol}
        </dd>

        <dt>Creator</dt>
        <dd>
          <a
            href={explorerAddressUrl(coin.creator)}
            target="_blank"
            rel="noreferrer"
            className="mono"
          >
            {shortenAddress(coin.creator)}
          </a>
        </dd>

        <dt>Creator allocation</dt>
        <dd className="mono">
          {creatorShare === 0n ? (
            <span className="text-up">None</span>
          ) : (
            <span className={creatorPercent > 2000n ? "text-sell" : undefined}>
              {formatPercent(creatorPercent)}
            </span>
          )}
        </dd>

        <dt>Ownership</dt>
        <dd>
          {renounced ? (
            <span className="text-up">Renounced</span>
          ) : (
            <span className="chip chip-warn">Owner active</span>
          )}
        </dd>

        <dt>Platform tax</dt>
        <dd className="mono">{formatPercent(coin.platformTaxBps)}</dd>

        <dt>Creator tax</dt>
        <dd className="mono">{coin.taxBps === 0n ? "None" : formatPercent(coin.taxBps)}</dd>

        <dt>Anti-bot</dt>
        <dd>{coin.antiBot ? "One buy per block" : "Off"}</dd>

        <dt>Max wallet</dt>
        <dd className="mono">
          {coin.maxWallet === 0n ? "No cap" : `${formatTokens(coin.maxWallet)} ${coin.symbol}`}
        </dd>

        {hasCurve && !coin.graduated ? (
          <>
            <dt>Pool at graduation</dt>
            <dd className="mono">
              {formatTokens(pool.tokens)} {coin.symbol} + {formatEth(pool.eth, 3)} {NATIVE_SYMBOL}
            </dd>
          </>
        ) : null}

        {coin.pair !== ZERO_ADDRESS ? (
          <>
            <dt>Pool</dt>
            <dd>
              <a
                href={explorerAddressUrl(coin.pair)}
                target="_blank"
                rel="noreferrer"
                className="mono"
              >
                {shortenAddress(coin.pair)}
              </a>
            </dd>
          </>
        ) : null}
      </dl>

      {!renounced ? (
        <p className="field-hint">
          The owner can still change this coin&rsquo;s picture, links and exemption list. Supply is
          fixed regardless — there is no mint function in the contract.
        </p>
      ) : null}
    </div>
  );
}
