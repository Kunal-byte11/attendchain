"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  Database,
  Blocks,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { VerificationDiffCard } from "@/components/attendance/VerificationDiffCard";
import type { BlockchainVerificationResult } from "@/lib/blockchain/verify";

function VerifyContent() {
  const searchParams = useSearchParams();
  const txQuery = searchParams.get("tx") || "";
  const sessionQuery = searchParams.get("sessionId") || "";
  const studentHashQuery = searchParams.get("studentIdHash") || "";

  const [searchTx, setSearchTx] = useState(txQuery);
  const [searchSession, setSearchSession] = useState(sessionQuery);
  const [searchStudentHash, setSearchStudentHash] = useState(studentHashQuery);

  const [verificationResult, setVerificationResult] =
    useState<BlockchainVerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeVerify = async (
    tx?: string,
    sessionId?: string,
    studentHash?: string
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tx) params.set("tx", tx);
      if (sessionId) params.set("sessionId", sessionId);
      if (studentHash) params.set("studentIdHash", studentHash);

      const res = await fetch(`/api/verify?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Verification lookup failed");
      }

      setVerificationResult(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to verify transaction"
      );
      setVerificationResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (txQuery || (sessionQuery && studentHashQuery)) {
      executeVerify(txQuery, sessionQuery, studentHashQuery);
    }
  }, [txQuery, sessionQuery, studentHashQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !searchTx.trim() &&
      (!searchSession.trim() || !searchStudentHash.trim())
    ) {
      setError(
        "Please provide either a transaction hash or both session ID and student commitment hash."
      );
      return;
    }
    executeVerify(
      searchTx.trim() || undefined,
      searchSession.trim() || undefined,
      searchStudentHash.trim() || undefined
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          <ShieldCheck className="h-4 w-4" />
          <span>Independent Public Verification Tool (Screen 12)</span>
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Trustless Attendance Verification
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600">
          Cross-reference student attendance records directly against Ethereum
          smart contract storage slots without trusting the central server.
        </p>
      </div>

      {/* Search Input Card */}
      <Card className="mt-8 bg-white p-6 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="verify-tx"
              className="block text-xs font-semibold text-slate-700"
            >
              Verify by 32-Byte Transaction Hash (EVM)
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="verify-tx"
                type="text"
                placeholder="0x4a7f8d... (64 hex characters)"
                value={searchTx}
                onChange={(e) => setSearchTx(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
              />
              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                className="shrink-0"
              >
                <Search className="h-4 w-4" />
                <span>Verify Proof</span>
              </Button>
            </div>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="grow border-t border-slate-200"></div>
            <span className="shrink mx-4 text-xs font-semibold uppercase text-slate-400">
              Or Query by Session & Student Hash
            </span>
            <div className="grow border-t border-slate-200"></div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="session-id-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Session ID (uint256)
              </label>
              <input
                id="session-id-input"
                type="number"
                placeholder="e.g. 15"
                value={searchSession}
                onChange={(e) => setSearchSession(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label
                htmlFor="student-hash-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Salted Student ID Hash (bytes32)
              </label>
              <input
                id="student-hash-input"
                type="text"
                placeholder="0x111111..."
                value={searchStudentHash}
                onChange={(e) => setSearchStudentHash(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
              />
            </div>
          </div>
        </form>
      </Card>

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="mt-6 flex items-center gap-2 rounded-lg bg-rose-50 p-4 text-xs font-medium text-rose-900"
        >
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Verification Diff Results */}
      {verificationResult && (
        <div className="mt-8">
          <VerificationDiffCard result={verificationResult} />
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-12 text-center text-xs text-slate-500">
          Loading verification portal...
        </div>
      }
    >
      <VerifyContent />
    </React.Suspense>
  );
}
