"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "primary" | "buy" | "sell" | "ghost";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  default: "",
  primary: "btn-primary",
  buy: "btn-buy",
  sell: "btn-sell",
  ghost: "btn-ghost",
};

const SIZES: Record<Size, string> = { sm: "btn-sm", md: "", lg: "btn-lg" };

export default function Button({
  variant = "default",
  size = "md",
  block = false,
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: Props) {
  const classes = ["btn", VARIANTS[variant], SIZES[size], block ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
