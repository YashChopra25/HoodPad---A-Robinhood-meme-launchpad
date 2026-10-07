"use client";

import { useBlockNumber } from "@/hooks/useBlockNumber";
import { ACTIVE_CHAIN, explorerAddressUrl } from "@/lib/chains";
import { ETH_USD, FACTORY_ADDRESS, NATIVE_SYMBOL } from "@/lib/env";
import { shortenAddress } from "@/lib/format";

const ITEM = "flex shrink-0 items-center gap-1.5 whitespace-nowrap";
const DIVIDER = <span className="h-3 w-px shrink-0 bg-line-strong" aria-hidden="true" />;

/** A terminal-style strip pinned to the bottom: chain health at a glance. */
export default function StatusBar() {
  const block = useBlockNumber();
  const explorer = ACTIVE_CHAIN.blockExplorers?.default;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 h-9 border-t border-line bg-bg/95 backdrop-blur-md">
      <div className="page flex h-full items-center gap-3 overflow-x-auto font-mono text-[11px] text-muted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className={ITEM}>
          <span className={block === null ? "size-[7px] rounded-full bg-dim" : "live-dot"} />
          <span className="text-fg">{block === null ? "Connecting" : "Stable"}</span>
        </span>
        {DIVIDER}
        <span className={ITEM}>{ACTIVE_CHAIN.name}</span>
        {DIVIDER}
        <span className={ITEM} title="Latest block">
          Block <span className="tabular-nums text-fg">{block === null ? "—" : `#${block.toLocaleString("en-US")}`}</span>
        </span>
        {ETH_USD ? (
          <>
            {DIVIDER}
            <span className={ITEM}>
              {NATIVE_SYMBOL} <span className="text-fg">${ETH_USD.toLocaleString("en-US")}</span>
            </span>
          </>
        ) : null}
        {DIVIDER}
        <span className={ITEM}>Chain {ACTIVE_CHAIN.id}</span>

        <span className="flex-1" />

        {FACTORY_ADDRESS ? (
          <a className={`${ITEM} hover:text-fg`} href={explorerAddressUrl(FACTORY_ADDRESS)} target="_blank" rel="noreferrer">
            Factory {shortenAddress(FACTORY_ADDRESS)} ↗
          </a>
        ) : null}
        {explorer ? (
          <a className={`${ITEM} hover:text-fg`} href={explorer.url} target="_blank" rel="noreferrer">
            {explorer.name} ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}
