import type { ReactNode } from "react";

interface Props {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  aside?: ReactNode;
  children: ReactNode;
}

export default function Field({ label, htmlFor, hint, error, aside, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="field-label" htmlFor={htmlFor}>
        <span>{label}</span>
        {aside}
      </label>
      {children}
      {error ? (
        <span className="field-error">{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  );
}
