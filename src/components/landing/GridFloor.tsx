/**
 * A neon floor grid receding to a glowing horizon, scrolling toward the viewer.
 * Pure CSS: one tilted plane, a horizon line and a beam that sweeps along it.
 * Sits along the bottom of its positioned parent; `className` sets its height.
 */
export default function GridFloor({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden perspective-[400px] perspective-origin-top ${className}`}
    >
      <div className="absolute -inset-x-1/2 top-0 h-full origin-top rotate-x-[62deg] animate-grid-flow bg-[linear-gradient(rgb(200_240_49/0.32)_1px,transparent_1px),linear-gradient(90deg,rgb(200_240_49/0.32)_1px,transparent_1px)] bg-size-[56px_56px] mask-[linear-gradient(to_bottom,transparent,#000_26%)]" />
      <div className="absolute inset-x-[8%] -top-20 h-40 rounded-[50%] bg-[radial-gradient(closest-side,rgb(200_240_49/0.3),transparent)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--color-accent)_50%,transparent)] opacity-60" />
      <div className="absolute top-[-1px] left-1/4 h-[3px] w-1/2 animate-beam rounded-full bg-[linear-gradient(90deg,transparent,var(--color-accent-hot),transparent)] blur-[1px]" />
    </div>
  );
}
