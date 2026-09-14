import type { Metadata, Viewport } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import TickerTape from "@/components/TickerTape";
import { ToastProvider } from "@/components/ui/Toast";
import { WalletProvider } from "@/components/WalletProvider";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { SITE_NAME } from "@/lib/env";
import "./globals.css";

// Exposed as CSS variables; globals.css maps them onto Tailwind's font-sans/font-mono.
const sans = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — launch a memecoin on ${ACTIVE_CHAIN.name}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: `Create, trade and graduate memecoins on ${ACTIVE_CHAIN.name}. Non-custodial, no code, bonding-curve launches with liquidity that cannot be pulled.`,
};

export const viewport: Viewport = {
  themeColor: "#08090a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <WalletProvider>
          <ToastProvider>
            <div className="relative z-1 flex min-h-dvh flex-col">
              <Nav />
              <TickerTape />
              {children}
              <Footer />
            </div>
          </ToastProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
