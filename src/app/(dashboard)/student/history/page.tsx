"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  FileCheck2,
  History,
  FileQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PercentageGaugeCard } from "@/components/attendance/PercentageGaugeCard";
import type {
  AttendanceRecordView,
  AttendanceStatus,
  AttendancePercentageMetrics,
  Course,
} from "@/types";

export default function StudentAttendanceHistoryPage() {
  const [records, setRecords] = useState<AttendanceRecordView[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [metrics, setMetrics] = useState<AttendancePercentageMetrics | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCourse, setSelectedCourse] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [coursesRes, attRes] = await Promise.all([
        fetch("/api/courses"),
        fetch("/api/attendance"),
      ]);

      if (coursesRes.ok) {
        const cData = await coursesRes.json();
        setCourses(cData.courses || []);
      }

      if (attRes.ok) {
        const aData = await attRes.json();
        setRecords(aData.records || []);
        setMetrics(aData.metrics || null);
      } else {
        const aData = await attRes.json();
        throw new Error(
          aData.error?.message || "Failed to load attendance history"
        );
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error loading attendance history"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Filtered records
  const filteredRecords = records.filter((rec) => {
    if (selectedCourse !== "ALL" && rec.courseCode !== selectedCourse) {
      return false;
    }
    if (selectedStatus !== "ALL" && rec.effectiveStatus !== selectedStatus) {
      return false;
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Student Records
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-500">
              Screen 11
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Student Attendance History
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Chronological log of verified lecture attendances, on-chain
            transaction hashes, and dispute actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={loadHistory}
            isLoading={isLoading}
            aria-label="Refresh attendance records"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </Button>
          <Link href="/student">
            <Button variant="ghost">Back to Dashboard</Button>
          </Link>
        </div>
      </header>

      {/* Metrics Banner */}
      {metrics && (
        <div className="mt-6">
          <PercentageGaugeCard
            metrics={metrics}
            title={
              selectedCourse === "ALL"
                ? "Overall Academic Standing"
                : `${selectedCourse} Standing`
            }
            subtitle={
              selectedCourse === "ALL"
                ? "Cumulative attendance percentage across all enrolled subjects"
                : `Filtered attendance performance for ${selectedCourse}`
            }
          />
        </div>
      )}

      {/* Filters Card */}
      <Card className="mt-6 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Filter Records
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="course-filter" className="sr-only">
                Filter by Course
              </label>
              <select
                id="course-filter"
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
              >
                <option value="ALL">All Enrolled Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.courseCode}>
                    {c.courseCode} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="status-filter" className="sr-only">
                Filter by Status
              </label>
              <select
                id="status-filter"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
              >
                <option value="ALL">All Attendance Statuses</option>
                <option value="PRESENT">PRESENT</option>
                <option value="LATE">LATE</option>
                <option value="EXCUSED">EXCUSED</option>
                <option value="ABSENT">ABSENT</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Attendance History Table (FR-012, FR-014) */}
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th scope="col" className="px-5 py-3.5">
                  Session & Date
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Course
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Status
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Method
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Blockchain Proof
                </th>
                <th scope="col" className="px-5 py-3.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-slate-500"
                  >
                    No attendance records match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-slate-50/75 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">
                        #{record.onChainSessionId} — {record.sessionTopic}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {new Date(record.sessionStartTime).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-semibold text-indigo-700">
                        {record.courseCode}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge
                        status={record.effectiveStatus}
                        amended={record.amendmentCount > 0}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px]">
                        {record.checkInMethod}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {record.txHash ? (
                        <div className="flex items-center gap-1.5 font-mono text-indigo-600">
                          <Link
                            href={`/verify?tx=${record.txHash}`}
                            className="hover:underline flex items-center gap-1"
                          >
                            <span>{record.txHash.slice(0, 10)}...</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-sans">
                          Pending On-Chain Commit
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/corrections?session=${record.onChainSessionId}`}
                        className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        <FileQuestion className="h-3.5 w-3.5" />
                        <span>Dispute</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
