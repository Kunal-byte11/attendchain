import React from "react";
import { CheckCircle2, AlertTriangle, AlertOctagon } from "lucide-react";
import type { AttendancePercentageMetrics } from "@/types";

export interface PercentageGaugeCardProps {
  metrics: AttendancePercentageMetrics;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function PercentageGaugeCard({
  metrics,
  title = "Attendance Status",
  subtitle,
  className = "",
}: PercentageGaugeCardProps) {
  const { percentage, displayLabel, tier, isShortage, eligibleSessionsCount } =
    metrics;

  const tierColors = {
    ELIGIBLE: {
      border: "border-emerald-200",
      bg: "bg-emerald-50/50",
      text: "text-emerald-950",
      badgeBg: "bg-emerald-100",
      badgeText: "text-emerald-800",
      barBg: "bg-emerald-600",
      icon: CheckCircle2,
      label: "Eligible (>=75%)",
    },
    WARNING_CONDONATION: {
      border: "border-amber-200",
      bg: "bg-amber-50/50",
      text: "text-amber-950",
      badgeBg: "bg-amber-100",
      badgeText: "text-amber-800",
      barBg: "bg-amber-500",
      icon: AlertTriangle,
      label: "Warning: Condonation Zone (65-74%)",
    },
    CRITICAL_SHORTAGE: {
      border: "border-rose-200",
      bg: "bg-rose-50/50",
      text: "text-rose-950",
      badgeBg: "bg-rose-100",
      badgeText: "text-rose-800",
      barBg: "bg-rose-600",
      icon: AlertOctagon,
      label: "Critical Shortage (<65%)",
    },
  }[tier];

  const Icon = tierColors.icon;

  return (
    <div
      className={`rounded-xl border ${tierColors.border} ${tierColors.bg} p-5 shadow-xs ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-semibold ${tierColors.badgeBg} ${tierColors.badgeText}`}
        >
          <Icon className="h-3.5 w-3.5" />
          <span>{tierColors.label}</span>
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-3xl font-extrabold tracking-tight text-slate-900">
          {displayLabel}
        </span>
        {eligibleSessionsCount > 0 && (
          <span className="text-xs text-slate-600">
            ({metrics.totalPresentCredits} Present / {eligibleSessionsCount}{" "}
            Eligible)
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full transition-all duration-500 ${tierColors.barBg}`}
            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
          <span>0%</span>
          <span className="font-semibold text-slate-700">75% Threshold</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
