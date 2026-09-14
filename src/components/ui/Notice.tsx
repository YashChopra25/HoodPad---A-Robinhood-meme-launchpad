import type { ReactNode } from "react";

type Tone = "neutral" | "warn" | "error" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "border-line bg-panel-2 text-muted",
  warn: "border-warn/26 bg-warn/11 text-[#ffd699]",
  error: "border-sell/30 bg-sell/12 text-[#ffb8bd]",
  accent: "border-accent/30 bg-accent/10 text-accent-hot",
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
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-[11px] text-[13px] leading-normal ${TONES[tone]}`}
      role={tone === "error" ? "alert" : undefined}
    >
      <span aria-hidden="true" className="leading-[1.45] font-bold">
        {icon ?? ICONS[tone]}
      </span>
      <div>{children}</div>
    </div>
  );
}
