import type { Metadata } from "next";
import CreateForm from "@/components/create/CreateForm";
import { ACTIVE_CHAIN } from "@/lib/chains";

export const metadata: Metadata = {
  title: "Create a coin",
  description: `Deploy an ERC-20 with a bonding curve on ${ACTIVE_CHAIN.name}.`,
};

export default function CreatePage() {
  return (
    <main className="page flex-1 pt-3">
      <div className="mb-5">
        <h1 className="stamp">Launch</h1>
        <p className="mt-3 max-w-[620px] text-[13.5px] text-muted">
          A new coin on {ACTIVE_CHAIN.name}.
          One transaction deploys the token, its market and its guards. Everything below is fixed at
          launch unless it says otherwise.
        </p>
      </div>

      <CreateForm />
    </main>
  );
}
