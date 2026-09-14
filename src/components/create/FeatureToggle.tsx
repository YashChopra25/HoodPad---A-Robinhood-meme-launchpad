"use client";

import type { ReactNode } from "react";

/** A launch option with its price attached, so the cost is never a surprise. */
export default function FeatureToggle({
  icon,
  title,
  price,
  description,
  checked,
  onChange,
  children,
}: {
  icon: string;
  title: string;
  price?: string;
  description: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        className="group flex w-full cursor-pointer items-start gap-3 rounded-lg border border-line bg-elevated p-3.5 text-left transition-colors not-data-[on=true]:hover:border-line-strong data-[on=true]:border-accent/30 data-[on=true]:bg-accent/10"
        data-on={checked}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span
          className="mt-px grid size-[19px] shrink-0 place-items-center rounded-[5px] border-[1.5px] border-line-strong text-xs text-transparent transition-colors group-data-[on=true]:border-accent group-data-[on=true]:bg-accent group-data-[on=true]:text-accent-ink"
          aria-hidden="true"
        >
          ✓
        </span>
        <span className="flex-1">
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span aria-hidden="true">{icon}</span>
            {title}
            {price ? <span className="chip">{price}</span> : null}
          </span>
          <span className="mt-[3px] block text-[12.5px] leading-[1.45] text-muted">
            {description}
          </span>
        </span>
      </button>
      {checked && children ? <div className="pt-3 pr-3.5 pb-0.5 pl-[45px]">{children}</div> : null}
    </div>
  );
}
