"use client";

import { useEffect, useState } from "react";
import { useEconomics } from "@/hooks/useEconomics";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { getPublicClient } from "@/lib/clients";
import { FACTORY_ADDRESS, NATIVE_SYMBOL, ROUTER_ADDRESS } from "@/lib/env";
import { formatEth, formatPercent, shortenAddress } from "@/lib/format";

/** A live readout of the network and launch parameters, polled from the RPC. */
export default function LiveTerminal() {
  const { economics } = useEconomics();
  const [block, setBlock] = useState<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await getPublicClient().getBlockNumber();
        if (!cancelled) setBlock(next);
      } catch {
        // A dropped poll just leaves the last block on screen.
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const rpcHost = hostOf(ACTIVE_CHAIN.rpcUrls.default.http[0]);

  const rows: Array<[string, string]> = [
    ["network", ACTIVE_CHAIN.name],
    ["chain_id", String(ACTIVE_CHAIN.id)],
    ["block", block === null ? "syncing…" : `#${block.toLocaleString("en-US")}`],
    ["gas_token", NATIVE_SYMBOL],
    ["factory", FACTORY_ADDRESS ? shortenAddress(FACTORY_ADDRESS, 6) : "not deployed"],
    ["router", ROUTER_ADDRESS ? shortenAddress(ROUTER_ADDRESS, 6) : "none"],
    ["curve_fee", formatPercent(economics.tradeFeeBps)],
    ["graduates_at", `${formatEth(economics.graduationTarget, 4)} ${NATIVE_SYMBOL}`],
  ];

  return (
    <div
      className="overflow-hidden rounded-xl border border-line bg-panel/80 font-mono text-xs"
      aria-label="Network status"
    >
      <div className="flex items-center gap-1.5 border-b border-line px-[13px] py-[9px] text-[11px] text-dim">
        <i className="size-2 rounded-full bg-panel-3" />
        <i className="size-2 rounded-full bg-panel-3" />
        <i className="size-2 rounded-full bg-panel-3" />
        <span className="ml-1.5">launchpad://status</span>
        <span className="flex-1" />
        <span className="live-dot" />
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-[7px] px-4 py-3.5">
        {rows.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-dim">{key}</dt>
            <dd className="m-0 text-right wrap-anywhere text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-line px-4 py-[9px] text-[10.5px] tracking-[0.08em] text-dim uppercase">
        rpc // {rpcHost}
      </div>
    </div>
  );
}

function hostOf(url: string | undefined): string {
  try {
    return url ? new URL(url).host : "—";
  } catch {
    return "—";
  }
}
