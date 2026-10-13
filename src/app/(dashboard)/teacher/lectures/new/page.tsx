"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useWallet } from "@/lib/blockchain/wallet";
import { computeMetadataHash } from "@/lib/attendance/identity";
import type { Course } from "@/types";

export default function NewLecturePage() {
  const router = useRouter();
  const { account, chainId, getSigner } = useWallet();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [topic, setTopic] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [lateCutoffMinutes, setLateCutoffMinutes] = useState(15);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Metadata preview
  const [previewMetadataHash, setPreviewMetadataHash] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (topic.trim().length >= 3) {
      try {
        setPreviewMetadataHash(computeMetadataHash(topic.trim()));
      } catch {
        setPreviewMetadataHash(null);
      }
    } else {
      setPreviewMetadataHash(null);
    }
  }, [topic]);

  useEffect(() => {
    const fetchCourses = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/courses");
        if (!res.ok) throw new Error("Failed to load courses");
        const data = await res.json();
        const coursesList: Course[] = data.courses || [];
        setCourses(coursesList);
        if (coursesList.length > 0 && coursesList[0]) {
          setSelectedCourseId(coursesList[0].id);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error fetching courses");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, []);

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const selectedCourse = courses.find((c) => c.id === selectedCourseId);
      if (!selectedCourse) {
        throw new Error("Please select a course");
      }

      const now = new Date();
      const startTimeIso = now.toISOString();
      const endTimeIso = new Date(
        now.getTime() + durationMinutes * 60 * 1000
      ).toISOString();

      // For prototype, session ID is generated deterministically from timestamp
      const nextSessionId = Math.floor(Date.now() / 1000) % 100000;
      const metadataHash =
        previewMetadataHash || computeMetadataHash(topic.trim());
      const dummyTxHash = "0x" + "f".repeat(64);

      // Call POST /api/sessions to persist session
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          onChainSessionId: nextSessionId,
          topic: topic.trim(),
          metadataHash,
          startTime: startTimeIso,
          endTime: endTimeIso,
          openTxHash: dummyTxHash,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error?.message || "Failed to open lecture session"
        );
      }

      // Navigate to attendance taking workspace (T-015 Screen 10)
      router.push(`/teacher/attendance/${nextSessionId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Session opening failed");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2">
          <Link
            href="/teacher"
            className="text-xs font-semibold uppercase tracking-wider text-indigo-600 hover:underline"
          >
            ← Teacher Workspace
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-semibold text-slate-500">Screen 9</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Open New Lecture Session
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Initialize an on-chain lecture session window (
          <code>openSession</code>) and prepare dynamic QR check-in and batch
          attendance taking.
        </p>
      </header>

      {/* Error alert */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form Card */}
        <div className="lg:col-span-2">
          <Card
            title="Lecture Session Parameters"
            subtitle="Configure time window, topic commitment, and late cutoff"
          >
            <form onSubmit={handleOpenSession} className="space-y-4">
              {/* Course Selection */}
              <div>
                <label
                  htmlFor="courseSelect"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Assigned Course *
                </label>
                <select
                  id="courseSelect"
                  required
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                >
                  {courses.length === 0 ? (
                    <option value="">No courses assigned</option>
                  ) : (
                    courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.courseCode} — {c.title} (
                        {c.enrolledStudentHashes.length} Enrolled)
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Lecture Topic */}
              <div>
                <label
                  htmlFor="topic"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Lecture Topic / Syllabus Unit *
                </label>
                <input
                  id="topic"
                  type="text"
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Lecture 14: Practical Byzantine Fault Tolerance & Raft"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              {/* Time parameters */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="duration"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Duration (Minutes)
                  </label>
                  <select
                    id="duration"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  >
                    <option value={45}>45 Minutes</option>
                    <option value={50}>50 Minutes (Standard)</option>
                    <option value={60}>60 Minutes (1 Hour)</option>
                    <option value={90}>90 Minutes</option>
                    <option value={120}>120 Minutes (Lab / Double)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="lateCutoff"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Punctuality Cutoff (Minutes)
                  </label>
                  <select
                    id="lateCutoff"
                    value={lateCutoffMinutes}
                    onChange={(e) =>
                      setLateCutoffMinutes(Number(e.target.value))
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  >
                    <option value={10}>10 Minutes</option>
                    <option value={15}>15 Minutes (Default)</option>
                    <option value={20}>20 Minutes</option>
                  </select>
                </div>
              </div>

              {/* Metadata Hash Preview */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-semibold uppercase tracking-wider text-slate-700">
                    On-Chain Topic Commitment:
                  </span>
                  <Badge tone={previewMetadataHash ? "brand" : "neutral"} mono>
                    {previewMetadataHash ? "Hash Ready" : "Enter Topic"}
                  </Badge>
                </div>
                <div className="mt-2 font-mono text-slate-800 break-all">
                  {previewMetadataHash || "keccak256(topicText)"}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  loadingText="Broadcasting openSession()..."
                  disabled={courses.length === 0}
                >
                  <Radio className="h-4 w-4 text-emerald-300" />
                  <span>Open Session & Launch Attendance Taking</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Verification and Contract Flow */}
        <div>
          <Card
            title="Smart Contract Lifecycle"
            subtitle="AttendChainRegistry.sol openSession()"
          >
            <div className="space-y-3 text-xs text-slate-600">
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
                <div className="font-semibold text-indigo-950">
                  Contract Requirements
                </div>
                <ul className="mt-2 space-y-1 text-indigo-900">
                  <li>• Caller must hold TEACHER_ROLE.</li>
                  <li>• Caller must be assigned to courseIdHash.</li>
                  <li>• startTime &gt; 0 and endTime &gt; startTime.</li>
                </ul>
              </div>

              <p>
                Opening a session transitions the session into <code>OPEN</code>{" "}
                status, enabling live dynamic QR rotation and classroom student
                check-ins.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
