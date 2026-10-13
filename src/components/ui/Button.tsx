import React from "react";

export type ButtonVariant =
  "primary" | "secondary" | "danger" | "ghost" | "web3-tx";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  loadingText?: string;
  hasError?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-700 border border-transparent shadow-xs",
  secondary:
    "bg-white text-slate-900 hover:bg-slate-100 border border-slate-300 shadow-xs",
  danger:
    "bg-rose-700 text-white hover:bg-rose-800 border border-transparent shadow-xs",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 border border-transparent",
  "web3-tx":
    "bg-violet-900 text-white hover:bg-violet-950 border border-violet-700 shadow-xs",
};

export function Button({
  variant = "primary",
  isLoading = false,
  loadingText,
  hasError = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled || isLoading);

  return (
    <button
      type={props.type ?? "button"}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 ${
        variantClasses[variant]
      } ${hasError ? "ring-2 ring-rose-600" : ""} ${className}`}
      {...props}
    >
      {isLoading && (
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      <span>{isLoading && loadingText ? loadingText : children}</span>
    </button>
  );
}
