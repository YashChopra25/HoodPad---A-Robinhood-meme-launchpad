"use client";

import { useRef, useState } from "react";
import Notice from "@/components/ui/Notice";
import {
  MAX_DATA_URI_BYTES,
  byteLength,
  fileToDataUri,
  formatBytes,
  safeImageSrc,
  storageGas,
} from "@/lib/image";

/**
 * The coin's picture. Uploads are compressed in the browser to a square data
 * URI that is written into the contract, so the image lives on-chain and
 * cannot rot; a plain URL is offered for anyone who would rather host it.
 */

/**
 * Uploads are disabled for now, so only a link can be set. The upload path is
 * kept intact but hidden — flip this to true to switch the picker to uploads.
 */
const UPLOADS_ENABLED = false;

export default function ImagePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mode: "upload" | "url" = UPLOADS_ENABLED ? "upload" : "url";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const preview = safeImageSrc(value);
  // A pasted link can take a moment to fetch, so the spinner stays up until
  // the preview settles either way.
  const [settledSrc, setSettledSrc] = useState<string | null>(null);
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const loading = preview !== null && settledSrc !== preview;
  const broken = preview !== null && brokenSrc === preview;
  const inline = value.startsWith("data:");
  const bytes = value ? byteLength(value) : 0;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const encoded = await fileToDataUri(file);
      onChange(encoded.uri);
      setNote(
        `Compressed to ${encoded.width}×${encoded.width}, ${formatBytes(encoded.bytes)} — about ${Math.round(
          storageGas(encoded.uri) / 1000,
        )}k extra gas to store on-chain.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="field-label">
        <span>Token image</span>
      </div>

      <div className="flex items-start gap-3.5">
        <button
          type="button"
          onClick={() => mode === "upload" && inputRef.current?.click()}
          className={`avatar size-24 rounded-2xl border-2 border-line-strong p-0 text-2xl text-dim ${
            preview ? "border-solid bg-transparent" : "border-dashed bg-bg dark:bg-elevated"
          } ${mode === "upload" ? "cursor-pointer" : "cursor-default"}`}
          aria-label="Choose token image"
        >
          {busy ? (
            <span className="spinner" />
          ) : preview ? (
            <>
              {/* The source is a data URI or an arbitrary host, so this stays a
                  plain <img> rather than next/image with a host allowlist. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt=""
                onLoad={() => setSettledSrc(preview)}
                onError={() => {
                  setSettledSrc(preview);
                  setBrokenSrc(preview);
                }}
                className={`[grid-area:1/1] transition-opacity duration-200 ${loading ? "opacity-0" : ""}`}
              />
              {loading ? <span className="spinner [grid-area:1/1]" /> : null}
            </>
          ) : (
            "＋"
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {mode === "upload" ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              <span className="field-hint">
                PNG, JPG or WebP; square works best. It is squared off and compressed to under{" "}
                {formatBytes(MAX_DATA_URI_BYTES)} so it fits on-chain, then stored in the contract
                itself — no image host to go down later.
              </span>
              {value ? (
                <div className="flex items-center gap-2">
                  <span className="chip">{inline ? `On-chain · ${formatBytes(bytes)}` : "Link"}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange("")}>
                    Remove
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <input
                className="input"
                placeholder="https://… or ipfs://…"
                value={inline ? "" : value}
                onChange={(event) => onChange(event.target.value)}
              />
              <span className="field-hint">
                Cheapest option: only the link is stored on-chain. If the host goes away, so does
                the picture.
              </span>
            </>
          )}
        </div>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {broken && !error ? (
        <Notice tone="error">
          That link did not load as an image, so the coin would show no picture. Use a direct
          image link (ending in .png, .jpg, .webp or .gif) or an ipfs:// link.
        </Notice>
      ) : null}
      {note && !error ? <span className="field-hint">{note}</span> : null}
    </div>
  );
}
