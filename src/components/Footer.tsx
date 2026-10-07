import Link from "next/link";
import { HoodpadMark } from "@/components/Logo";
import { SITE_NAME } from "@/lib/env";

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

const LINKS = [
  { href: "/", label: "Trenches" },
  { href: "/coins", label: "Board" },
  { href: "/create", label: "Launch a coin" },
  { href: "/portfolio", label: "Portfolio" },
];

export default function Footer() {
  return (
    <footer className="mt-auto pt-16 pb-8 text-[12.5px] leading-[1.6] text-dim">
      <div className="page">
        <div className="flex flex-wrap items-start justify-between gap-6 border-t border-line pt-7">
          <div className="flex max-w-[560px] gap-3.5">
            <HoodpadMark className="size-7" />
            <p>
              <strong className="font-semibold text-muted">High risk.</strong> Launching and trading
              tokens is speculative — most go to zero. Nothing here is financial advice. Not
              affiliated with Robinhood Markets, Inc. Non-custodial: every transaction is signed by
              your own wallet.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-5 gap-y-1.5" aria-label="Footer">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-muted hover:text-fg">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-3 font-mono text-[11px]">
          <span>
            © {new Date().getFullYear()} {SITE_NAME}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            Built by <span className="text-fg">{BUILDER.name}</span>
            {BUILDER_LINKS.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="text-muted underline-offset-2 hover:text-fg hover:underline">
                {link.label} ↗
              </a>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}
