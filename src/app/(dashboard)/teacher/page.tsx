"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Calendar,
  Clock,
  Plus,
  RefreshCw,
  Users,
  Radio,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useWallet } from "@/lib/blockchain/wallet";
import type { Course, LectureSession } from "@/types";

export default function TeacherDashboardPage() {
  const { account } = useWallet();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<LectureSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [coursesRes, sessionsRes] = await Promise.all([
        fetch("/api/courses"),
        fetch("/api/sessions"),
      ]);

      if (!coursesRes.ok) throw new Error("Failed to load assigned courses");
      if (!sessionsRes.ok) throw new Error("Failed to load lecture sessions");

      const coursesData = await coursesRes.json();
      const sessionsData = await sessionsRes.json();

      setCourses(coursesData.courses || []);
      setSessions(sessionsData.sessions || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openSessions = sessions.filter((s) => s.status === "OPEN");
  const closedSessions = sessions.filter((s) => s.status === "CLOSED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Faculty Workspace
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-500">
              Screen 4
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Teacher Lecture & Attendance Workspace
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Open new lecture sessions, project live rotating dynamic QR codes,
            and review confirmed batch commitments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={loadData}
            isLoading={isLoading}
            aria-label="Refresh workspace"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </Button>

          <Link href="/teacher/lectures/new">
            <Button variant="primary">
              <Plus className="h-4 w-4" />
              <span>Open New Lecture Session</span>
            </Button>
          </Link>
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

      {/* Active / In-Progress Sessions Banner */}
      {openSessions.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <Radio className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone="present">LIVE IN PROGRESS</Badge>
                  <span className="text-xs text-slate-500">
                    Session #{openSessions[0]?.onChainSessionId}
                  </span>
                </div>
                <h2 className="mt-1 text-base font-bold text-slate-900">
                  {openSessions[0]?.courseCode} — {openSessions[0]?.topic}
                </h2>
              </div>
            </div>

            <Link
              href={`/teacher/attendance/${openSessions[0]?.onChainSessionId}`}
            >
              <Button variant="primary">
                <span>Resume Attendance Marking</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Assigned Courses Section */}
      <section aria-labelledby="courses-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="courses-heading" className="text-lg font-bold text-slate-900">
            Assigned Teaching Courses ({courses.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              No academic courses assigned to this wallet yet.
            </div>
          ) : (
            courses.map((course) => (
              <Card
                key={course.id}
                className="transition-all hover:border-indigo-300"
              >
                <div className="flex items-start justify-between">
                  <Badge tone="brand" mono>
                    {course.courseCode}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    Semester {course.semester}
                  </span>
                </div>

                <h3 className="mt-3 text-base font-bold text-slate-900">
                  {course.title}
                </h3>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span>{course.enrolledStudentHashes.length} Enrolled</span>
                  </div>
                  <Link
                    href={`/teacher/lectures/new`}
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    Open Session →
                  </Link>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* Past Lecture Sessions */}
      <Card
        title={`Lecture Session History (${sessions.length})`}
        subtitle="Chronological log of open, closed, and committed sessions"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Session ID
                </th>
                <th scope="col" className="px-4 py-3">
                  Course
                </th>
                <th scope="col" className="px-4 py-3">
                  Topic / Syllabus
                </th>
                <th scope="col" className="px-4 py-3">
                  Start Time
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No lecture sessions recorded yet. Click "Open New Lecture
                    Session" to start.
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">
                      #{session.onChainSessionId}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {session.courseCode}
                    </td>
                    <td className="px-4 py-3">{session.topic}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(session.startTime).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          session.status === "OPEN"
                            ? "present"
                            : session.status === "CLOSED"
                              ? "neutral"
                              : "absent"
                        }
                      >
                        {session.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/teacher/attendance/${session.onChainSessionId}`}
                        className="text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        {session.status === "OPEN"
                          ? "Mark Attendance →"
                          : "View Summary →"}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
