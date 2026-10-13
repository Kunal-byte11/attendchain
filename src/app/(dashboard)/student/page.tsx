"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  QrCode,
  KeyRound,
  CheckCircle2,
  Clock,
  Radio,
  BookOpen,
  History,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PercentageGaugeCard } from "@/components/attendance/PercentageGaugeCard";
import { useWallet } from "@/lib/blockchain/wallet";
import type {
  Course,
  LectureSession,
  AttendanceRecordView,
  AttendancePercentageMetrics,
} from "@/types";

function buildStudentCheckInMessage(
  sessionId: number,
  tokenOrPin: string,
  timestamp: number
): string {
  return `AttendChain QR Check-In\nSession ID: ${sessionId}\nChallenge: ${tokenOrPin}\nTimestamp: ${timestamp}`;
}

export default function StudentDashboardPage() {
  const { account, getSigner } = useWallet();

  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [activeSessions, setActiveSessions] = useState<LectureSession[]>([]);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecordView[]>(
    []
  );
  const [overallMetrics, setOverallMetrics] =
    useState<AttendancePercentageMetrics | null>(null);
  const [courseMetrics, setCourseMetrics] = useState<
    Record<string, AttendancePercentageMetrics>
  >({});

  const [isLoading, setIsLoading] = useState(true);
  const [checkInPin, setCheckInPin] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
    null
  );
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  const loadStudentData = async () => {
    setIsLoading(true);
    setCheckInError(null);
    try {
      const [coursesRes, sessionsRes, attendanceRes] = await Promise.all([
        fetch("/api/courses"),
        fetch("/api/sessions"),
        fetch("/api/attendance"),
      ]);

      if (coursesRes.ok) {
        const cData = await coursesRes.json();
        setEnrolledCourses(cData.courses || []);
      }

      if (sessionsRes.ok) {
        const sData = await sessionsRes.json();
        const allSessions: LectureSession[] = sData.sessions || [];
        const openList = allSessions.filter((s) => s.status === "OPEN");
        setActiveSessions(openList);
        if (openList.length > 0 && selectedSessionId === null) {
          const first = openList[0];
          if (first) {
            setSelectedSessionId(first.onChainSessionId);
          }
        }
      }

      if (attendanceRes.ok) {
        const aData = await attendanceRes.json();
        const records: AttendanceRecordView[] = aData.records || [];
        setRecentRecords(records);
        setOverallMetrics(aData.metrics || null);

        // Compute per-course metrics
        const grouped: Record<string, AttendanceRecordView[]> = {};
        for (const rec of records) {
          if (!grouped[rec.courseCode]) {
            grouped[rec.courseCode] = [];
          }
          grouped[rec.courseCode]?.push(rec);
        }

        const metricsMap: Record<string, AttendancePercentageMetrics> = {};
        for (const [code, recs] of Object.entries(grouped)) {
          const courseCalcRes = await fetch(
            `/api/attendance?courseId=${encodeURIComponent(code)}`
          );
          if (courseCalcRes.ok) {
            const courseCalcData = await courseCalcRes.json();
            metricsMap[code] = courseCalcData.metrics;
          }
        }
        setCourseMetrics(metricsMap);
      }
    } catch (err: unknown) {
      setCheckInError(
        err instanceof Error ? err.message : "Failed to load student data"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStudentData();
  }, []);

  const handlePinCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckInSuccess(null);
    setCheckInError(null);

    const cleanPin = checkInPin.trim().toUpperCase();
    if (!cleanPin || cleanPin.length !== 6) {
      setCheckInError("Please enter a valid 6-character classroom PIN.");
      return;
    }

    if (!selectedSessionId) {
      setCheckInError("Please select an active lecture session to check in.");
      return;
    }

    setIsSubmittingCheckIn(true);
    try {
      const signer = await getSigner();
      if (!signer) {
        throw new Error(
          "MetaMask wallet is not connected. Please connect your student wallet."
        );
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const signMessage = buildStudentCheckInMessage(
        selectedSessionId,
        cleanPin,
        timestamp
      );

      // Sign EIP-191 personal message with student's wallet
      const signature = await signer.signMessage(signMessage);

      const res = await fetch("/api/attendance/qr-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          tokenOrPin: cleanPin,
          signature,
          signedTimestamp: timestamp,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error?.message || `Check-in failed with code ${data.error?.code}`
        );
      }

      setCheckInSuccess(
        `Successfully checked in to Session #${selectedSessionId}! Attendance staged as PRESENT (QR Verified).`
      );
      setCheckInPin("");
      await loadStudentData();
    } catch (err: unknown) {
      setCheckInError(
        err instanceof Error ? err.message : "Failed to sign or submit check-in"
      );
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Student Workspace
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-500">
              Screen 5
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Student Attendance Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Check in to active lectures, monitor your subject attendance gauges,
            and inspect cryptographic proofs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/student/history">
            <Button variant="secondary">
              <History className="h-4 w-4" />
              <span>Full Attendance History</span>
            </Button>
          </Link>
          <Link href="/verify">
            <Button variant="ghost">
              <ExternalLink className="h-4 w-4" />
              <span>Verify On-Chain</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Grid */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Live Check-in Card (FR-018, FR-019) */}
        <div className="lg:col-span-1">
          <Card className="border-indigo-100 bg-white shadow-xs">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Live Lecture Check-In
                    </h2>
                    <p className="text-xs text-slate-500">
                      Enter 6-character PIN or scan QR
                    </p>
                  </div>
                </div>
                {activeSessions.length > 0 && (
                  <Badge tone="present" mono>
                    <Radio className="h-3 w-3 animate-pulse" />
                    <span>Live Now</span>
                  </Badge>
                )}
              </div>
            </div>

            <div className="p-5">
              {checkInSuccess && (
                <div
                  role="status"
                  className="mb-4 rounded-lg bg-emerald-50 p-3.5 text-xs text-emerald-900"
                >
                  <CheckCircle2 className="mb-0.5 inline h-4 w-4 text-emerald-600" />{" "}
                  {checkInSuccess}
                </div>
              )}

              {checkInError && (
                <div
                  role="alert"
                  className="mb-4 rounded-lg bg-rose-50 p-3.5 text-xs text-rose-900"
                >
                  <AlertCircle className="mb-0.5 inline h-4 w-4 text-rose-600" />{" "}
                  {checkInError}
                </div>
              )}

              {activeSessions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                  <Clock className="mx-auto h-8 w-8 text-slate-300" />
                  <h3 className="mt-2 text-sm font-semibold text-slate-700">
                    No Live Lectures
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    There are currently no open lecture sessions with active QR
                    codes. Check back when your professor begins class.
                  </p>
                </div>
              ) : (
                <form onSubmit={handlePinCheckIn} className="space-y-4">
                  <div>
                    <label
                      htmlFor="session-select"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Active Classroom Session
                    </label>
                    <select
                      id="session-select"
                      value={selectedSessionId || ""}
                      onChange={(e) =>
                        setSelectedSessionId(Number(e.target.value))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
                    >
                      {activeSessions.map((session) => (
                        <option
                          key={session.id}
                          value={session.onChainSessionId}
                        >
                          #{session.onChainSessionId} — {session.courseCode}:{" "}
                          {session.topic}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="pin-input"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Classroom Fallback PIN (6 characters)
                    </label>
                    <div className="relative mt-1">
                      <input
                        id="pin-input"
                        type="text"
                        maxLength={6}
                        placeholder="e.g. 7K9X2B"
                        value={checkInPin}
                        onChange={(e) =>
                          setCheckInPin(e.target.value.toUpperCase())
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-center text-lg font-bold tracking-widest text-slate-900 placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Ask your professor for the 6-character rotating code
                      projected on screen.
                    </p>
                  </div>

                  <div className="rounded-lg bg-indigo-50/70 p-3 text-xs text-indigo-900">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                      <p>
                        Check-in requires an EIP-191 cryptographic wallet
                        signature to verify your bound student identity. No gas
                        fees are incurred.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    isLoading={isSubmittingCheckIn}
                    disabled={!checkInPin || checkInPin.length !== 6}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Sign & Submit Check-In</span>
                  </Button>
                </form>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Subject Gauges & Metric Cards (FR-013, TR-010) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Overall Attendance Gauge */}
          {overallMetrics ? (
            <PercentageGaugeCard
              metrics={overallMetrics}
              title="Overall Attendance Standing"
              subtitle="Calculated across all completed eligible lecture sessions"
            />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-700">
                Attendance Standing
              </h3>
              <p className="mt-2 text-xs text-slate-500">
                No closed lecture sessions recorded yet. Gauges will update as
                professors commit sessions on-chain.
              </p>
            </div>
          )}

          {/* Subject-Wise Percentage Gauge Grid */}
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Enrolled Courses & 75% Threshold Gauges
              </h2>
              <span className="text-xs text-slate-500">
                {enrolledCourses.length} Courses Enrolled
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {enrolledCourses.map((course) => {
                const metric: AttendancePercentageMetrics = courseMetrics[
                  course.courseCode
                ] || {
                  percentage: 100,
                  displayLabel: "100.0%",
                  tier: "ELIGIBLE",
                  isShortage: false,
                  eligibleSessionsCount: 0,
                  totalPresentCredits: 0,
                  presentCount: 0,
                  lateCount: 0,
                  absentCount: 0,
                  excusedCount: 0,
                  unrecordedClosedCount: 0,
                };

                return (
                  <PercentageGaugeCard
                    key={course.id}
                    metrics={metric}
                    title={course.courseCode}
                    subtitle={course.title}
                  />
                );
              })}
            </div>
          </div>

          {/* Recent Attendance Proofs */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="text-sm font-bold text-slate-900">
                Recent Attendance Proofs
              </h3>
              <Link
                href="/student/history"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                View All Records &rarr;
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recentRecords.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No attendance records recorded yet.
                </div>
              ) : (
                recentRecords.slice(0, 5).map((record) => (
                  <div
                    key={record.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-4 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {record.courseCode} — {record.sessionTopic}
                      </div>
                      <div className="mt-0.5 text-slate-500">
                        Session #{record.onChainSessionId} &bull;{" "}
                        {new Date(record.sessionStartTime).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={
                          record.effectiveStatus === "PRESENT"
                            ? "present"
                            : record.effectiveStatus === "LATE"
                              ? "late"
                              : record.effectiveStatus === "EXCUSED"
                                ? "excused"
                                : "absent"
                        }
                      >
                        {record.effectiveStatus}
                      </Badge>
                      {record.txHash ? (
                        <Link
                          href={`/verify?tx=${record.txHash}`}
                          className="font-mono text-indigo-600 hover:underline"
                        >
                          {record.txHash.slice(0, 8)}...
                        </Link>
                      ) : (
                        <span className="text-slate-400">Staged</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
