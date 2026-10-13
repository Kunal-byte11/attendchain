"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Users,
  GraduationCap,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useWallet } from "@/lib/blockchain/wallet";
import type { Course, StudentProfile, RoleAssignment } from "@/types";

export default function AdminCoursesPage() {
  const { account } = useWallet();
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [teachers, setTeachers] = useState<RoleAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [courseCode, setCourseCode] = useState("");
  const [title, setTitle] = useState("");
  const [semester, setSemester] = useState(7);
  const [teacherWallet, setTeacherWallet] = useState("");
  const [selectedStudentHashes, setSelectedStudentHashes] = useState<string[]>(
    []
  );
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [coursesRes, studentsRes, rolesRes] = await Promise.all([
        fetch("/api/courses"),
        fetch("/api/students"),
        fetch("/api/roles?role=TEACHER_ROLE"),
      ]);

      if (!coursesRes.ok) throw new Error("Failed to load courses");
      if (!studentsRes.ok) throw new Error("Failed to load students");

      const coursesData = await coursesRes.json();
      const studentsData = await studentsRes.json();
      const rolesData = rolesRes.ok ? await rolesRes.json() : { roles: [] };

      setCourses(coursesData.courses || []);
      setStudents(studentsData.students || []);
      setTeachers(rolesData.roles || []);

      if (rolesData.roles?.length > 0 && !teacherWallet) {
        setTeacherWallet(rolesData.roles[0].walletAddress);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error loading courses data"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const dummyTxHash = "0x" + "c".repeat(64);

    startTransition(async () => {
      try {
        const res = await fetch("/api/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseCode: courseCode.trim().toUpperCase(),
            title: title.trim(),
            semester: Number(semester),
            teacherWallet: teacherWallet.trim(),
            txHash: dummyTxHash,
            enrollStudentHashes: selectedStudentHashes,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Failed to create course");
        }

        setSuccessMsg(
          `Course ${data.course.courseCode} created successfully with ${selectedStudentHashes.length} enrolled students.`
        );
        setCourseCode("");
        setTitle("");
        setSelectedStudentHashes([]);
        await loadData();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Course creation failed");
      }
    });
  };

  const toggleStudentEnrollment = (hash: string) => {
    setSelectedStudentHashes((prev) =>
      prev.includes(hash) ? prev.filter((h) => h !== hash) : [...prev, hash]
    );
  };

  const selectAllStudents = () => {
    if (selectedStudentHashes.length === students.length) {
      setSelectedStudentHashes([]);
    } else {
      setSelectedStudentHashes(students.map((s) => s.studentIdHash));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="text-xs font-semibold uppercase tracking-wider text-indigo-600 hover:underline"
            >
              ← Admin Workspace
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-500">
              Screen 8
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Course Management & Cohort Enrollment
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Create academic courses, assign faculty instructors, and
            batch-enroll student cohorts into smart contract registry.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={loadData}
          isLoading={isLoading}
          aria-label="Refresh courses list"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
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

      {/* Course Creation & Cohort Selector */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            title="Create New Course"
            subtitle="Registers course and assigns faculty instructor (FR-006, TR-005)"
          >
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="courseCode"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Course Code *
                  </label>
                  <input
                    id="courseCode"
                    type="text"
                    required
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="CS701"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="title"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Course Title *
                  </label>
                  <input
                    id="title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Distributed Systems & Blockchain"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="semester"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Semester
                  </label>
                  <select
                    id="semester"
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="teacherWallet"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Assigned Faculty Instructor *
                  </label>
                  <input
                    id="teacherWallet"
                    type="text"
                    required
                    value={teacherWallet}
                    onChange={(e) => setTeacherWallet(e.target.value)}
                    placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              {/* Student Cohort Selector */}
              <div>
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Select Students to Batch-Enroll (
                    {selectedStudentHashes.length} selected)
                  </span>
                  <button
                    type="button"
                    onClick={selectAllStudents}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    {selectedStudentHashes.length === students.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                  {students.length === 0 ? (
                    <p className="p-3 text-center text-xs text-slate-500">
                      No synthetic students registered yet.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {students.map((student) => {
                        const checked = selectedStudentHashes.includes(
                          student.studentIdHash
                        );
                        return (
                          <label
                            key={student.id}
                            className="flex cursor-pointer items-center justify-between rounded p-2 text-xs hover:bg-slate-100"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  toggleStudentEnrollment(student.studentIdHash)
                                }
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                              />
                              <span className="font-semibold text-slate-900">
                                {student.syntheticRollNo}
                              </span>
                              <span className="text-slate-600">
                                ({student.syntheticName})
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-400">
                              {student.studentIdHash.slice(0, 10)}...
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isPending}
                  loadingText="Creating Course..."
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Course & Enroll Cohort</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Info Card */}
        <div>
          <Card
            title="Batch Enrollment Architecture"
            subtitle="Gas efficiency (FR-007, TR-005)"
          >
            <div className="space-y-3 text-xs text-slate-600">
              <p>In AttendChain, courses are identified on-chain by:</p>
              <div className="rounded bg-slate-100 p-2 font-mono text-[11px] text-slate-800">
                courseIdHash = keccak256(courseCode)
              </div>
              <p>
                Enrolling students calls <code>enrollStudentsBatch</code> on the
                smart contract with up to 100 <code>studentIdHash</code>{" "}
                commitments per transaction.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Courses List */}
      <Card
        title={`Active Academic Courses (${courses.length})`}
        subtitle="Courses registered with on-chain assignments"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Code
                </th>
                <th scope="col" className="px-4 py-3">
                  Title
                </th>
                <th scope="col" className="px-4 py-3">
                  Semester
                </th>
                <th scope="col" className="px-4 py-3">
                  Assigned Faculty Wallet
                </th>
                <th scope="col" className="px-4 py-3">
                  Enrolled Students
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No courses created yet.
                  </td>
                </tr>
              ) : (
                courses.map((course) => (
                  <tr key={course.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {course.courseCode}
                    </td>
                    <td className="px-4 py-3">{course.title}</td>
                    <td className="px-4 py-3">Semester {course.semester}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {course.teacherWallet.slice(0, 8)}...
                      {course.teacherWallet.slice(-6)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="brand">
                        {course.enrolledStudentHashes.length} Students
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={course.isActive ? "present" : "neutral"}>
                        {course.isActive ? "ACTIVE" : "INACTIVE"}
                      </Badge>
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
