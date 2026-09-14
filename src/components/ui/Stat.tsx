import type { ReactNode } from "react";

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="bg-panel px-4 py-[13px]">
      <div className="font-mono text-[10.5px] font-medium tracking-[0.12em] text-dim uppercase">
        {label}
      </div>
      <div className="mt-[5px] font-mono text-[17px] font-semibold tracking-[-0.03em] tabular-nums">
        {value}
      </div>
      {sub ? <div className="mt-px text-xs text-dim">{sub}</div> : null}
    </div>
  );
}

/** Stats separated by hairlines: the grid's background shows through a 1px gap. */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-px overflow-hidden rounded-xl border border-line bg-line">
      {children}
    </div>
  );
}
