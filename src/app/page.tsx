import Link from "next/link";
import FeaturedCoins from "@/components/FeaturedCoins";
import LiveTerminal from "@/components/LiveTerminal";
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

export default function LandingPage() {
  return (
    <main className="page flex-1 pt-7 pb-20 max-sm:pt-5">
      <section className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-center gap-8 pt-14 pb-10 max-lg:grid-cols-1 max-sm:pt-[34px] max-sm:pb-[26px]">
        <div>
          <span className="eyebrow">
            <span className="live-dot" /> {ACTIVE_CHAIN.name} · {NATIVE_SYMBOL} gas
          </span>
          <h1 className="mt-[18px] text-[clamp(38px,6.4vw,76px)] leading-[0.98] font-bold tracking-[-0.055em]">
            Launch it.
            <br />
            Trade it.
            <br />
            <em className="text-accent not-italic">Graduate it.</em>
          </h1>
          <p className="mt-5 max-w-[520px] text-[16.5px] leading-[1.55] text-muted">
            Memecoins with a bonding curve that trades from the first block and graduates into a
            Uniswap V2 pool with burned liquidity. No code, no custody, no waiting.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link href="/create" className="btn btn-primary btn-lg">
              + Launch a coin
            </Link>
            <Link href="/coins" className="btn btn-lg">
              Explore the board →
            </Link>
          </div>
        </div>

        <LiveTerminal />
      </section>

      <FeaturedCoins />

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

      <section className="mt-16">
        <div className="mb-[18px]">
          <span className="eyebrow">How it works</span>
          <h2 className={SECTION_TITLE}>From idea to pool in three steps</h2>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          {STEPS.map((step, index) => (
            <div key={step.title} className="rounded-xl border border-line bg-panel p-[18px]">
              <span className="mb-[18px] block font-mono text-xs text-accent">0{index + 1}</span>
              <h3 className="mb-[5px] text-[15px]">{step.title}</h3>
              <p className="text-[13px] text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <div className="mb-[18px]">
          <span className="eyebrow">Built onchain</span>
          <h2 className={SECTION_TITLE}>One contract per coin: the token, its market and its guards</h2>
        </div>
        {/* A 1px gap over the border colour draws hairline dividers between cells. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-px overflow-hidden rounded-xl border border-line bg-line">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="bg-panel p-[22px]">
              <span
                className="mb-3.5 grid size-[34px] place-items-center rounded-[9px] border border-line-strong bg-panel-2 text-base"
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

      <section className="mt-16">
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

      <section className="mt-16">
        <div className="relative overflow-hidden rounded-[18px] border border-line bg-panel bg-[radial-gradient(500px_200px_at_50%_120%,rgb(200_240_49/0.14),transparent_70%)] px-7 py-10 text-center">
          <h2 className="text-[clamp(24px,3.4vw,36px)] tracking-[-0.05em]">Ready when you are</h2>
          <p className="mx-auto mt-2.5 mb-[22px] max-w-[440px] text-muted">
            Most tokens go to zero. Launch something worth holding anyway.
          </p>
          <Link href="/create" className="btn btn-primary btn-lg">
            + Launch a coin
          </Link>
        </div>
      </section>
    </main>
  );
}
