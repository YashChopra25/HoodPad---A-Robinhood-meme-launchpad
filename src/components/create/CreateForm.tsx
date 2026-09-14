"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAddress, parseEther, parseUnits, type Address } from "viem";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Notice from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";
import { useWalletContext } from "@/components/WalletProvider";
import FeatureToggle from "@/components/create/FeatureToggle";
import FeeSummary from "@/components/create/FeeSummary";
import ImagePicker from "@/components/create/ImagePicker";
import { useEconomics } from "@/hooks/useEconomics";
import { useLaunches } from "@/hooks/useLaunches";
import { launch as launchViaFactory, quoteFee } from "@/lib/factory";
import { deployDirect, renounceOwnership } from "@/lib/token";
import { HAS_FACTORY, NATIVE_SYMBOL, TREASURY_ADDRESS, ZERO_ADDRESS } from "@/lib/env";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { USE_HARDCODED_LAUNCH_IMAGE, launchImageFor } from "@/lib/launchImage";
import { formatEth, readableError } from "@/lib/format";
import type { LaunchConfig, LaunchOptions } from "@/lib/types";

type Mode = "curve" | "fixed";

interface FormState {
  name: string;
  symbol: string;
  totalSupply: string;
  mode: Mode;
  curvePercent: string;
  image: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  antiBot: boolean;
  antiWhale: boolean;
  maxWalletPercent: string;
  customTax: boolean;
  taxPercent: string;
  taxWallet: string;
  renounce: boolean;
  openingBuy: string;
}

const INITIAL: FormState = {
  name: "",
  symbol: "",
  totalSupply: "1000000000",
  mode: "curve",
  curvePercent: "80",
  image: "",
  description: "",
  website: "",
  twitter: "",
  telegram: "",
  antiBot: false,
  antiWhale: false,
  maxWalletPercent: "2",
  customTax: false,
  taxPercent: "3",
  taxWallet: "",
  renounce: true,
  openingBuy: "",
};

const TWO_COLUMNS = "grid grid-cols-2 gap-3.5 max-sm:grid-cols-1";

