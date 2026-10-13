import type {
  AttendanceStatus,
  SessionStatus,
  AttendancePercentageMetrics,
  AttendanceShortageTier,
} from "@/types";

export interface AttendanceCalculationInput {
  status: AttendanceStatus;
  sessionStatus: SessionStatus;
}

/**
 * Pure, authoritative attendance percentage calculator (FR-013, TR-010).
 * Implements the exact institutional rules in 01_PRD.md Section 7:
 * - PRESENT (+1/+1)
 * - LATE (+1/+1)
 * - ABSENT (+0/+1)
 * - EXCUSED (+0/+0, excluded from denominator)
 * - NONE in CLOSED session (+0/+1, treated as implicit absent)
 * - OPEN and CANCELLED sessions are completely excluded (+0/+0)
 * - Half-up rounding to 2 decimal places
 * - Denominator == 0 returns 100.00% with "N/A (No Eligible Sessions)" and "ELIGIBLE"
 */
export function calculateAttendanceMetrics(
  records: AttendanceCalculationInput[]
): AttendancePercentageMetrics {
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let excusedCount = 0;
  let unrecordedClosedCount = 0;

  for (const record of records) {
    // Exclude OPEN and CANCELLED sessions
    if (
      record.sessionStatus === "OPEN" ||
      record.sessionStatus === "CANCELLED"
    ) {
      continue;
    }

    // Only process CLOSED sessions
    if (record.sessionStatus === "CLOSED") {
      switch (record.status) {
        case "PRESENT":
          presentCount++;
          break;
        case "LATE":
          lateCount++;
          break;
        case "ABSENT":
          absentCount++;
          break;
        case "EXCUSED":
          excusedCount++;
          break;
        case "NONE":
          unrecordedClosedCount++;
          break;
      }
    }
  }

  const totalPresentCredits = presentCount + lateCount;
  const eligibleSessionsCount =
    presentCount + lateCount + absentCount + unrecordedClosedCount;

  // Edge case: Denominator == 0
  if (eligibleSessionsCount === 0) {
    return {
      presentCount,
      lateCount,
      absentCount,
      excusedCount,
      unrecordedClosedCount,
      totalPresentCredits: 0,
      eligibleSessionsCount: 0,
      percentage: 100.0,
      displayLabel: "N/A (No Eligible Sessions)",
      tier: "ELIGIBLE",
      isShortage: false,
    };
  }

  // Exact standard half-up rounding to 2 decimal places: Math.round(val * 100) / 100
  const rawPercentage = (totalPresentCredits / eligibleSessionsCount) * 100;
  const percentage = Math.round(rawPercentage * 100) / 100;

  let tier: AttendanceShortageTier = "ELIGIBLE";
  let isShortage = false;

  if (percentage < 65.0) {
    tier = "CRITICAL_SHORTAGE";
    isShortage = true;
  } else if (percentage < 75.0) {
    tier = "WARNING_CONDONATION";
    isShortage = true;
  }

  return {
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    unrecordedClosedCount,
    totalPresentCredits,
    eligibleSessionsCount,
    percentage,
    displayLabel: `${percentage.toFixed(2)}%`,
    tier,
    isShortage,
  };
}
