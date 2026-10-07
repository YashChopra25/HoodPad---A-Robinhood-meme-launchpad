"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HoodpadMark, HoodpadWordmark } from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import WalletButton from "@/components/WalletButton";
import { ACTIVE_CHAIN, IS_TESTNET } from "@/lib/chains";
import { SITE_NAME } from "@/lib/env";

const LINKS = [
  { href: "/", label: "Trenches" },
  { href: "/coins", label: "Board" },
  { href: "/create", label: "Create" },
  { href: "/portfolio", label: "Portfolio" },
  // { href: "/liquidity", label: "Liquidity" },
];

function isCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  // "/" or ⌘K jumps to search from anywhere, like a trading terminal.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable=true]");
      const slash = event.key === "/" && !typing;
      const cmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (slash || cmdK) {
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
    <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-md">
      <nav className="page grid h-[76px] grid-cols-[1fr_auto_1fr] items-center gap-4 max-lg:flex max-sm:h-auto max-sm:flex-wrap max-sm:gap-x-2 max-sm:gap-y-3 max-sm:py-3" aria-label="Main">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 justify-self-start" aria-label={`${SITE_NAME} home`}>
          <HoodpadMark className="size-9 max-sm:size-8" />
          <HoodpadWordmark className="block h-[17px] w-auto max-sm:hidden" />
        </Link>

        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] min-w-0 max-lg:flex-1 max-lg:justify-center max-sm:order-last max-sm:w-full max-sm:flex-none max-sm:justify-start [&::-webkit-scrollbar]:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl bg-panel px-4 py-2.5 text-[13.5px] font-semibold whitespace-nowrap text-fg transition-colors hover:bg-panel-2 max-sm:px-3 max-sm:py-2 max-sm:text-[13px] dark:border dark:border-line aria-[current=page]:bg-accent aria-[current=page]:text-accent-ink dark:aria-[current=page]:border-accent"
              aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center justify-end gap-2 justify-self-end">
          <form className="relative hidden w-[240px] items-center min-[1180px]:flex" role="search" onSubmit={search}>
            <svg
              className="pointer-events-none absolute left-3 text-dim"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              className="input border-transparent bg-panel py-2.5 pr-9 pl-9 text-[13px] dark:border-line dark:bg-panel"
              placeholder="Name / ticker / address"
              aria-label="Search coins"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="kbd pointer-events-none absolute right-2.5" aria-hidden="true">
              /
            </span>
          </form>

          {IS_TESTNET ? (
            <span className="chip chip-warn px-2 py-1 max-md:hidden" title={`Connected to ${ACTIVE_CHAIN.name}`}>
              Testnet
            </span>
          ) : null}

          <ThemeToggle className="max-sm:hidden" />
          <WalletButton />
        </div>
      </nav>
    </header>
  );
}
