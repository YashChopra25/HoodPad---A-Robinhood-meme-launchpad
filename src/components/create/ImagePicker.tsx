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
export default function ImagePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const preview = safeImageSrc(value);
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
        <div className="segmented p-0.5">
          <button
            type="button"
            aria-pressed={mode === "upload"}
            onClick={() => setMode("upload")}
            className="px-2.5 py-1 text-[12.5px]"
          >
            Upload
          </button>
          <button
            type="button"
            aria-pressed={mode === "url"}
            onClick={() => setMode("url")}
            className="px-2.5 py-1 text-[12.5px]"
          >
            Link
          </button>
        </div>
      </div>

      <div className="flex items-start gap-3.5">
        <button
          type="button"
          onClick={() => mode === "upload" && inputRef.current?.click()}
          className={`avatar size-24 rounded-2xl p-0 text-2xl text-dim ${
            preview ? "border-solid bg-transparent" : "border-dashed bg-white/[0.022]"
          } ${mode === "upload" ? "cursor-pointer" : "cursor-default"}`}
          aria-label="Choose token image"
        >
          {preview ? (
            // The source is a data URI or an arbitrary host, so this stays a
            // plain <img> rather than next/image with a host allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" />
          ) : busy ? (
            <span className="spinner" />
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
      {note && !error ? <span className="field-hint">{note}</span> : null}
    </div>
  );
}
