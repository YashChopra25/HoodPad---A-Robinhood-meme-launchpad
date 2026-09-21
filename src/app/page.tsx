import Link from "next/link";
import FeaturedCoins from "@/components/FeaturedCoins";
import LiveTerminal from "@/components/LiveTerminal";
import Reveal from "@/components/fx/Reveal";
import BlockStream from "@/components/landing/BlockStream";
import GridFloor from "@/components/landing/GridFloor";
import Notice from "@/components/ui/Notice";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { HAS_FACTORY, NATIVE_SYMBOL } from "@/lib/env";

const SPECS = [
  { label: "Network", value: ACTIVE_CHAIN.name },
  { label: "Chain ID", value: String(ACTIVE_CHAIN.id) },
  { label: "Stack", value: "Arbitrum Orbit L2" },
  { label: "Gas", value: NATIVE_SYMBOL },
  { label: "Graduates to", value: "Uniswap V2" },
];

const STEPS = [
  {
    tag: "T+0",
    title: "Create",
    body: "Name it, add a picture, choose your guards. One signature deploys the token and its market.",
  },
  {
    tag: "T+1 block",
    title: "Trade on the curve",
    body: "Buyable and sellable from the first block. Every buy moves the price up the bonding curve.",
  },
  {
    tag: "Curve full",
    title: "Graduate",
    body: "The raise seeds a Uniswap V2 pool and the LP tokens are burned forever.",
  },
];

// Stroke paths on a 24px grid, drawn by FeatureIcon.
const ICONS = {
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  chart: "M3 17l6-6 4 4 8-8M15 7h6v6",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
} as const;

const FEATURES: Array<{ icon: keyof typeof ICONS; title: string; body: string; span: string }> = [
  {
    icon: "bolt",
    title: "One-transaction launch",
    body: `Your ERC-20 deploys straight from the browser to ${ACTIVE_CHAIN.name} — no Solidity, no build step, no back end.`,
    span: "lg:col-span-3",
  },
  {
    icon: "chart",
    title: "Tradable immediately",
    body: "A virtual reserve prices every curve from block one. No waiting for someone to seed a pool, and no empty order book.",
    span: "lg:col-span-3",
  },
  {
    icon: "lock",
    title: "Unruggable liquidity",
    body: "At graduation the contract adds the whole raise as liquidity and burns the LP tokens. Nobody can pull it — not even the creator.",
    span: "lg:col-span-2",
  },
  {
    icon: "shield",
    title: "Anti-bot and anti-whale",
    body: "Optional guards throttle snipers and cap oversized wallets, and can never block a holder from selling.",
    span: "lg:col-span-2",
  },
  {
    icon: "eye",
    title: "Nothing hidden",
    body: "Creator allocation, every tax, and whether ownership is still live are printed on each coin's page before you buy.",
    span: "lg:col-span-2",
  },
];

const FAQ = [
  {
    q: "What is this?",
    a: `A non-custodial, no-code launchpad for memecoins on ${ACTIVE_CHAIN.name} — a public Arbitrum Orbit network (chain ID ${ACTIVE_CHAIN.id}) that uses ${NATIVE_SYMBOL} for gas. Connect an EVM wallet, configure your token, sign, and it deploys from your browser.`,
  },
  {
    q: "How does the bonding curve work?",
    a: "Most of the supply sits on a constant-product curve with a virtual reserve, so there is a price from the very first block. Each buy moves the price up along the curve, each sell moves it back down, and a small fee is taken on both. When the curve has taken in its target, it closes and seeds a pool automatically.",
  },
  {
    q: "What happens when a coin graduates?",
    a: "The contract stops trading on the curve and calls a Uniswap V2 router itself: every token still on the curve and the entire raise go in as liquidity, and the LP tokens are sent to a burn address. Holders keep everything they bought.",
  },
  {
    q: "Can a creator rug the pool?",
    a: "Not the graduated pool — those LP tokens are burned by the contract at graduation, so nobody holds them. What a creator can hold is their own allocation, which is why the share they kept is shown on every coin's page.",
  },
  {
    q: "What are the fees?",
    a: "A flat platform fee per launch, plus small add-ons for anti-bot, anti-whale and a custom tax. Curve trades pay a small percentage fee, and the token carries a platform transfer tax. The exact figures are read off the launchpad contract and shown on the create page before you sign.",
  },
  {
    q: "Do I need to renounce ownership?",
    a: "It is optional but recommended. Supply is fixed and there is no mint function whatever you choose, so renouncing only drops the owner's ability to edit the coin's details and its exemption list. Once renounced, that is permanent.",
  },
];

