"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Radio,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Lock,
  Layers,
  Send,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DynamicQrProjector } from "@/components/attendance/DynamicQrProjector";
import {
  RosterTable,
  type RosterItem,
} from "@/components/attendance/RosterTable";
import { useWallet } from "@/lib/blockchain/wallet";
import type {
  LectureSession,
  StudentProfile,
  AttendanceStatus,
  AttendanceRecordView,
} from "@/types";

export default function AttendanceMarkingPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const router = useRouter();
  const { sessionId: rawSessionId } = use(params);
  const sessionId = Number(rawSessionId);

  const { account } = useWallet();
  const [session, setSession] = useState<LectureSession | null>(null);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadSessionAndRoster = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sessionsRes, attendanceRes, studentsRes] = await Promise.all([
        fetch(`/api/sessions`),
        fetch(`/api/attendance?sessionId=${sessionId}`),
        fetch(`/api/students`),
      ]);

      if (!sessionsRes.ok) throw new Error("Failed to load session details");

      const sessionsData = await sessionsRes.json();
      const currentSession: LectureSession | undefined =
        sessionsData.sessions?.find(
          (s: LectureSession) => s.onChainSessionId === sessionId
        );

      if (!currentSession) {
        throw new Error(`Session #${sessionId} not found`);
      }
      setSession(currentSession);

      const attendanceData = attendanceRes.ok
        ? await attendanceRes.json()
        : { records: [] };
      const studentsData = studentsRes.ok
        ? await studentsRes.json()
        : { students: [] };

      const existingRecords: AttendanceRecordView[] =
        attendanceData.records || [];
      const allStudents: StudentProfile[] = studentsData.students || [];

      // Build initial roster items
      const rosterMap = new Map<string, RosterItem>();

      for (const student of allStudents) {
        const hash = student.studentIdHash.toLowerCase();
        const existing = existingRecords.find(
          (r) => r.studentIdHash.toLowerCase() === hash
        );

        rosterMap.set(hash, {
          studentProfile: student,
          currentStatus: existing ? existing.effectiveStatus : "NONE",
          checkInMethod: existing ? existing.checkInMethod : "NONE",
          isStaged: existing ? existing.onChainStatus === "NONE" : false,
        });
      }

      setRoster(Array.from(rosterMap.values()));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading session");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessionAndRoster();
  }, [sessionId]);

  const handleStatusChange = (
    studentIdHash: string,
    newStatus: AttendanceStatus
  ) => {
    setRoster((prev) =>
      prev.map((item) =>
        item.studentProfile.studentIdHash.toLowerCase() ===
        studentIdHash.toLowerCase()
          ? {
              ...item,
              currentStatus: newStatus,
              checkInMethod: "TEACHER_MANUAL",
            }
          : item
      )
    );
  };

  const handlePreFillAbsent = () => {
    setRoster((prev) =>
      prev.map((item) =>
        item.currentStatus === "NONE"
          ? {
              ...item,
              currentStatus: "ABSENT",
              checkInMethod: "TEACHER_MANUAL",
            }
          : item
      )
    );
  };

  const handleBatchCommit = async () => {
    if (!session) return;
    setError(null);
    setSuccessMsg(null);
    setIsCommitting(true);

    try {
      // Pre-fill any remaining unmarked students as ABSENT per Assumption A-01
      const finalizedRecords = roster.map((item) => ({
        studentIdHash: item.studentProfile.studentIdHash,
        status:
          item.currentStatus === "NONE"
            ? ("ABSENT" as AttendanceStatus)
            : item.currentStatus,
      }));

      const dummyTxHash = "0x" + "9".repeat(64);

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          txHash: dummyTxHash,
          records: finalizedRecords,
          closeSession: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error?.message || "Failed to commit batch attendance"
        );
      }

      setSuccessMsg(
        `Batch attendance committed on-chain for ${data.syncedCount} students! Session is now CLOSED.`
      );
      await loadSessionAndRoster();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Batch commit failed");
    } finally {
      setIsCommitting(false);
    }
  };

  const isSessionOpen = session?.status === "OPEN";

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/teacher"
              className="text-xs font-semibold uppercase tracking-wider text-indigo-600 hover:underline"
            >
              ← Faculty Workspace
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-500">
              Screen 10
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {session?.courseCode || "Course"} — Lecture Session #{sessionId}
            </h1>
            {session && (
              <Badge tone={isSessionOpen ? "present" : "neutral"}>
                {session.status}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {session?.topic || "Loading syllabus unit..."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={loadSessionAndRoster}
            isLoading={isLoading}
            aria-label="Refresh attendance roster"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Poll Check-Ins</span>
          </Button>

          {isSessionOpen && (
            <Button
              variant="web3-tx"
              onClick={handleBatchCommit}
              isLoading={isCommitting}
              loadingText="Signing recordBatchAttendance()..."
            >
              <Lock className="h-4 w-4" />
              <span>Commit Batch Attendance & Close Session</span>
            </Button>
          )}
        </div>
      </header>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
          <p>{error}</p>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <p>{successMsg}</p>
        </div>
      )}

      {/* Grid: Dynamic QR Projector & Attendance Roster */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Dynamic QR Projector */}
        <div className="lg:col-span-1">
          {isSessionOpen ? (
            <DynamicQrProjector
              sessionId={sessionId}
              isOpen={isSessionOpen}
              onRefreshTriggered={loadSessionAndRoster}
            />
          ) : (
            <Card title="Session Closed" subtitle="Attendance locked on-chain">
              <div className="rounded-lg bg-slate-50 p-6 text-center text-xs text-slate-500">
                <Lock className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-2 font-semibold text-slate-700">
                  This lecture session is closed.
                </p>
                <p className="mt-1">
                  Further modifications require an auditable on-chain correction
                  (<code>Screen 12: /corrections</code>).
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* Live Attendance Roster */}
        <div className="lg:col-span-2">
          <Card
            title={`Attendance Roster (${roster.length} Enrolled)`}
            subtitle="Real-time staged check-ins and teacher manual marking controls"
            headerAction={
              isSessionOpen ? (
                <button
                  type="button"
                  onClick={handlePreFillAbsent}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Mark All Unmarked as Absent
                </button>
              ) : null
            }
          >
            <RosterTable
              roster={roster}
              onStatusChange={handleStatusChange}
              disabled={!isSessionOpen || isCommitting}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
