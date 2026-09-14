/**
 * Hoodpad's mark: a pointed hood whose peak doubles as a launch arrow, resting
 * on a pad and cut out of the neon tile. Inline SVG so it is crisp at any size
 * and costs no request; src/app/icon.svg is the same drawing for the tab icon.
 */
export function HoodpadMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={`shrink-0 drop-shadow-[0_0_14px_rgb(200_240_49/0.35)] ${className}`.trim()}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="#c8f031" />
      <path
        fill="#0b1000"
        fillRule="evenodd"
        d="M16 4.5C11.2 8.6 8 13.9 8 19.2 8 23.3 11.6 26.5 16 26.5s8-3.2 8-7.3C24 13.9 20.8 8.6 16 4.5Zm0 9.4c-2.4 1.9-3.9 4.2-3.9 6.6 0 1.9 1.7 3.3 3.9 3.3s3.9-1.4 3.9-3.3c0-2.4-1.5-4.7-3.9-6.6Z"
      />
      <rect x="9.5" y="27.8" width="13" height="1.6" rx="0.8" fill="#0b1000" />
    </svg>
  );
}
