type Tone = "up" | "down" | "flat";

const TONES: Record<Tone, string> = {
  up: "bg-up/12 text-up",
  down: "bg-sell/12 text-sell",
  flat: "bg-white/7 text-muted",
};

const BASE =
  "inline-flex items-center gap-[3px] rounded-md px-[7px] py-0.5 font-mono text-xs font-semibold tabular-nums";

/** Signed percentage pill: ▲ green for gains, ▼ red for losses. */
export default function Change({ value }: { value: number | null }) {
  if (value === null) return <span className={`${BASE} ${TONES.flat}`}>—</span>;

  const tone: Tone = value > 0.0005 ? "up" : value < -0.0005 ? "down" : "flat";
  const arrow = tone === "up" ? "▲" : tone === "down" ? "▼" : "";

  return (
    <span className={`${BASE} ${TONES[tone]}`}>
      {arrow} {Math.abs(value * 100).toFixed(1)}%
    </span>
  );
}
