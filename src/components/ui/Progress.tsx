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
        className="h-full rounded-full bg-linear-to-r from-[#6f8f12] to-accent shadow-[0_0_12px_rgb(200_240_49/0.35)] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] data-[complete=true]:from-up data-[complete=true]:to-[#8bffd0] data-[complete=true]:shadow-[0_0_12px_rgb(46_229_157/0.35)]"
        data-complete={percent >= 100 ? "true" : "false"}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
