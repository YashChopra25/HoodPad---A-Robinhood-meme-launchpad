import type { ReactNode } from "react";

type Tone = "neutral" | "warn" | "error" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "border-transparent bg-panel text-muted dark:border-line",
  warn: "border-warn/25 bg-warn/10 text-warn",
  error: "border-sell/25 bg-sell/10 text-sell",
  accent: "border-up/25 bg-up/10 text-up",
};

const ICONS: Record<Tone, string> = {
  neutral: "›",
  warn: "!",
  error: "!",
  accent: "✓",
};

export default function Notice({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-[11px] text-[13px] leading-normal ${TONES[tone]}`}
      role={tone === "error" ? "alert" : undefined}
    >
      <span aria-hidden="true" className="leading-[1.45] font-bold">
        {icon ?? ICONS[tone]}
      </span>
      <div>{children}</div>
    </div>
  );
}
