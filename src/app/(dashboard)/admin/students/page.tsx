"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Users,
  UserCheck,
  ShieldAlert,
  Plus,
  RefreshCw,
  Hash,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useWallet } from "@/lib/blockchain/wallet";
import { computeStudentIdHash } from "@/lib/attendance/identity";
import type { StudentProfile, Course } from "@/types";

// Demonstration constant salt for preview (TR-004)
const DEMO_SALT =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

export default function AdminStudentsPage() {
  const { account, isSupportedNetwork } = useWallet();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [syntheticRollNo, setSyntheticRollNo] = useState("");
  const [syntheticName, setSyntheticName] = useState("");
  const [department, setDepartment] = useState(
    "Computer Science & Engineering"
  );
  const [semester, setSemester] = useState(7);
  const [walletAddress, setWalletAddress] = useState("");
  const [isPending, startTransition] = useTransition();

  // Cohort enrollment state
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedStudentHashes, setSelectedStudentHashes] = useState<string[]>(
    []
  );
  const [isEnrolling, setIsEnrolling] = useState(false);

  // Live preview of studentIdHash
  const [previewHash, setPreviewHash] = useState<string | null>(null);

  useEffect(() => {
    if (syntheticRollNo.trim().toUpperCase().startsWith("SYN-")) {
      try {
        const hash = computeStudentIdHash(
          DEMO_SALT,
          syntheticRollNo.trim().toUpperCase()
        );
        setPreviewHash(hash);
      } catch {
        setPreviewHash(null);
      }
    } else {
      setPreviewHash(null);
    }
  }, [syntheticRollNo]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [studentsRes, coursesRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/courses"),
      ]);

      if (!studentsRes.ok) throw new Error("Failed to load students");
      if (!coursesRes.ok) throw new Error("Failed to load courses");

      const studentsData = await studentsRes.json();
      const coursesData = await coursesRes.json();

      setStudents(studentsData.students || []);
      setCourses(coursesData.courses || []);
      if (coursesData.courses?.length > 0 && !selectedCourseId) {
        setSelectedCourseId(coursesData.courses[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!syntheticRollNo.startsWith("SYN-")) {
      setError(
        "Invalid roll number. AttendChain strictly requires synthetic roll numbers starting with 'SYN-' (e.g., SYN-2026-042)."
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            syntheticRollNo: syntheticRollNo.trim().toUpperCase(),
            syntheticName: syntheticName.trim(),
            department,
            semester: Number(semester),
            walletAddress: walletAddress.trim() || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Failed to register student");
        }

        setSuccessMsg(
          `Registered student ${data.student.syntheticRollNo} with claim code ${data.student.claimCode}`
        );
        setSyntheticRollNo("");
        setSyntheticName("");
        setWalletAddress("");
        await loadData();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Registration failed");
      }
    });
  };

  const toggleSelectStudent = (hash: string) => {
    setSelectedStudentHashes((prev) =>
      prev.includes(hash) ? prev.filter((h) => h !== hash) : [...prev, hash]
    );
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
              Screen 6
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Student Identity Registration
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Register synthetic student profiles with salted{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-800">
              bytes32 studentIdHash
            </code>{" "}
            commitments. Zero student PII ever touches the blockchain.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={loadData}
          isLoading={isLoading}
          aria-label="Refresh student list"
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

      {/* Grid: Registration Form & Live Hash Preview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Registration Form */}
        <div className="lg:col-span-2">
          <Card
            title="Register Synthetic Student"
            subtitle="Generates pseudonymous credentials and individual claim codes (FR-004, FR-005)"
          >
            <form onSubmit={handleRegisterStudent} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="syntheticRollNo"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Synthetic Roll Number *
                  </label>
                  <input
                    id="syntheticRollNo"
                    type="text"
                    required
                    value={syntheticRollNo}
                    onChange={(e) => setSyntheticRollNo(e.target.value)}
                    placeholder="SYN-2026-042"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Must start with <span className="font-mono">SYN-</span>{" "}
                    (strictly enforced).
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="syntheticName"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Synthetic Name *
                  </label>
                  <input
                    id="syntheticName"
                    type="text"
                    required
                    value={syntheticName}
                    onChange={(e) => setSyntheticName(e.target.value)}
                    placeholder="Aarav Mehta"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="department"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Department
                  </label>
                  <input
                    id="department"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  />
                </div>

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
                    htmlFor="walletAddress"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Pre-bound Wallet (Optional)
                  </label>
                  <input
                    id="walletAddress"
                    type="text"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="0x..."
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              {/* Cryptographic Preview Callout */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-semibold uppercase tracking-wider text-slate-700">
                    Live On-Chain Commitment Preview:
                  </span>
                  <Badge tone={previewHash ? "brand" : "neutral"} mono>
                    {previewHash ? "Valid Hash" : "Awaiting SYN-"}
                  </Badge>
                </div>
                <div className="mt-2 font-mono text-slate-800 break-all">
                  {previewHash ||
                    "keccak256(InstitutionSaltCommitment, SYN-XXXX-YYY)"}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isPending}
                  loadingText="Registering..."
                >
                  <Plus className="h-4 w-4" />
                  <span>Register Synthetic Student</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Privacy Lock Architecture Card */}
        <div>
          <Card
            title="Zero-PII Privacy Lock"
            subtitle="Architecture verification (NFR-001, TR-004)"
          >
            <div className="space-y-4 text-xs text-slate-600">
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
                <div className="flex items-center gap-1.5 font-semibold text-indigo-950">
                  <Hash className="h-4 w-4 text-indigo-600" />
                  <span>Deterministic Hash Formula</span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-indigo-900">
                  studentIdHash = keccak256(SALT || rollNo)
                </p>
              </div>

              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    Student names and roll numbers remain strictly in off-chain
                    database.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    Only the 32-byte hash commitment is enrolled on Ethereum.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    On data erasure, deleting the database record renders
                    on-chain hashes permanently unlinkable.
                  </span>
                </li>
              </ul>
            </div>
          </Card>
        </div>
      </div>

      {/* Registered Students Roster */}
      <Card
        title={`Registered Student Roster (${students.length})`}
        subtitle="Select students to preview cohort enrollment into courses"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Select
                </th>
                <th scope="col" className="px-4 py-3">
                  Synthetic Roll
                </th>
                <th scope="col" className="px-4 py-3">
                  Synthetic Name
                </th>
                <th scope="col" className="px-4 py-3">
                  Commitment Hash (studentIdHash)
                </th>
                <th scope="col" className="px-4 py-3">
                  Claim Code
                </th>
                <th scope="col" className="px-4 py-3">
                  Wallet Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No students registered yet.
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const isSelected = selectedStudentHashes.includes(
                    student.studentIdHash
                  );
                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-slate-50 ${
                        isSelected ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            toggleSelectStudent(student.studentIdHash)
                          }
                          aria-label={`Select ${student.syntheticRollNo}`}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {student.syntheticRollNo}
                      </td>
                      <td className="px-4 py-3">{student.syntheticName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        <span title={student.studentIdHash}>
                          {student.studentIdHash.slice(0, 10)}...
                          {student.studentIdHash.slice(-8)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <Badge tone="brand">{student.claimCode}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {student.walletAddress ? (
                          <span className="font-mono text-xs text-emerald-700">
                            {student.walletAddress.slice(0, 6)}...
                            {student.walletAddress.slice(-4)}
                          </span>
                        ) : (
                          <Badge tone="neutral">Unclaimed</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
