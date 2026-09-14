import { Fragment } from "react";
import Link from "next/link";
import FeaturedCoins from "@/components/FeaturedCoins";
import LiveTerminal from "@/components/LiveTerminal";
import ForgeScene from "@/components/fx/ForgeScene";
import Reveal from "@/components/fx/Reveal";
import Notice from "@/components/ui/Notice";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { HAS_FACTORY, NATIVE_SYMBOL } from "@/lib/env";

const STEPS = [
  {
    title: "Create",
    body: "Name it, add a picture, choose your guards. One signature deploys the token and its market.",
  },
  {
    title: "Trade on the curve",
    body: "Buyable and sellable from the first block. Every buy moves the price up the bonding curve.",
  },
  {
    title: "Graduate",
    body: "When the curve fills, the raise seeds a Uniswap V2 pool and the LP tokens are burned forever.",
  },
];

// The step badges and the arrows between them light up in sequence, one after
// another along a shared 2.4s cycle.
const STEP_DELAYS = ["", "[animation-delay:0.8s]", "[animation-delay:1.6s]"];
const ARROW_DELAYS = ["[animation-delay:0.4s]", "[animation-delay:1.2s]"];

const FEATURES = [
  {
    icon: "⚡",
    title: "One-transaction launch",
    body: `Your ERC-20 deploys straight from the browser to ${ACTIVE_CHAIN.name} — no Solidity, no build step, no back end.`,
  },
  {
    icon: "📈",
    title: "Tradable immediately",
    body: "A virtual reserve prices every curve from block one. No waiting for someone to seed a pool, and no empty order book.",
  },
  {
    icon: "🔒",
    title: "Unruggable liquidity",
    body: "At graduation the contract adds the whole raise as liquidity and burns the LP tokens. Nobody can pull it — not even the creator.",
  },
  {
    icon: "🛡️",
    title: "Anti-bot and anti-whale",
    body: "Optional guards throttle snipers and cap oversized wallets, and are written so they can never block a holder from selling.",
  },
  {
    icon: "🔍",
    title: "Nothing hidden",
    body: "Creator allocation, every tax, and whether ownership is still live are printed on each coin's page before you buy.",
  },
  {
    icon: "🔑",
    title: "Non-custodial",
    body: "Your wallet signs everything. No server, no account, and no point at which this app holds your keys or funds.",
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

const SECTION_TITLE = "mt-3 text-[clamp(22px,3vw,30px)] tracking-[-0.04em]";

// A repeating lime→green gradient twice the element's width, slid by `animate-sheen`.
const SHEEN =
  "bg-[linear-gradient(90deg,var(--color-accent),var(--color-up),var(--color-accent),var(--color-up),var(--color-accent))] bg-size-[200%_auto]";

export default function LandingPage() {
  return (
    <main className="page flex-1 pt-7 pb-20 max-sm:pt-5">
      <section className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-center gap-8 pt-12 pb-10 max-lg:grid-cols-1 max-sm:pt-[34px] max-sm:pb-[26px]">
        <div>
          <span className="eyebrow animate-reveal">
            <span className="live-dot" /> {ACTIVE_CHAIN.name} · {NATIVE_SYMBOL} gas
          </span>
          <h1 className="mt-[18px] animate-reveal text-[clamp(38px,6.4vw,76px)] leading-[0.98] font-bold tracking-[-0.055em] [animation-delay:80ms]">
            Launch it.
            <br />
            Trade it.
            <br />
            <em className={`animate-sheen bg-clip-text text-transparent not-italic ${SHEEN}`}>
              Graduate it.
            </em>
          </h1>
          <p className="mt-5 max-w-[520px] animate-reveal text-[16.5px] leading-[1.55] text-muted [animation-delay:160ms]">
            Memecoins with a bonding curve that trades from the first block and graduates into a
            Uniswap V2 pool with burned liquidity. No code, no custody, no waiting.
          </p>
          <div className="mt-7 flex animate-reveal flex-wrap gap-2.5 [animation-delay:240ms]">
            <Link href="/create" className="btn btn-primary btn-lg">
              + Launch a coin
            </Link>
            <Link href="/coins" className="btn btn-lg">
              Explore the board →
            </Link>
          </div>
        </div>

        <div className="animate-reveal [animation-delay:200ms]">
          <ForgeScene />
        </div>
      </section>

      <Reveal>
        <FeaturedCoins />
      </Reveal>

      <Reveal className="mt-16">
        <section className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-8 max-lg:grid-cols-1">
          <div>
            <span className="eyebrow">
              <span className="live-dot" /> Live from the chain
            </span>
            <h2 className={SECTION_TITLE}>No server in between</h2>
            <p className="mt-3 max-w-[460px] text-muted">
              Every number on this site is read straight from {ACTIVE_CHAIN.name} over RPC — the
              launch factory, the fees and the block you are looking at, updated as it lands.
            </p>
          </div>
          <LiveTerminal />
        </section>
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

      <Reveal className="mt-16">
        <section>
          <div className="mb-[18px]">
            <span className="eyebrow">How it works</span>
            <h2 className={SECTION_TITLE}>From idea to pool in three steps</h2>
          </div>
          <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {STEPS.map((step, index) => (
              <Fragment key={step.title}>
                {index > 0 ? (
                  <div className="grid place-items-center max-lg:hidden" aria-hidden="true">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      className={`animate-arrow-flow text-dim ${ARROW_DELAYS[index - 1]}`}
                    >
                      <path
                        d="m9 6 6 6-6 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                ) : null}
                <div className="rounded-xl border border-line bg-panel/90 p-[18px] backdrop-blur-sm">
                  <span
                    className={`mb-[18px] grid size-11 animate-glow-pulse place-items-center rounded-full border border-accent/40 bg-accent/5 font-mono text-sm text-accent ${STEP_DELAYS[index]}`}
                  >
                    0{index + 1}
                  </span>
                  <h3 className="mb-[5px] text-[15px]">{step.title}</h3>
                  <p className="text-[13px] text-muted">{step.body}</p>
                </div>
              </Fragment>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-16">
        <section>
          <div className="mb-[18px]">
            <span className="eyebrow">Built onchain</span>
            <h2 className={SECTION_TITLE}>One contract per coin: the token, its market and its guards</h2>
          </div>
          {/* A 1px gap over the border colour draws hairline dividers between cells. */}
          <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="group bg-panel p-[22px] transition-colors hover:bg-panel-2">
                <span
                  className="mb-3.5 grid size-[34px] place-items-center rounded-[9px] border border-line-strong bg-panel-2 text-base transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110"
                  aria-hidden="true"
                >
                  {feature.icon}
                </span>
                <h3 className="mb-1.5 text-[15px] tracking-[-0.02em]">{feature.title}</h3>
                <p className="text-[13.5px] leading-[1.55] text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-16">
        <section>
          <div className="mb-[18px]">
            <span className="eyebrow">FAQ</span>
            <h2 className={SECTION_TITLE}>Frequently asked questions</h2>
          </div>
          {FAQ.map((entry) => (
            <details key={entry.q} className="group border-b border-line py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3.5 font-semibold [&::-webkit-details-marker]:hidden after:shrink-0 after:font-mono after:text-lg after:leading-none after:text-dim after:content-['+'] group-open:after:text-accent group-open:after:content-['−']">
                {entry.q}
              </summary>
              <p className="mt-2.5 text-sm leading-[1.6] text-muted">{entry.a}</p>
            </details>
          ))}
        </section>
      </Reveal>

      <Reveal className="mt-16">
        <section>
          {/* A 1px frame whose highlight travels around the card. */}
          <div className="animate-sheen rounded-[19px] bg-[linear-gradient(120deg,var(--color-line)_0%,var(--color-line)_35%,var(--color-accent)_50%,var(--color-line)_65%,var(--color-line)_100%)] bg-size-[200%_200%] p-px">
            <div className="relative overflow-hidden rounded-[18px] bg-panel bg-[radial-gradient(500px_200px_at_50%_120%,rgb(200_240_49/0.14),transparent_70%)] px-7 py-10 text-center">
              <h2 className="text-[clamp(24px,3.4vw,36px)] tracking-[-0.05em]">Ready when you are</h2>
              <p className="mx-auto mt-2.5 mb-[22px] max-w-[440px] text-muted">
                Most tokens go to zero. Launch something worth holding anyway.
              </p>
              <Link href="/create" className="btn btn-primary btn-lg">
                + Launch a coin
              </Link>
            </div>
          </div>
        </section>
      </Reveal>
    </main>
  );
}
