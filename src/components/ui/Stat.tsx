import type { ReactNode } from "react";

/** One soft figure card: a quiet label over a bold value. */
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-panel px-[18px] py-4 dark:border dark:border-line">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mono mt-2 truncate text-[17px] font-semibold tracking-[-0.02em]">{value}</div>
      {sub ? <div className="mt-0.5 truncate text-xs text-dim">{sub}</div> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 max-sm:grid-cols-2">
      {children}
    </div>
  );
}
