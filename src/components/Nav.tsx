"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HoodpadMark } from "@/components/Logo";
import WalletButton from "@/components/WalletButton";
import { ACTIVE_CHAIN, IS_TESTNET } from "@/lib/chains";
import { SITE_NAME } from "@/lib/env";

const LINKS = [
  { href: "/coins", label: "Board" },
  { href: "/create", label: "Create" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/liquidity", label: "Liquidity" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  // ⌘K / Ctrl+K jumps to search from anywhere, like a trading terminal.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function search(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/coins?q=${encodeURIComponent(trimmed)}` : "/coins");
    inputRef.current?.blur();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-lg backdrop-saturate-150">
      <nav className="page flex h-[60px] items-center gap-[18px] max-sm:gap-2" aria-label="Main">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${SITE_NAME} home`}>
          <HoodpadMark className="size-8" />
          <span className="max-sm:hidden">
            <span className="block text-[17px] leading-none font-bold tracking-[-0.04em]">
              {SITE_NAME}
            </span>
            <small className="mt-1 block font-mono text-[9.5px] leading-none font-medium tracking-[0.14em] text-dim uppercase">
              Robinhood Launchpad
            </small>
          </span>
        </Link>

        <div className="flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative rounded-lg px-[11px] py-[7px] text-[13.5px] font-semibold whitespace-nowrap text-muted transition-colors hover:bg-white/5 hover:text-fg max-sm:px-2 aria-[current=page]:text-fg aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-[11px] aria-[current=page]:after:-bottom-[13px] aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-sm aria-[current=page]:after:bg-accent aria-[current=page]:after:content-[''] max-sm:aria-[current=page]:after:inset-x-2"
              aria-current={
                pathname === link.href || pathname.startsWith(`${link.href}/`) ? "page" : undefined
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex-1" />

        <form
          className="relative hidden w-[280px] max-w-full items-center min-[1080px]:flex"
          role="search"
          onSubmit={search}
        >
          <svg
            className="pointer-events-none absolute left-[11px] text-dim"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="input bg-panel py-2 pr-11 pl-[33px] text-[13px]"
            placeholder="Search coins or paste a contract"
            aria-label="Search coins"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span
            className="pointer-events-none absolute right-2 rounded-[5px] border border-line-strong px-1.5 py-px font-mono text-[10.5px] text-dim"
            aria-hidden="true"
          >
            ⌘K
          </span>
        </form>

        {IS_TESTNET ? (
          <span className="chip chip-warn max-sm:hidden" title={`Connected to ${ACTIVE_CHAIN.name}`}>
            Testnet
          </span>
        ) : null}

        <Link href="/create" className="btn btn-primary max-sm:hidden">
          + Launch
        </Link>

        <WalletButton />
      </nav>
    </header>
  );
}
