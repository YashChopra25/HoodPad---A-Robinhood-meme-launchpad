/**
 * Three large colour fields drifting slowly behind the page. Soft radial
 * gradients rather than blur filters, so moving them stays cheap.
 */
export default function Aurora() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute -top-[25%] left-[5%] size-[62vmax] animate-aurora rounded-full bg-[radial-gradient(closest-side,rgb(200_240_49/0.11),transparent)]" />
      <div className="absolute top-[25%] -right-[20%] size-[58vmax] animate-aurora-slow rounded-full bg-[radial-gradient(closest-side,rgb(124_92_255/0.12),transparent)]" />
      <div className="absolute -bottom-[30%] -left-[15%] size-[52vmax] animate-aurora rounded-full bg-[radial-gradient(closest-side,rgb(46_229_157/0.09),transparent)] [animation-delay:-8s]" />
    </div>
  );
}
