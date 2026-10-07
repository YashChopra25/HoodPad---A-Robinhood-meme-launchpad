import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Pixelify_Sans } from "next/font/google";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import StatusBar from "@/components/StatusBar";
import { THEME_SCRIPT } from "@/lib/theme";
import { ToastProvider } from "@/components/ui/Toast";
import { WalletProvider } from "@/components/WalletProvider";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { SITE_NAME } from "@/lib/env";
import "./globals.css";

// Exposed as CSS variables; globals.css maps them onto font-sans, font-mono and `pixel`.
const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });
const pixel = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixelify", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — launch a memecoin on ${ACTIVE_CHAIN.name}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: `Create, trade and graduate memecoins on ${ACTIVE_CHAIN.name}. Non-custodial, no code, bonding-curve launches with liquidity that cannot be pulled.`,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme script sets data-theme before paint, so the server markup differs.
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${pixel.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <WalletProvider>
          <ToastProvider>
            <div className="flex min-h-dvh flex-col pb-9">
              <Nav />
              {children}
              <Footer />
            </div>
            <StatusBar />
          </ToastProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
