import React from "react";
import {
  CheckCircle2,
  Clock,
  FileCheck2,
  History,
  MinusCircle,
  XCircle,
} from "lucide-react";
import type { AttendanceStatus } from "../../types";
import { Badge, type BadgeTone } from "./Badge";

export interface StatusBadgeProps {
  status: AttendanceStatus;
  amended?: boolean;
}

const statusConfig: Record<
  AttendanceStatus,
  {
    label: string;
    tone: BadgeTone;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  NONE: { label: "Unmarked", tone: "neutral", Icon: MinusCircle },
  PRESENT: { label: "Present", tone: "present", Icon: CheckCircle2 },
  LATE: { label: "Late", tone: "late", Icon: Clock },
  ABSENT: { label: "Absent", tone: "absent", Icon: XCircle },
  EXCUSED: { label: "Excused", tone: "excused", Icon: FileCheck2 },
};

export function StatusBadge({ status, amended = false }: StatusBadgeProps) {
  const cfg = statusConfig[status];
  const Icon = cfg.Icon;

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={cfg.tone}>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{cfg.label}</span>
      </Badge>
      {amended && (
        <Badge tone="excused" ariaLabel="Record amended on-chain">
          <History className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Amended</span>
        </Badge>
      )}
    </span>
  );
}
