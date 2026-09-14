import { formatEth, formatPercent } from "@/lib/format";
import { NATIVE_SYMBOL } from "@/lib/env";
import type { Economics, LaunchOptions } from "@/lib/types";

/**
 * Every charge on one screen, with the reason for each. The totals come from
 * the factory itself when one is deployed, so this is what will actually be
 * spent rather than a hard-coded table.
 */
export default function FeeSummary({
  economics,
  options,
  fee,
  openingBuy,
  hasCurve,
  chargesFees,
}: {
  economics: Economics;
  options: LaunchOptions;
  fee: bigint;
  openingBuy: bigint;
  hasCurve: boolean;
  /** False when deploying straight from the wallet, where nothing collects a fee. */
  chargesFees: boolean;
}) {
  const lines: Array<[string, string]> = [];
  if (chargesFees) {
    lines.push(["Base fee", eth(economics.baseFee)]);
    if (options.antiBot) lines.push(["Anti-bot", eth(economics.antiBotFee)]);
    if (options.antiWhale) lines.push(["Anti-whale", eth(economics.antiWhaleFee)]);
    if (options.customTax) lines.push(["Custom tax", eth(economics.taxFee)]);
  }

  return (
    <div className="card">
      <div className="card-title mb-3.5">Cost</div>
      <dl className="facts">
        {lines.map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}

        <dt className="font-semibold text-fg">Platform fee</dt>
        <dd className={`font-semibold ${chargesFees ? "mono" : "text-dim"}`}>
          {chargesFees ? eth(fee) : "none — deploying direct"}
        </dd>

        {openingBuy > 0n ? (
          <Row label="Your opening buy" value={eth(openingBuy)} />
        ) : null}

        {openingBuy > 0n ? (
          <>
            <dt className="font-semibold text-fg">Total to send</dt>
            <dd className="mono font-semibold">{eth(fee + openingBuy)}</dd>
          </>
        ) : null}

        <Row label="Network gas" value="paid in ETH at sign time" mono={false} />
      </dl>

      <div className="my-4 h-px bg-line" />

      <dl className="facts">
        <Row label="Transfer tax" value={formatPercent(economics.platformTaxBps)} />
        {hasCurve ? (
          <Row label="Curve trade fee" value={formatPercent(economics.tradeFeeBps)} />
        ) : null}
        {hasCurve ? <Row label="Graduates at" value={eth(economics.graduationTarget)} /> : null}
      </dl>
    </div>
  );
}

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={mono ? "mono" : "text-dim"}>{value}</dd>
    </>
  );
}

function eth(value: bigint): string {
  return `${formatEth(value, 4)} ${NATIVE_SYMBOL}`;
}
