import type { Metadata } from "next";
import CreateForm from "@/components/create/CreateForm";
import { ACTIVE_CHAIN } from "@/lib/chains";

export const metadata: Metadata = {
  title: "Create a coin",
  description: `Deploy an ERC-20 with a bonding curve on ${ACTIVE_CHAIN.name}.`,
};

export default function CreatePage() {
  return (
    <main className="page max-w-[720px] flex-1 pt-7 pb-20 max-sm:pt-5">
      <div className="mb-[18px]">
        <span className="eyebrow">Create token</span>
        <h2 className="mt-3 text-[clamp(22px,3vw,30px)] tracking-[-0.04em]">
          Launch on {ACTIVE_CHAIN.name}
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          One transaction deploys the token, its market and its guards. Everything below is fixed at
          launch unless it says otherwise.
        </p>
      </div>

      <CreateForm />
    </main>
  );
}
