"use client";

import { useState } from "react";
import { isAddress, type Address } from "viem";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Notice from "@/components/ui/Notice";
import { useLaunches } from "@/hooks/useLaunches";
import { readCoin } from "@/lib/token";
import { readableError } from "@/lib/format";

/**
 * Adds a coin this browser has not seen to the local registry.
 *
 * The address is verified by actually reading the contract, so a typo or a
 * plain wallet address is rejected before it can clutter the board.
 */
export default function ImportCoin({ onImported }: { onImported?: (address: Address) => void }) {
  const { register } = useLaunches();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const address = value.trim();
    if (!isAddress(address)) {
      setError("That is not a valid contract address.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const coin = await readCoin(address as Address);
      register({ address: coin.address, name: coin.name, symbol: coin.symbol });
      onImported?.(coin.address);
      setOpen(false);
      setValue("");
    } catch (err) {
      setError(
        readableError(err) ||
          "Could not read a launch at that address. Check the network and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Import by address</Button>

      <Modal open={open} title="Import a coin" onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-4">
          <p className="field-hint">
            Paste the contract address of a launch. It is read straight from the chain and added to
            this browser&rsquo;s list.
          </p>
          <input
            className={`input mono ${error ? "input-invalid" : ""}`.trim()}
            placeholder="0x…"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            autoFocus
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button variant="primary" block loading={busy} onClick={() => void submit()}>
            Import
          </Button>
        </div>
      </Modal>
    </>
  );
}
