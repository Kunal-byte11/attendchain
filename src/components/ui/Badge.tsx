import React from "react";

export type BadgeTone =
  "neutral" | "brand" | "present" | "late" | "absent" | "excused" | "web3";

export interface BadgeProps {
  tone?: BadgeTone;
  mono?: boolean;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-800 border-slate-200",
  brand: "bg-indigo-50 text-indigo-900 border-indigo-200",
  present: "bg-emerald-50 text-emerald-900 border-emerald-200",
  late: "bg-amber-50 text-amber-900 border-amber-200",
  absent: "bg-rose-50 text-rose-900 border-rose-200",
  excused: "bg-sky-50 text-sky-900 border-sky-200",
  web3: "bg-violet-50 text-violet-900 border-violet-200",
};

export function Badge({
  tone = "neutral",
  mono = false,
  children,
  className = "",
  ariaLabel,
}: BadgeProps) {
  return (
    <span
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium ${
        toneClasses[tone]
      } ${mono ? "font-mono" : ""} ${className}`}
    >
      {children}
    </span>
  );
}
