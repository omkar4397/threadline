import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong disabled:bg-accent/50",
  secondary: "border border-line bg-surface text-ink hover:bg-stone-50 disabled:text-muted",
  ghost: "text-ink hover:bg-stone-100 disabled:text-muted",
  danger: "border border-red-200 bg-surface text-risk hover:bg-risk-soft disabled:opacity-50",
};

export function buttonClass(variant: Variant = "secondary", extra = "") {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed ${variants[variant]} ${extra}`;
}

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}
