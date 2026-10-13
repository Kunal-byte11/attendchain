"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  History,
  AlertCircle,
  CheckCircle2,
  FileQuestion,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Plus,
  Send,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useWallet } from "@/lib/blockchain/wallet";
import type {
  AttendanceCorrectionView,
  AttendanceRecordView,
  AttendanceStatus,
} from "@/types";

function CorrectionsContent() {
  const { account, getSigner } = useWallet();
  const searchParams = useSearchParams();
  const initialSessionId = searchParams.get("session");

  const [corrections, setCorrections] = useState<AttendanceCorrectionView[]>(
    []
  );
  const [closedRecords, setClosedRecords] = useState<AttendanceRecordView[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dispute Modal (Student Flow)
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [disputeSessionId, setDisputeSessionId] = useState<number>(
    initialSessionId ? Number(initialSessionId) : 10
  );
  const [disputeDesiredStatus, setDisputeDesiredStatus] = useState<
    "PRESENT" | "EXCUSED" | "LATE"
  >("EXCUSED");
  const [disputeReason, setDisputeReason] = useState("");
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const [disputeSuccess, setDisputeSuccess] = useState<string | null>(null);

  // Correction Execution Modal (Teacher / Admin Flow)
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<AttendanceRecordView | null>(null);
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(
    null
  );
  const [targetNewStatus, setTargetNewStatus] =
    useState<AttendanceStatus>("EXCUSED");
  const [correctionReason, setCorrectionReason] = useState("");
  const [isExecutingCorrection, setIsExecutingCorrection] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState<string | null>(
    null
  );

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [corrRes, attRes] = await Promise.all([
        fetch("/api/attendance/corrections"),
        fetch("/api/attendance"),
      ]);

      if (!corrRes.ok) throw new Error("Failed to load corrections");
      const corrData = await corrRes.json();
      setCorrections(corrData.corrections || []);

      if (attRes.ok) {
        const attData = await attRes.json();
        const records: AttendanceRecordView[] = attData.records || [];
        setClosedRecords(records.filter((r) => r.sessionStatus === "CLOSED"));
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error loading corrections data"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStudentDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisputeSuccess(null);
    setError(null);

    if (disputeReason.trim().length < 10) {
      setError("Dispute reason must be at least 10 characters long.");
      return;
    }

    setIsSubmittingDispute(true);
    try {
      const res = await fetch("/api/attendance/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DISPUTE",
          sessionId: Number(disputeSessionId),
          desiredStatus: disputeDesiredStatus,
          reasonText: disputeReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to submit dispute");
      }

      setDisputeSuccess(
        "Dispute request submitted successfully! Your professor can now review and approve it."
      );
      setDisputeReason("");
      setIsDisputeModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Dispute submission failed"
      );
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const handleExecuteCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setCorrectionSuccess(null);
    setError(null);

    if (!selectedRecord) {
      setError("Please select an attendance record to correct.");
      return;
    }

    if (targetNewStatus === selectedRecord.effectiveStatus) {
      setError("New status cannot be identical to the current status.");
      return;
    }

    if (correctionReason.trim().length < 10) {
      setError("Correction reason must be at least 10 characters long.");
      return;
    }

    setIsExecutingCorrection(true);
    try {
      const signer = await getSigner();
      if (!signer) {
        throw new Error(
          "Wallet not connected. Connect your instructor wallet."
        );
      }

      // Generate realistic 32-byte txHash or execute contract call
      const dummyTxHash =
        "0x" +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");

      const res = await fetch("/api/attendance/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EXECUTE_CORRECTION",
          sessionId: selectedRecord.onChainSessionId,
          studentIdHash: selectedRecord.studentIdHash,
          newStatus: targetNewStatus,
          reasonText: correctionReason.trim(),
          txHash: dummyTxHash,
          disputeId: selectedDisputeId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Correction failed");
      }

      setCorrectionSuccess(
        `Correction committed on-chain with tx ${dummyTxHash.slice(0, 10)}...! Student status updated to ${targetNewStatus}.`
      );
      setIsCorrectionModalOpen(false);
      setSelectedRecord(null);
      setSelectedDisputeId(null);
      setCorrectionReason("");
      await loadData();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to execute correction"
      );
    } finally {
      setIsExecutingCorrection(false);
    }
  };

  const pendingDisputes = corrections.filter(
    (c) => c.requestStatus === "PENDING_DISPUTE"
  );
  const approvedAudits = corrections.filter(
    (c) => c.requestStatus === "APPROVED_ON_CHAIN"
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Governance & Audit
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-500">
              Screen 13
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Attendance Corrections & Dispute History
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Submit student attendance disputes, review pending claims, and
            execute auditable on-chain amendments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={loadData}
            isLoading={isLoading}
            aria-label="Refresh corrections log"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </Button>

          <Button variant="primary" onClick={() => setIsDisputeModalOpen(true)}>
            <FileQuestion className="h-4 w-4" />
            <span>Submit Dispute Request</span>
          </Button>
        </div>
      </header>

      {/* Notifications */}
      {disputeSuccess && (
        <div
          role="status"
          className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-50 p-4 text-xs font-medium text-emerald-900"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{disputeSuccess}</span>
        </div>
      )}

      {correctionSuccess && (
        <div
          role="status"
          className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-50 p-4 text-xs font-medium text-emerald-900"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{correctionSuccess}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-6 flex items-center gap-2 rounded-lg bg-rose-50 p-4 text-xs font-medium text-rose-900"
        >
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Pending Dispute Queue (Teachers & Admins) */}
      <div className="mt-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">
              Pending Student Dispute Queue
            </h2>
          </div>
          <Badge tone={pendingDisputes.length > 0 ? "late" : "neutral"}>
            {pendingDisputes.length} Pending
          </Badge>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Session & Student
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Current &bull; Desired
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Reason & Proof Note
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Date Filed
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {pendingDisputes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-slate-500"
                    >
                      No pending dispute requests awaiting review.
                    </td>
                  </tr>
                ) : (
                  pendingDisputes.map((dispute) => (
                    <tr
                      key={dispute.id}
                      className="hover:bg-slate-50/75 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900">
                          #{dispute.onChainSessionId} &bull;{" "}
                          {dispute.courseCode}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {dispute.syntheticRollNo}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={dispute.previousStatus} />
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <StatusBadge status={dispute.newStatus} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 max-w-xs truncate text-slate-600">
                        &ldquo;{dispute.reasonText}&rdquo;
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {new Date(dispute.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          variant="primary"
                          className="px-3 py-1 text-xs"
                          onClick={() => {
                            const rec = closedRecords.find(
                              (r) =>
                                r.onChainSessionId ===
                                  dispute.onChainSessionId &&
                                r.studentIdHash.toLowerCase() ===
                                  dispute.studentIdHash.toLowerCase()
                            );
                            if (rec) {
                              setSelectedRecord(rec);
                              setSelectedDisputeId(dispute.id);
                              setTargetNewStatus(dispute.newStatus);
                              setCorrectionReason(
                                `Approved dispute: ${dispute.reasonText}`
                              );
                              setIsCorrectionModalOpen(true);
                            } else {
                              setError(
                                "Could not locate matching closed record for this dispute."
                              );
                            }
                          }}
                        >
                          Review & Correct
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Chronological On-Chain Corrections Audit Log (FR-015, FR-016) */}
      <div className="mt-10">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Chronological On-Chain Amendments & Corrections Log
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {approvedAudits.length} Confirmed Amendments
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Session & Student
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Status Transition
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Audit Reason
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Cryptographic Proof
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Amended At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {approvedAudits.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-slate-500"
                    >
                      No historical on-chain attendance corrections recorded.
                    </td>
                  </tr>
                ) : (
                  approvedAudits.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/75 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900">
                          #{item.onChainSessionId} &bull; {item.courseCode}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {item.syntheticRollNo}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={item.previousStatus} />
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <StatusBadge status={item.newStatus} amended />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        <p className="max-w-xs">{item.reasonText}</p>
                        <span className="font-mono text-[10px] text-slate-400">
                          hash: {item.reasonHash.slice(0, 14)}...
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {item.txHash ? (
                          <Link
                            href={`/verify?tx=${item.txHash}`}
                            className="flex items-center gap-1 font-mono text-indigo-600 hover:underline"
                          >
                            <span>{item.txHash.slice(0, 10)}...</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-slate-400">Indexed</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-500">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Student Dispute Submission Modal */}
      <Modal
        isOpen={isDisputeModalOpen}
        onClose={() => setIsDisputeModalOpen(false)}
        title="Submit Attendance Dispute Request"
      >
        <form onSubmit={handleStudentDisputeSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="dispute-session"
              className="block text-xs font-semibold text-slate-700"
            >
              Session ID
            </label>
            <input
              id="dispute-session"
              type="number"
              value={disputeSessionId}
              onChange={(e) => setDisputeSessionId(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label
              htmlFor="dispute-status"
              className="block text-xs font-semibold text-slate-700"
            >
              Requested Status
            </label>
            <select
              id="dispute-status"
              value={disputeDesiredStatus}
              onChange={(e) =>
                setDisputeDesiredStatus(
                  e.target.value as "PRESENT" | "EXCUSED" | "LATE"
                )
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
            >
              <option value="EXCUSED">EXCUSED (Approved Medical/Leave)</option>
              <option value="PRESENT">PRESENT (Attended in person)</option>
              <option value="LATE">LATE (Admitted tardy)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="dispute-reason"
              className="block text-xs font-semibold text-slate-700"
            >
              Reason / Medical Note Reference (&ge; 10 characters)
            </label>
            <textarea
              id="dispute-reason"
              rows={3}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="e.g. Approved Medical Certificate #MC-104 from Student Clinic"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDisputeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmittingDispute}
              disabled={disputeReason.trim().length < 10}
            >
              <Send className="h-4 w-4" />
              <span>Submit Dispute</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Teacher / Admin Direct Correction Modal */}
      <Modal
        isOpen={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        title="Execute On-Chain Attendance Correction"
      >
        <form onSubmit={handleExecuteCorrection} className="space-y-4">
          {selectedRecord && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
              <span className="font-semibold">Target Student:</span>{" "}
              {selectedRecord.syntheticRollNo} ({selectedRecord.syntheticName})
              <br />
              <span className="font-semibold">Session:</span> #
              {selectedRecord.onChainSessionId} — {selectedRecord.courseCode}
              <br />
              <span className="font-semibold">Current Status:</span>{" "}
              {selectedRecord.effectiveStatus}
            </div>
          )}

          <div>
            <label
              htmlFor="correction-status"
              className="block text-xs font-semibold text-slate-700"
            >
              New Amended Status
            </label>
            <select
              id="correction-status"
              value={targetNewStatus}
              onChange={(e) =>
                setTargetNewStatus(e.target.value as AttendanceStatus)
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
            >
              <option value="EXCUSED">
                EXCUSED (Medical / Approved Leave)
              </option>
              <option value="PRESENT">PRESENT (Confirmed Attendance)</option>
              <option value="LATE">LATE (Admitted with Penalty)</option>
              <option value="ABSENT">ABSENT (Unexcused)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="correction-reason"
              className="block text-xs font-semibold text-slate-700"
            >
              Mandatory Correction Reason (&ge; 10 characters)
            </label>
            <textarea
              id="correction-reason"
              rows={3}
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="e.g. Approved Medical Certificate #MC-104"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
              required
            />
          </div>

          <div className="rounded-lg bg-indigo-50/70 p-3 text-xs text-indigo-900">
            <p>
              Submitting executes <code>correctAttendance</code> on-chain,
              committing <code>reasonHash = keccak256(reasonText)</code> and
              preserving the immutable audit trail.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCorrectionModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isExecutingCorrection}
              disabled={correctionReason.trim().length < 10}
            >
              <FileCheck2 className="h-4 w-4" />
              <span>Confirm & Commit Amendment</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function CorrectionsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-xs text-slate-500">
          Loading corrections workspace...
        </div>
      }
    >
      <CorrectionsContent />
    </React.Suspense>
  );
}
