import { describe, it, expect } from "vitest";
import {
  calculateAttendanceMetrics,
  type AttendanceCalculationInput,
} from "@/lib/attendance/calculator";

describe("Pure Attendance Calculator Suite (T-013, FR-013, TR-010, 01_PRD.md Section 7)", () => {
  it("handles zero eligible sessions (Denominator == 0) safely with N/A label and 100.00%", () => {
    // 0 sessions at all
    const res1 = calculateAttendanceMetrics([]);
    expect(res1.percentage).toBe(100.0);
    expect(res1.displayLabel).toBe("N/A (No Eligible Sessions)");
    expect(res1.tier).toBe("ELIGIBLE");
    expect(res1.isShortage).toBe(false);

    // Only OPEN and CANCELLED sessions
    const res2 = calculateAttendanceMetrics([
      { status: "PRESENT", sessionStatus: "OPEN" },
      { status: "ABSENT", sessionStatus: "CANCELLED" },
    ]);
    expect(res2.eligibleSessionsCount).toBe(0);
    expect(res2.percentage).toBe(100.0);
    expect(res2.displayLabel).toBe("N/A (No Eligible Sessions)");

    // Only EXCUSED in CLOSED sessions
    const res3 = calculateAttendanceMetrics([
      { status: "EXCUSED", sessionStatus: "CLOSED" },
      { status: "EXCUSED", sessionStatus: "CLOSED" },
    ]);
    expect(res3.eligibleSessionsCount).toBe(0);
    expect(res3.excusedCount).toBe(2);
    expect(res3.percentage).toBe(100.0);
  });

  it("calculates exact percentage for PRD Journey 3 example: 12 Present / 14 Eligible -> 85.71%", () => {
    const records: AttendanceCalculationInput[] = [
      ...Array(12).fill({ status: "PRESENT", sessionStatus: "CLOSED" }),
      ...Array(2).fill({ status: "ABSENT", sessionStatus: "CLOSED" }),
      { status: "EXCUSED", sessionStatus: "CLOSED" }, // Excluded from denominator
      { status: "PRESENT", sessionStatus: "OPEN" }, // Excluded (OPEN)
      { status: "ABSENT", sessionStatus: "CANCELLED" }, // Excluded (CANCELLED)
    ];

    const metrics = calculateAttendanceMetrics(records);
    expect(metrics.presentCount).toBe(12);
    expect(metrics.absentCount).toBe(2);
    expect(metrics.excusedCount).toBe(1);
    expect(metrics.totalPresentCredits).toBe(12);
    expect(metrics.eligibleSessionsCount).toBe(14);
    // 12 / 14 * 100 = 85.714285... -> 85.71%
    expect(metrics.percentage).toBe(85.71);
    expect(metrics.displayLabel).toBe("85.71%");
    expect(metrics.tier).toBe("ELIGIBLE");
    expect(metrics.isShortage).toBe(false);
  });

  it("credits LATE as +1 in numerator and +1 in denominator per Section 7.1", () => {
    const records: AttendanceCalculationInput[] = [
      { status: "PRESENT", sessionStatus: "CLOSED" },
      { status: "LATE", sessionStatus: "CLOSED" },
      { status: "ABSENT", sessionStatus: "CLOSED" },
      { status: "ABSENT", sessionStatus: "CLOSED" },
    ];

    const metrics = calculateAttendanceMetrics(records);
    expect(metrics.presentCount).toBe(1);
    expect(metrics.lateCount).toBe(1);
    expect(metrics.totalPresentCredits).toBe(2);
    expect(metrics.eligibleSessionsCount).toBe(4);
    // 2 / 4 * 100 = 50.00%
    expect(metrics.percentage).toBe(50.0);
    expect(metrics.displayLabel).toBe("50.00%");
    expect(metrics.tier).toBe("CRITICAL_SHORTAGE");
    expect(metrics.isShortage).toBe(true);
  });

  it("treats NONE (unrecorded) in CLOSED session as implicit absent (+0/+1)", () => {
    const records: AttendanceCalculationInput[] = [
      { status: "PRESENT", sessionStatus: "CLOSED" },
      { status: "NONE", sessionStatus: "CLOSED" },
    ];

    const metrics = calculateAttendanceMetrics(records);
    expect(metrics.presentCount).toBe(1);
    expect(metrics.unrecordedClosedCount).toBe(1);
    expect(metrics.totalPresentCredits).toBe(1);
    expect(metrics.eligibleSessionsCount).toBe(2);
    expect(metrics.percentage).toBe(50.0);
  });

  it("correctly categorizes shortage tiers: ELIGIBLE (>=75%), WARNING_CONDONATION (65-74.99%), CRITICAL_SHORTAGE (<65%)", () => {
    // 3 / 4 = 75.00% -> ELIGIBLE
    const eligible = calculateAttendanceMetrics([
      ...Array(3).fill({ status: "PRESENT", sessionStatus: "CLOSED" }),
      { status: "ABSENT", sessionStatus: "CLOSED" },
    ]);
    expect(eligible.percentage).toBe(75.0);
    expect(eligible.tier).toBe("ELIGIBLE");
    expect(eligible.isShortage).toBe(false);

    // 7 / 10 = 70.00% -> WARNING_CONDONATION
    const warning = calculateAttendanceMetrics([
      ...Array(7).fill({ status: "PRESENT", sessionStatus: "CLOSED" }),
      ...Array(3).fill({ status: "ABSENT", sessionStatus: "CLOSED" }),
    ]);
    expect(warning.percentage).toBe(70.0);
    expect(warning.tier).toBe("WARNING_CONDONATION");
    expect(warning.isShortage).toBe(true);

    // 6 / 10 = 60.00% -> CRITICAL_SHORTAGE
    const critical = calculateAttendanceMetrics([
      ...Array(6).fill({ status: "PRESENT", sessionStatus: "CLOSED" }),
      ...Array(4).fill({ status: "ABSENT", sessionStatus: "CLOSED" }),
    ]);
    expect(critical.percentage).toBe(60.0);
    expect(critical.tier).toBe("CRITICAL_SHORTAGE");
    expect(critical.isShortage).toBe(true);
  });
});