const SECTION_TITLE = "mt-3 text-[clamp(24px,3.4vw,38px)] leading-[1.05] tracking-[-0.045em]";

// A repeating lime→green gradient twice the element's width, slid by `animate-sheen`.
const SHEEN =
  "bg-[linear-gradient(90deg,var(--color-accent),var(--color-up),var(--color-accent),var(--color-up),var(--color-accent))] bg-size-[200%_auto]";

function FeatureIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <span
      className="mb-4 grid size-10 place-items-center rounded-[10px] border border-accent/30 bg-accent/8 text-accent shadow-[0_0_20px_-6px_var(--color-accent)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={ICONS[name]} />
      </svg>
    </span>
  );
}

export default function LandingPage() {
  return (
    <main className="page flex-1 pt-6 pb-20 max-sm:pt-4">
      {/* Hero: the headline over a neon horizon, with the chain landing live beneath it. */}
      <section className="relative isolate overflow-hidden rounded-[28px] border border-line bg-[radial-gradient(900px_420px_at_50%_-10%,rgb(200_240_49/0.08),transparent_70%)] max-sm:rounded-[20px]">
        <GridFloor className="h-[250px] max-sm:h-[165px]" />
        <div className="relative z-1 mx-auto flex max-w-[900px] flex-col items-center px-6 pt-20 pb-[290px] text-center max-sm:px-4 max-sm:pt-12 max-sm:pb-[200px]">
          <span className="eyebrow animate-reveal bg-panel/70 backdrop-blur-sm">
            <span className="live-dot" /> Live on {ACTIVE_CHAIN.name}
          </span>
          <h1 className="mt-6 animate-reveal text-[clamp(40px,7.6vw,96px)] leading-[0.95] font-bold tracking-[-0.06em] [animation-delay:80ms]">
            The launchpad for
            <br />
            <em className={`animate-sheen bg-clip-text text-transparent not-italic ${SHEEN}`}>
              Robinhood Chain.
            </em>
          </h1>
          <p className="mt-6 max-w-[580px] animate-reveal text-[17px] leading-[1.55] text-muted [animation-delay:160ms] max-sm:text-[15px]">
            Launch a coin in one signature. It trades on a bonding curve from the first block and
            graduates into a Uniswap V2 pool with burned liquidity. No code, no custody, no waiting.
          </p>
          <div className="mt-8 flex animate-reveal flex-wrap justify-center gap-2.5 [animation-delay:240ms]">
            <Link href="/create" className="btn btn-primary btn-lg shadow-[0_0_36px_-6px_var(--color-accent)]">
              + Launch a coin
            </Link>
            <Link href="/coins" className="btn btn-lg bg-panel/70 backdrop-blur-sm">
              Explore the board →
            </Link>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-8 z-1 animate-reveal px-6 [animation-delay:320ms] max-sm:bottom-6 max-sm:px-4">
          <BlockStream />
        </div>
      </section>

      {/* Network spec readout. */}
      {/* A 1px gap over the border colour draws hairline dividers between cells. */}
      <div className="hud mt-4">
        <div className="grid grid-cols-5 gap-px overflow-hidden rounded-[inherit] bg-line max-lg:grid-cols-3 max-sm:grid-cols-2">
          {SPECS.map((spec) => (
            <div key={spec.label} className="min-w-0 bg-panel px-5 py-4 max-sm:px-4 max-sm:last:col-span-2 lg:max-xl:px-4">
              <div className="font-mono text-[10px] tracking-[0.16em] text-dim uppercase">{spec.label}</div>
              <div className="mono mt-1 truncate text-[15px] font-semibold text-fg">{spec.value}</div>
            </div>
          ))}
        </div>
      </div>

      <Reveal className="mt-16">
        <FeaturedCoins />
      </Reveal>

      {!HAS_FACTORY ? (
        <section className="mt-8">
          <Notice tone="warn">
            <strong>Running without a factory.</strong> Coins still launch and trade, but the board
            only lists what this browser created until someone imports an address. Deploy the
            registry once with <span className="mono">npm run deploy:factory</span> and set{" "}
            <span className="mono">NEXT_PUBLIC_FACTORY_ADDRESS</span> to make every launch globally
            discoverable.
          </Notice>
        </section>
      ) : null}

      {/* Launch sequence: three nodes on a rail with a light travelling along it. */}
      <Reveal className="mt-24">
        <section>
          <span className="index-label">[01] Launch sequence</span>
          <h2 className={SECTION_TITLE}>From idea to pool in three steps</h2>
          <div className="relative mt-10">
            <div
              aria-hidden="true"
              className={`absolute top-[22px] right-[16%] left-[16%] h-px animate-sheen opacity-70 max-lg:hidden ${SHEEN}`}
            />
            <ol className="relative m-0 grid list-none gap-3 p-0 lg:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex flex-col items-center text-center max-lg:flex-row max-lg:items-start max-lg:gap-4 max-lg:text-left">
                  <span
                    className={`grid size-11 shrink-0 animate-glow-pulse place-items-center rounded-full border border-accent/50 bg-bg font-mono text-sm text-accent ${["", "[animation-delay:0.8s]", "[animation-delay:1.6s]"][index]}`}
                  >
                    0{index + 1}
                  </span>
                  <div className="hud mt-5 w-full p-5 max-lg:mt-0">
                    <span className="font-mono text-[10.5px] tracking-[0.14em] text-dim uppercase">{step.tag}</span>
                    <h3 className="mt-1.5 mb-1.5 text-[17px] tracking-[-0.02em]">{step.title}</h3>
                    <p className="text-[13.5px] leading-[1.55] text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </Reveal>

      {/* Bento: the live network readout beside what each launch contract does. */}
      <Reveal className="mt-24">
        <section>
          <span className="index-label">[02] Built for Robinhood Chain</span>
          <h2 className={SECTION_TITLE}>One contract per coin: the token, its market and its guards</h2>
          <div className="mt-8 grid gap-3 lg:grid-cols-6">
            <div className="hud flex flex-col gap-5 p-6 lg:col-span-3 lg:row-span-2 max-sm:p-4">
              <div>
                <span className="eyebrow">
                  <span className="live-dot" /> Live from the chain
                </span>
                <h3 className="mt-4 text-[22px] tracking-[-0.035em]">No server in between</h3>
                <p className="mt-2 max-w-[460px] text-[13.5px] leading-[1.55] text-muted">
                  Every number here is read straight from {ACTIVE_CHAIN.name} over RPC, and your
                  wallet signs everything. No account, and no point at which this app holds your
                  keys or funds.
                </p>
              </div>
              <div className="mt-auto">
                <LiveTerminal />
              </div>
            </div>
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className={`group relative overflow-hidden rounded-2xl border border-line bg-panel/80 p-6 transition-colors hover:border-accent/40 hover:bg-panel-2 max-sm:p-5 ${feature.span}`}
              >
                <FeatureIcon name={feature.icon} />
                <h3 className="mb-1.5 text-[16px] tracking-[-0.02em]">{feature.title}</h3>
                <p className="text-[13.5px] leading-[1.55] text-muted">{feature.body}</p>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -bottom-16 size-40 rounded-full bg-[radial-gradient(closest-side,rgb(200_240_49/0.12),transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-24">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <span className="index-label">[03] FAQ</span>
            <h2 className={SECTION_TITLE}>Frequently asked questions</h2>
            <p className="mt-3 max-w-[360px] text-muted">
              Everything about launching, trading and graduating a coin on {ACTIVE_CHAIN.name}.
            </p>
          </div>
          <div>
            {FAQ.map((entry) => (
              <details key={entry.q} className="group border-b border-line py-5 first:pt-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3.5 text-[15px] font-semibold [&::-webkit-details-marker]:hidden after:shrink-0 after:font-mono after:text-lg after:leading-none after:text-dim after:content-['+'] group-open:after:text-accent group-open:after:content-['−']">
                  {entry.q}
                </summary>
                <p className="mt-2.5 text-sm leading-[1.6] text-muted">{entry.a}</p>
              </details>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-24">
        <section className="relative isolate overflow-hidden rounded-[28px] border border-line px-7 pt-16 pb-44 text-center max-sm:rounded-[20px] max-sm:px-4 max-sm:pb-36">
          <GridFloor className="h-[150px] max-sm:h-[120px]" />
          <span className="index-label">Next block</span>
          <h2 className="mt-3 text-[clamp(30px,5vw,60px)] leading-none font-bold tracking-[-0.055em]">
            Your coin could be in it.
          </h2>
          <p className="mx-auto mt-4 mb-7 max-w-[440px] text-muted">
            Most tokens go to zero. Launch something worth holding anyway.
          </p>
          <Link href="/create" className="btn btn-primary btn-lg shadow-[0_0_36px_-6px_var(--color-accent)]">
            + Launch a coin
          </Link>
        </section>
      </Reveal>
    </main>
  );
}
