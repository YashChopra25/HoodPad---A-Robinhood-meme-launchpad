import Link from "next/link";
import { ACTIVE_CHAIN, explorerAddressUrl } from "@/lib/chains";
import { FACTORY_ADDRESS, SITE_NAME } from "@/lib/env";
import { shortenAddress } from "@/lib/format";

const HEADING = "mb-2.5 font-mono text-[10.5px] font-medium tracking-[0.12em] text-muted uppercase";
const LIST = "m-0 grid list-none gap-1.5 p-0 [&_a:hover]:text-fg";

/** Builder credit. Links with an empty value are left out. */
const BUILDER = {
  name: "Yash Chopra",
  twitter: "YashChopra25",
  github: "https://github.com/YashChopra25",
  portfolio: "https://yashchopraportfolio.vercel.app/",
};

const BUILDER_LINKS = [
  { label: "X", href: BUILDER.twitter ? `https://x.com/${BUILDER.twitter}` : "" },
  { label: "GitHub", href: BUILDER.github },
  { label: "Portfolio", href: BUILDER.portfolio },
].filter((link) => link.href);

export default function Footer() {
  const explorer = ACTIVE_CHAIN.blockExplorers?.default;

  return (
    <footer className="border-t border-line bg-elevated pt-[30px] pb-[38px] text-[12.5px] leading-[1.6] text-dim">
      <div className="page">
        <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.6fr))] gap-7 max-lg:grid-cols-2">
          <div className="flex flex-col gap-2.5 max-lg:col-span-full">
            <div className="flex items-center gap-[9px] text-base font-bold tracking-[-0.035em] text-fg">
              <span
                className="grid size-7 place-items-center rounded-lg bg-accent text-sm text-accent-ink shadow-[0_0_22px_rgb(200_240_49/0.28)]"
                aria-hidden="true"
              >
                ◆
              </span>
              {SITE_NAME}
            </div>
            <p className="max-w-[520px]">
              <strong className="text-muted">High risk.</strong> Launching and
              trading tokens is speculative — most go to zero. Nothing here is
              financial advice.
            </p>
            <p className="max-w-[520px]">
              Not affiliated with Robinhood Markets, Inc. &ldquo;Robinhood
              Chain&rdquo; refers to the public Arbitrum Orbit network.
              Non-custodial: every transaction is signed by your own wallet and
              no funds are ever held here.
            </p>
          </div>

          <div>
            <h4 className={HEADING}>Launchpad</h4>
            <ul className={LIST}>
              <li>
                <Link href="/coins">Board</Link>
              </li>
              <li>
                <Link href="/create">Launch a coin</Link>
              </li>
              <li>
                <Link href="/portfolio">Portfolio</Link>
              </li>
              <li>
                <Link href="/liquidity">Liquidity</Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className={HEADING}>Onchain</h4>
            <ul className={LIST}>
              {explorer ? (
                <li>
                  <a href={explorer.url} target="_blank" rel="noreferrer">
                    {explorer.name} ↗
                  </a>
                </li>
              ) : null}
              {FACTORY_ADDRESS ? (
                <li>
                  <a
                    href={explorerAddressUrl(FACTORY_ADDRESS)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Factory{" "}
                    <span className="mono">
                      {shortenAddress(FACTORY_ADDRESS)}
                    </span>{" "}
                    ↗
                  </a>
                </li>
              ) : null}
              <li className="mono">Chain ID {ACTIVE_CHAIN.id}</li>
            </ul>
          </div>
        </div>

        <div className="mt-[26px] flex flex-wrap justify-between gap-3 border-t border-line pt-4 font-mono text-[11px]">
          <span>
            © {new Date().getFullYear()} {SITE_NAME}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            Built by <span className="text-fg">{BUILDER.name}</span>
            {BUILDER_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:text-accent-hot"
              >
                {link.label} ↗
              </a>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}