export default function CreateForm() {
  const router = useRouter();
  const wallet = useWalletContext();
  const toast = useToast();
  const { economics } = useEconomics();
  const { register } = useLaunches();

  const [form, setForm] = useState<FormState>(INITIAL);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const options: LaunchOptions = {
    antiBot: form.antiBot,
    antiWhale: form.antiWhale,
    customTax: form.customTax,
  };

  const errors = validate(form);
  const hasErrors = Object.keys(errors).length > 0;

  // Direct deploys never touch the factory, so there is no fee to collect.
  const fee = HAS_FACTORY ? quoteFee(economics, options) : 0n;
  const openingBuyWei = openingBuyOf(form);

  const total = fee + openingBuyWei;
  const shortOnFunds = wallet.balance !== null && wallet.balance < total;

  async function submit() {
    setSubmitted(true);
    if (hasErrors || !wallet.account) return;

    setBusy(true);
    try {
      const config = toConfig(form, wallet.account);

      setStep(HAS_FACTORY ? "Launching…" : "Deploying contract…");
      const { address, hash } = HAS_FACTORY
        ? await launchViaFactory({
            provider: wallet.provider,
            account: wallet.account,
            config,
            fee,
            openingBuyWei,
          })
        : await deployDirect({ provider: wallet.provider, account: wallet.account }, config, {
            creator: wallet.account,
            treasury: TREASURY_ADDRESS ?? wallet.account,
            router: economics.defaultRouter ?? ZERO_ADDRESS,
            virtualEth: economics.virtualEth,
            graduationTarget: economics.graduationTarget,
            tradeFeeBps: economics.tradeFeeBps,
            platformTaxBps: economics.platformTaxBps,
          });

      register({ address, name: form.name.trim(), symbol: symbolOf(form), hash });
      toast.success(`${form.name.trim()} is live.`, hash);

      // Renouncing is a second signature, and failing it must not lose the
      // launch — the coin exists either way and the page says so.
      if (form.renounce) {
        setStep("Renouncing ownership…");
        try {
          await renounceOwnership({ provider: wallet.provider, account: wallet.account }, address);
          toast.success("Ownership renounced.");
        } catch (err) {
          toast.error(`Launched, but renouncing failed: ${readableError(err)}`);
        }
      }

      router.push(`/coin/${address}`);
    } catch (err) {
      toast.error(readableError(err));
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  const show = (key: keyof FormState) => (submitted ? errors[key] : undefined);

  return (
    <div className="flex flex-col gap-[22px]">
      {!HAS_FACTORY ? (
        <Notice tone="warn">
          No launchpad factory is configured for {ACTIVE_CHAIN.name}, so this coin deploys straight
          from your wallet: no platform fee, but it will only appear on the board in this browser
          until someone imports its address. Deploy a factory with{" "}
          <span className="mono">npm run deploy:factory</span> to make launches globally
          discoverable.
        </Notice>
      ) : null}

      <section className="card flex flex-col gap-[18px] p-6">
        <div className="card-title">Identity</div>

        <ImagePicker value={form.image} onChange={(value) => set("image", value)} />
        {USE_HARDCODED_LAUNCH_IMAGE ? (
          <Notice>
            Launches currently store the platform&rsquo;s default image, not the photo picked here.
            If you keep ownership, you can set your own image later from Creator tools.
          </Notice>
        ) : null}

        <div className={TWO_COLUMNS}>
          <Field label="Name" htmlFor="name" error={show("name")}>
            <input
              id="name"
              className={`input ${show("name") ? "input-invalid" : ""}`.trim()}
              placeholder="Robin Doge"
              maxLength={64}
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
            />
          </Field>

          <Field label="Symbol" htmlFor="symbol" error={show("symbol")}>
            <input
              id="symbol"
              className={`input mono ${show("symbol") ? "input-invalid" : ""}`.trim()}
              placeholder="RDOGE"
              maxLength={16}
              value={form.symbol}
              onChange={(event) => set("symbol", event.target.value.toUpperCase())}
            />
          </Field>
        </div>

        <Field
          label="Total supply"
          htmlFor="supply"
          error={show("totalSupply")}
          hint={`= ${supplyLabel(form.totalSupply)} · 18 decimals. Fixed at launch: there is no mint function, so this can never grow.`}
        >
          <input
            id="supply"
            className={`input mono ${show("totalSupply") ? "input-invalid" : ""}`.trim()}
            inputMode="numeric"
            value={form.totalSupply}
            onChange={(event) => set("totalSupply", event.target.value.replace(/[^\d]/g, ""))}
          />
        </Field>

        <Field label="Description" htmlFor="description">
          <textarea
            id="description"
            className="textarea"
            placeholder="What is this coin about?"
            maxLength={480}
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
          />
        </Field>

        <div className={TWO_COLUMNS}>
          <Field label="Website" htmlFor="website" error={show("website")}>
            <input
              id="website"
              className="input"
              placeholder="https://…"
              value={form.website}
              onChange={(event) => set("website", event.target.value)}
            />
          </Field>
          <Field label="Twitter / X" htmlFor="twitter">
            <input
              id="twitter"
              className="input"
              placeholder="@handle"
              value={form.twitter}
              onChange={(event) => set("twitter", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Telegram" htmlFor="telegram">
          <input
            id="telegram"
            className="input"
            placeholder="@channel"
            value={form.telegram}
            onChange={(event) => set("telegram", event.target.value)}
          />
        </Field>
      </section>

      <section className="card flex flex-col gap-4 p-6">
        <div>
          <div className="card-title mb-1.5">How it trades</div>
          <p className="field-hint">
            A curve launch is tradable the moment it exists. A fixed launch mints everything to you
            and leaves the market to you.
          </p>
        </div>

        <div className="segmented self-start">
          <button type="button" aria-pressed={form.mode === "curve"} onClick={() => set("mode", "curve")}>
            Bonding curve
          </button>
          <button type="button" aria-pressed={form.mode === "fixed"} onClick={() => set("mode", "fixed")}>
            Fixed supply
          </button>
        </div>

        {form.mode === "curve" ? (
          <>
            <Field
              label="Share of supply on the curve"
              htmlFor="curve"
              error={show("curvePercent")}
              hint={`The rest is minted to you at launch. At ${formatEth(
                economics.graduationTarget,
                3,
              )} ${NATIVE_SYMBOL} raised the curve closes, and everything left on it goes into a Uniswap V2 pool with the LP tokens burned.`}
              aside={<span className="mono text-dim">{form.curvePercent || "0"}%</span>}
            >
              <input
                id="curve"
                type="range"
                min={50}
                max={100}
                step={5}
                value={Number(form.curvePercent) || 80}
                onChange={(event) => set("curvePercent", event.target.value)}
                className="w-full accent-accent"
              />
            </Field>

            {Number(form.curvePercent) < 100 ? (
              <Notice tone="warn">
                You will hold {100 - Number(form.curvePercent)}% of the supply at launch. Buyers can
                see that, and a large creator allocation is the most common reason a launch is
                treated as a rug risk.
              </Notice>
            ) : null}

            {HAS_FACTORY ? (
              <Field
                label={`Opening buy (optional, ${NATIVE_SYMBOL})`}
                htmlFor="openingBuy"
                error={show("openingBuy")}
                hint="Buys your own coin on the curve in the same transaction as the launch, before anyone else can."
              >
                <input
                  id="openingBuy"
                  className="input mono"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={form.openingBuy}
                  onChange={(event) => set("openingBuy", event.target.value)}
                />
              </Field>
            ) : null}
          </>
        ) : (
          <Notice>
            Every token is minted to your wallet. Nothing trades until you open a pool on the{" "}
            <strong>Liquidity</strong> page.
          </Notice>
        )}
      </section>

      <section className="card flex flex-col gap-3 p-6">
        <div>
          <div className="card-title mb-1.5">Launch protections</div>
          <p className="field-hint">
            Optional, and all fixed at launch. Every one is written so it can throttle buying but
            can never stop a holder selling.
          </p>
        </div>

        <FeatureToggle
          icon="🤖"
          title="Anti-Bot"
          price={HAS_FACTORY ? `+${formatEth(economics.antiBotFee, 4)} ${NATIVE_SYMBOL}` : undefined}
          description="Limits each wallet to one buy per block, so snipers cannot spam the opening."
          checked={form.antiBot}
          onChange={(next) => set("antiBot", next)}
        />

        <FeatureToggle
          icon="🐋"
          title="Anti-Whale"
          price={HAS_FACTORY ? `+${formatEth(economics.antiWhaleFee, 4)} ${NATIVE_SYMBOL}` : undefined}
          description="Caps how much any one wallet can hold, so no single buyer corners the supply."
          checked={form.antiWhale}
          onChange={(next) => set("antiWhale", next)}
        >
          <Field
            label="Max wallet"
            htmlFor="maxWallet"
            error={show("maxWalletPercent")}
            hint="Percent of total supply. Checked when tokens arrive, never when they leave."
          >
            <input
              id="maxWallet"
              className="input mono"
              inputMode="decimal"
              value={form.maxWalletPercent}
              onChange={(event) => set("maxWalletPercent", event.target.value)}
            />
          </Field>
        </FeatureToggle>

        <FeatureToggle
          icon="💸"
          title="Add tax"
          price={HAS_FACTORY ? `+${formatEth(economics.taxFee, 4)} ${NATIVE_SYMBOL}` : undefined}
          description="Your own tax on transfers, on top of the platform tax. Up to 10%, locked at launch and never raisable."
          checked={form.customTax}
          onChange={(next) => set("customTax", next)}
        >
          <div className={TWO_COLUMNS}>
            <Field label="Tax rate (%)" htmlFor="taxPercent" error={show("taxPercent")}>
              <input
                id="taxPercent"
                className="input mono"
                inputMode="decimal"
                value={form.taxPercent}
                onChange={(event) => set("taxPercent", event.target.value)}
              />
            </Field>
            <Field
              label="Tax wallet"
              htmlFor="taxWallet"
              error={show("taxWallet")}
              hint="Leave blank to use your own address."
            >
              <input
                id="taxWallet"
                className="input mono"
                placeholder={wallet.account ?? "0x…"}
                value={form.taxWallet}
                onChange={(event) => set("taxWallet", event.target.value)}
              />
            </Field>
          </div>
        </FeatureToggle>

        <FeatureToggle
          icon="🔑"
          title="Renounce ownership on launch"
          description="Recommended. Supply is already fixed and there is no mint function; this drops the owner role too. Costs one extra transaction, and afterwards nothing about the coin can be changed — including its picture and links."
          checked={form.renounce}
          onChange={(next) => set("renounce", next)}
        />
      </section>

      <FeeSummary
        economics={economics}
        options={options}
        fee={fee}
        openingBuy={openingBuyWei}
        hasCurve={form.mode === "curve"}
        chargesFees={HAS_FACTORY}
      />

      {submitted && hasErrors ? (
        <Notice tone="error">Some fields still need attention.</Notice>
      ) : null}

      {wallet.isConnected && wallet.isCorrectChain && shortOnFunds ? (
        <Notice tone="warn">
          This launch sends {formatEth(total, 4)} {NATIVE_SYMBOL} plus gas, and your balance is{" "}
          {formatEth(wallet.balance, 4)} {NATIVE_SYMBOL}.
        </Notice>
      ) : null}

      <SubmitRow busy={busy} step={step} onSubmit={() => void submit()} />
    </div>
  );
}

function SubmitRow({
  busy,
  step,
  onSubmit,
}: {
  busy: boolean;
  step: string;
  onSubmit: () => void;
}) {
  const wallet = useWalletContext();

  if (!wallet.isConnected) {
    return (
      <Notice>Connect a wallet to launch. Every transaction is signed by you.</Notice>
    );
  }

  if (!wallet.isCorrectChain) {
    return (
      <Button variant="sell" size="lg" block onClick={() => void wallet.switchChain()}>
        Switch to {ACTIVE_CHAIN.name}
      </Button>
    );
  }

  return (
    <Button variant="primary" size="lg" block loading={busy} onClick={onSubmit}>
      {busy ? step || "Working…" : "Launch coin"}
    </Button>
  );
}

// --- validation and encoding --------------------------------------------------

function symbolOf(form: FormState): string {
  return form.symbol.trim().toUpperCase();
}

/** Echoes the typed supply back with separators, so a stray digit is obvious. */
function supplyLabel(value: string): string {
  const parsed = Number(value);
  if (!value || !Number.isFinite(parsed)) return "—";
  return `${parsed.toLocaleString("en-US")} tokens`;
}

/** The opening buy in wei, or zero when there is nothing valid to spend. */
function openingBuyOf(form: FormState): bigint {
  if (!HAS_FACTORY || form.mode !== "curve" || !form.openingBuy.trim()) return 0n;
  try {
    return parseEther(form.openingBuy.trim());
  } catch {
    return 0n;
  }
}

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};

  if (!form.name.trim()) errors.name = "A name is required.";
  else if (form.name.trim().length > 64) errors.name = "64 characters at most.";

  const symbol = symbolOf(form);
  if (!symbol) errors.symbol = "A symbol is required.";
  else if (symbol.length > 16) errors.symbol = "16 characters at most.";
  else if (!/^[A-Z0-9]+$/.test(symbol)) errors.symbol = "Letters and digits only.";

  const supply = Number(form.totalSupply);
  if (!form.totalSupply || !Number.isFinite(supply) || supply <= 0) {
    errors.totalSupply = "Supply must be greater than zero.";
  } else if (supply > 1e15) {
    errors.totalSupply = "That supply is unreasonably large.";
  }

  if (form.mode === "curve") {
    const share = Number(form.curvePercent);
    if (!Number.isFinite(share) || share < 50 || share > 100) {
      errors.curvePercent = "Between 50% and 100%.";
    }
    if (form.openingBuy.trim()) {
      try {
        if (parseEther(form.openingBuy.trim()) <= 0n) errors.openingBuy = "Must be positive.";
      } catch {
        errors.openingBuy = "Not a valid amount.";
      }
    }
  }

  if (form.antiWhale) {
    const cap = Number(form.maxWalletPercent);
    if (!Number.isFinite(cap) || cap <= 0 || cap > 100) {
      errors.maxWalletPercent = "Between 0 and 100 percent.";
    } else if (cap * 100 < 1) {
      errors.maxWalletPercent = "Too small to express: use 0.01% or more.";
    }
  }

  if (form.customTax) {
    const tax = Number(form.taxPercent);
    if (!Number.isFinite(tax) || tax <= 0 || tax > 10) errors.taxPercent = "Between 0 and 10%.";
    if (form.taxWallet.trim() && !isAddress(form.taxWallet.trim())) {
      errors.taxWallet = "Not a valid address.";
    }
  }

  if (form.website.trim() && !/^https?:\/\//i.test(form.website.trim())) {
    errors.website = "Must start with http:// or https://";
  }

  return errors;
}

function toConfig(form: FormState, account: Address): LaunchConfig {
  const customTax = form.customTax ? Math.round(Number(form.taxPercent) * 100) : 0;
  const taxWallet = form.taxWallet.trim();

  return {
    name: form.name.trim(),
    symbol: symbolOf(form),
    totalSupply: parseUnits(form.totalSupply, 18),
    curveBps: form.mode === "curve" ? BigInt(Math.round(Number(form.curvePercent) * 100)) : 0n,
    image: launchImageFor(form.image),
    description: form.description.trim(),
    website: form.website.trim(),
    twitter: form.twitter.trim(),
    telegram: form.telegram.trim(),
    antiBot: form.antiBot,
    maxWalletBps: form.antiWhale ? BigInt(Math.round(Number(form.maxWalletPercent) * 100)) : 0n,
    taxBps: BigInt(customTax),
    taxWallet: customTax > 0 ? ((taxWallet || account) as Address) : ZERO_ADDRESS,
  };
}
