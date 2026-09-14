/**
 * The launch forge: a hammer strikes the anvil and a coin is struck out of the
 * sparks, on a loop. Plain SVG driven by CSS keyframes — every part shares one
 * 1.8s cycle (see the forge animations in globals.css), so no JavaScript runs.
 *
 * Coordinates are in the 400×320 viewBox; the strike point is (215, 190).
 */

// Flight path and stagger for each spark, spelled out so Tailwind can see them.
const SPARKS = [
  "[--dx:-88px] [--dy:-58px]",
  "[--dx:-64px] [--dy:-94px] [animation-delay:15ms]",
  "[--dx:-28px] [--dy:-112px] [animation-delay:30ms]",
  "[--dx:14px] [--dy:-104px]",
  "[--dx:50px] [--dy:-90px] [animation-delay:20ms]",
  "[--dx:84px] [--dy:-60px] [animation-delay:10ms]",
  "[--dx:106px] [--dy:-22px] [animation-delay:35ms]",
  "[--dx:-110px] [--dy:-18px] [animation-delay:25ms]",
  "[--dx:-44px] [--dy:-42px] [animation-delay:45ms]",
  "[--dx:60px] [--dy:-34px] [animation-delay:40ms]",
];

const EMBERS = [
  "left-[20%] top-[58%]",
  "left-[72%] top-[38%] [animation-delay:-2s]",
  "left-[42%] top-[18%] [animation-delay:-4s]",
  "left-[86%] top-[68%] [animation-delay:-1s]",
  "left-[10%] top-[30%] [animation-delay:-3s]",
  "left-[60%] top-[8%] [animation-delay:-5s]",
];

export default function ForgeScene() {
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-[520px]" aria-hidden="true">
      {/* Heat haze behind the anvil. */}
      <div className="absolute inset-x-[8%] top-[28%] bottom-[4%] animate-aurora rounded-full bg-[radial-gradient(closest-side,rgb(200_240_49/0.2),transparent)]" />

      {EMBERS.map((position) => (
        <span
          key={position}
          className={`absolute size-1 animate-float rounded-full bg-accent/70 shadow-[0_0_8px_rgb(200_240_49/0.8)] ${position}`}
        />
      ))}

      <svg viewBox="0 0 400 320" className="relative size-full overflow-visible">
        <defs>
          <linearGradient id="forge-steel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a5158" />
            <stop offset="100%" stopColor="#15181b" />
          </linearGradient>
          <linearGradient id="forge-anvil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2c3136" />
            <stop offset="100%" stopColor="#0c0e10" />
          </linearGradient>
          <linearGradient id="forge-handle" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7a5634" />
            <stop offset="100%" stopColor="#3b2614" />
          </linearGradient>
          <radialGradient id="forge-flash">
            <stop offset="0%" stopColor="#d9ff5c" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#c8f031" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="215" cy="190" r="96" fill="url(#forge-flash)" className="animate-flash" />

        <ellipse
          cx="215"
          cy="190"
          rx="46"
          ry="9"
          fill="none"
          stroke="#c8f031"
          strokeWidth="2"
          className="origin-center animate-shock [transform-box:fill-box]"
        />

        <g className="animate-anvil">
          <path
            d="M84 190 C110 184 132 186 150 190 H306 V214 H268 C258 222 254 232 256 244 L280 262 H120 L144 244 C146 232 142 222 132 214 H112 C100 206 90 198 84 190 Z"
            fill="url(#forge-anvil)"
            stroke="#2c3136"
            strokeWidth="1.5"
          />
          <path d="M150 190.5 H306" stroke="#c8f031" strokeOpacity="0.35" strokeWidth="1.5" />
          <rect x="112" y="262" width="176" height="14" rx="3" fill="#16191c" stroke="#2c3136" />
          {/* The hot blank on the anvil face, glowing on each strike. */}
          <ellipse cx="215" cy="187" rx="24" ry="4.5" fill="#c8f031" className="animate-flash" />
        </g>

        {/* Pivots on the grip end, so the head sweeps down in an arc. */}
        <g className="origin-[360px_166px] animate-strike">
          <rect x="206" y="160" width="162" height="12" rx="6" fill="url(#forge-handle)" />
          <rect x="330" y="157" width="34" height="18" rx="6" fill="#0f1113" stroke="#2c3136" />
          <rect x="178" y="142" width="74" height="48" rx="7" fill="url(#forge-steel)" stroke="#3a4046" />
          <rect x="186" y="148" width="58" height="4" rx="2" fill="#ffffff" fillOpacity="0.14" />
          <rect x="178" y="184" width="74" height="6" rx="3" fill="#c8f031" fillOpacity="0.5" />
        </g>

        <g className="origin-center animate-coin [transform-box:fill-box]">
          <circle cx="215" cy="150" r="17" fill="#c8f031" stroke="#0b1000" strokeWidth="2" />
          <circle cx="215" cy="150" r="11.5" fill="none" stroke="#0b1000" strokeOpacity="0.45" />
          <path d="M215 142 L223 150 L215 158 L207 150 Z" fill="#0b1000" />
        </g>

        {SPARKS.map((spark) => (
          <circle key={spark} cx="215" cy="186" r="2.4" fill="#d9ff5c" className={`animate-spark ${spark}`} />
        ))}
      </svg>
    </div>
  );
}
