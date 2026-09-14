"use client";

import { useEffect, useState } from "react";

/** Copies `value`, and says so for a moment. Falls back silently if blocked. */
export default function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // Clipboard access can be denied; the address is on screen regardless.
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
