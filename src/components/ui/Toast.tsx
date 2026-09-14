"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { explorerTxUrl } from "@/lib/chains";

type Tone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: Tone;
  message: string;
  hash?: string;
}

interface ToastApi {
  success: (message: string, hash?: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

/** The left edge carries the outcome: green for success, red for failure. */
const TONES: Record<Tone, string> = {
  success: "border-l-up",
  error: "border-l-sell",
  info: "",
};

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 0;

/** Transaction feedback that does not steal focus or block the page. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tone: Tone, message: string, hash?: string) => {
    const id = (nextId += 1);
    setToasts((current) => [...current, { id, tone, message, hash }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, hash) => push("success", message, hash),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed right-4 bottom-4 z-95 flex max-w-[min(380px,calc(100vw-32px))] flex-col gap-[9px]"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    // Errors linger: they usually need reading twice.
    const timer = setTimeout(() => onDismiss(toast.id), toast.tone === "error" ? 9000 : 6000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      className={`flex animate-rise items-start gap-2.5 rounded-lg border border-l-[3px] border-line-strong bg-panel-2 px-3.5 py-3 text-[13px] shadow-[inset_0_1px_0_rgb(255_255_255/0.03),0_18px_44px_rgb(0_0_0/0.5)] ${TONES[toast.tone]}`}
    >
      <span aria-hidden="true">{toast.tone === "error" ? "✕" : toast.tone === "success" ? "✓" : "›"}</span>
      <div className="flex-1">
        <div>{toast.message}</div>
        {toast.hash ? (
          <a
            href={explorerTxUrl(toast.hash)}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline underline-offset-2"
          >
            View transaction
          </a>
        ) : null}
      </div>
      <button className="btn btn-ghost btn-sm" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside a ToastProvider.");
  return api;
}
