import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Database,
  Blocks,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { BlockchainVerificationResult } from "@/lib/blockchain/verify";

export interface VerificationDiffCardProps {
  result: BlockchainVerificationResult;
}

export function VerificationDiffCard({ result }: VerificationDiffCardProps) {
  const isMatch = result.matchStatus === "CRYPTOGRAPHICALLY_VERIFIED";
  const isMismatch = result.matchStatus === "MISMATCH";

  return (
    <div className="space-y-6">
      {/* Verdict Banner */}
      <div
        role="region"
        aria-label="Verification Verdict"
        className={`rounded-2xl border p-6 text-sm transition-all ${
          isMatch
            ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
            : isMismatch
              ? "border-rose-300 bg-rose-50 text-rose-950 shadow-md"
              : "border-slate-200 bg-slate-50 text-slate-800"
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              isMatch
                ? "bg-emerald-600 text-white"
                : isMismatch
                  ? "bg-rose-600 text-white"
                  : "bg-slate-300 text-slate-700"
            }`}
          >
            {isMatch ? (
              <ShieldCheck className="h-7 w-7" />
            ) : isMismatch ? (
              <ShieldAlert className="h-7 w-7 animate-pulse" />
            ) : (
              <AlertTriangle className="h-7 w-7" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                Verdict
              </span>
              <Badge
                tone={isMatch ? "present" : isMismatch ? "absent" : "neutral"}
              >
                {result.matchStatus}
              </Badge>
            </div>
            <h2 className="text-xl font-black tracking-tight">
              {isMatch
                ? "100% Cryptographically Verified on Ethereum"
                : isMismatch
                  ? "DATA INTEGRITY MISMATCH DETECTED"
                  : "No Blockchain Record Found"}
            </h2>
            <p className="text-xs opacity-90">
              {isMatch
                ? "Off-chain database state matches the immutable smart contract storage slot bit-for-bit."
                : isMismatch
                  ? "WARNING: The off-chain database record does not match the blockchain contract storage! Potential data tampering or pending sync."
                  : "Neither an on-chain commit nor an indexed database record exists for the provided query."}
            </p>
          </div>
        </div>

        {/* Mismatch breakdown */}
        {isMismatch && result.mismatchFields.length > 0 && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-white p-4 text-xs text-rose-900">
            <span className="font-bold uppercase tracking-wider text-rose-700">
              Integrity Violations Found:
            </span>
            <ul className="mt-2 list-inside list-disc space-y-1 font-mono text-[11px]">
              {result.mismatchFields.map((field, idx) => (
                <li key={idx}>{field}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Side-by-Side Comparison Card (Off-Chain DB vs Live Blockchain RPC) */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left: Off-Chain PostgreSQL State */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Database className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Off-Chain Database State
              </h3>
              <p className="text-[11px] text-slate-500">
                Supabase / Indexed Storage
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Effective Status:</span>
              <span className="font-semibold text-slate-900">
                {result.databaseState ? (
                  <StatusBadge status={result.databaseState.status} />
                ) : (
                  "N/A"
                )}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Amendment Count:</span>
              <span className="font-mono font-semibold text-slate-900">
                {result.databaseState?.amendmentCount ?? "N/A"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Check-In Method:</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px]">
                {result.databaseState?.checkInMethod ?? "N/A"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Updated By Wallet:</span>
              <span className="font-mono text-[11px] text-slate-700">
                {result.databaseState?.updatedBy
                  ? `${result.databaseState.updatedBy.slice(0, 10)}...`
                  : "N/A"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Recorded At:</span>
              <span className="text-slate-600">
                {result.databaseState?.recordedAt
                  ? new Date(result.databaseState.recordedAt).toLocaleString()
                  : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Live Blockchain Contract Storage Slot */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Blocks className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Live Blockchain RPC Storage
              </h3>
              <p className="text-[11px] text-slate-500">
                {result.verifiedAtRpc}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Contract Slot Status:</span>
              <span className="font-semibold text-slate-900">
                {result.onChainState ? (
                  <StatusBadge status={result.onChainState.status} />
                ) : (
                  "0x0 (Unrecorded)"
                )}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Slot Amendment Count:</span>
              <span className="font-mono font-semibold text-slate-900">
                {result.onChainState?.amendmentCount ?? "0"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">On-Chain Recorded By:</span>
              <span className="font-mono text-[11px] text-slate-700">
                {result.onChainState?.updatedBy
                  ? `${result.onChainState.updatedBy.slice(0, 10)}...`
                  : "0x0000...0000"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Block Timestamp:</span>
              <span className="text-slate-600">
                {result.onChainState?.recordedAt
                  ? new Date(
                      result.onChainState.recordedAt * 1000
                    ).toLocaleString()
                  : "N/A"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Block Number:</span>
              <span className="font-mono font-semibold text-indigo-600">
                #{result.blockNumber}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction & Proof Links */}
      {result.txHash && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">
              Transaction Hash:
            </span>
            <span className="font-mono font-bold text-slate-900">
              {result.txHash}
            </span>
          </div>

          <a
            href={`https://sepolia.etherscan.io/tx/${result.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800"
          >
            <span>View on Sepolia Etherscan</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
