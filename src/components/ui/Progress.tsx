export default function Progress({ value, label }: { value: number; label?: string }) {
  const percent = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-panel-3"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
    >
      {/* Width is the live value, so it is the one style computed at runtime. */}
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-fg)_0_calc(100%-6px),var(--color-lime)_calc(100%-6px))] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] data-[complete=true]:bg-up"
        data-complete={percent >= 100 ? "true" : "false"}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
