"use client";

import { useState } from "react";
import { isAddress, type Address } from "viem";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Notice from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";
import { useWalletContext } from "@/components/WalletProvider";
import ImagePicker from "@/components/create/ImagePicker";
import { graduate, renounceOwnership, setPair, setRouter, updateMetadata } from "@/lib/token";
import { ROUTER_ADDRESS, ZERO_ADDRESS } from "@/lib/env";
import { readableError } from "@/lib/format";
import type { Coin } from "@/lib/types";

/**
 * Shown only to the current owner. Everything here is either metadata or a
 * one-way step — there is no function anywhere that mints supply or moves
 * someone else's tokens.
 */
export default function CreatorTools({ coin, onDone }: { coin: Coin; onDone: () => void }) {
  const wallet = useWalletContext();
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const [meta, setMeta] = useState(coin.meta);
  const [pair, setPairInput] = useState("");

  const isOwner =
    wallet.account !== null &&
    coin.owner !== ZERO_ADDRESS &&
    wallet.account.toLowerCase() === coin.owner.toLowerCase();

  if (!isOwner) return null;

  const signer = { provider: wallet.provider, account: wallet.account };
  const canGraduate =
    coin.curveSupply > 0n && !coin.graduated && coin.ethReserve >= coin.graduationTarget;
  const needsRouter = coin.router === ZERO_ADDRESS;

  async function run(label: string, action: () => Promise<{ hash: string }>) {
    setBusy(label);
    try {
      const { hash } = await action();
      toast.success(`${label} confirmed.`, hash);
      onDone();
    } catch (err) {
      toast.error(readableError(err));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="card flex flex-col gap-4">
      <div className="card-title">Creator tools</div>

      <ImagePicker value={meta.image} onChange={(image) => setMeta({ ...meta, image })} />

      <Field label="Description">
        <textarea
          className="textarea"
          value={meta.description}
          maxLength={480}
          onChange={(event) => setMeta({ ...meta, description: event.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
        <Field label="Website">
          <input
            className="input"
            value={meta.website}
            onChange={(event) => setMeta({ ...meta, website: event.target.value })}
          />
        </Field>
        <Field label="Twitter / X">
          <input
            className="input"
            value={meta.twitter}
            onChange={(event) => setMeta({ ...meta, twitter: event.target.value })}
          />
        </Field>
      </div>

      <Field label="Telegram">
        <input
          className="input"
          value={meta.telegram}
          onChange={(event) => setMeta({ ...meta, telegram: event.target.value })}
        />
      </Field>

      <Button
        loading={busy === "Metadata update"}
        onClick={() => void run("Metadata update", () => updateMetadata(signer, coin.address, meta))}
      >
        Save details
      </Button>

      <div className="my-4 h-px bg-line" />

      {needsRouter && ROUTER_ADDRESS !== null ? (
        <>
          <Notice tone="warn">
            No graduation venue is set on this coin, so the curve will keep trading past its target
            instead of opening a pool. Point it at the configured Uniswap V2 router to fix that.
          </Notice>
          <Button
            loading={busy === "Router update"}
            onClick={() =>
              void run("Router update", () =>
                setRouter(signer, coin.address, ROUTER_ADDRESS as Address),
              )
            }
          >
            Set graduation router
          </Button>
        </>
      ) : null}

      {canGraduate ? (
        <Button
          variant="primary"
          loading={busy === "Graduation"}
          onClick={() => void run("Graduation", () => graduate(signer, coin.address))}
        >
          Graduate to a pool now
        </Button>
      ) : null}

      {coin.curveSupply === 0n ? (
        <Field
          label="Register the DEX pool"
          hint="On a taxed token, the pool must be exempt or the router will be handed less than it asked for. Set this before adding liquidity."
        >
          <div className="flex items-center gap-2.5">
            <input
              className="input mono"
              placeholder="0x… pair address"
              value={pair}
              onChange={(event) => setPairInput(event.target.value)}
            />
            <Button
              disabled={!isAddress(pair.trim())}
              loading={busy === "Pool registration"}
              onClick={() =>
                void run("Pool registration", () =>
                  setPair(signer, coin.address, pair.trim() as Address),
                )
              }
            >
              Set
            </Button>
          </div>
        </Field>
      ) : null}

      <div className="my-4 h-px bg-line" />

      <Notice tone="warn">
        Renouncing is permanent. Afterwards nobody — including you — can change this coin&rsquo;s
        details, register a pool, or set a graduation router.
      </Notice>
      <Button
        loading={busy === "Renounce"}
        onClick={() => void run("Renounce", () => renounceOwnership(signer, coin.address))}
      >
        Renounce ownership
      </Button>
    </div>
  );
}
