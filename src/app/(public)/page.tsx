import React from "react";
import Link from "next/link";
import {
  Blocks,
  GraduationCap,
  History,
  KeyRound,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/StatusBadge";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                AttendChain
              </span>
              <span className="ml-2 hidden sm:inline-block">
                <Badge tone="web3" mono>
                  Sepolia 11155111 • Hardhat 31337
                </Badge>
              </span>
            </div>
          </div>

          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-3"
          >
            <Link
              href="/verify"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              <ShieldCheck
                className="h-4 w-4 text-emerald-700"
                aria-hidden="true"
              />
              <span>Verify a Transaction</span>
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700"
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <span>Connect &amp; Sign In</span>
            </Link>
          </nav>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto flex-1 max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16"
      >
        {/* Hero Section */}
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Badge tone="brand" className="mb-4">
              <Blocks className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Decentralized Academic Attendance Ledger</span>
            </Badge>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl lg:leading-tight">
              Tamper-Evident Classroom Attendance on Ethereum Sepolia — Without
              Exposing Student Privacy.
            </h1>

            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
              Replace vulnerable pen-and-paper registers and mutable
              spreadsheets with single-transaction batch attendance, 30-second
              rotating dynamic QR check-ins, and an immutable on-chain
              correction audit trail.
            </p>

            {/* Evidentiary Boundary Notice (01_PRD.md Section 2) */}
            <div
              role="note"
              aria-label="Cryptographic provenance notice"
              className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 text-sm text-slate-800"
            >
              <p className="font-semibold text-indigo-950">
                Cryptographic Provenance Notice:
              </p>
              <p className="mt-1 text-slate-700">
                AttendChain proves which authorized faculty or student wallet
                submitted attendance within a lecture window and records every
                subsequent amendment on-chain. Student names and roll numbers
                remain strictly off-chain.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700"
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                <span>Connect Wallet &amp; Authenticate (SIWE)</span>
              </Link>
              <Link
                href="/verify"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-xs hover:bg-slate-100"
              >
                <ShieldCheck
                  className="h-4 w-4 text-emerald-700"
                  aria-hidden="true"
                />
                <span>Inspect On-Chain Verifier</span>
              </Link>
            </div>
          </div>

          {/* Interactive Architecture Preview Card */}
          <div className="lg:col-span-5">
            <Card
              title="On-Chain vs. Off-Chain Privacy Preview"
              subtitle="AttendChainRegistry.sol • Single-Slot 32-Byte Packed Record"
            >
              <div className="space-y-4 text-sm">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">
                      Off-Chain Synthetic Profile (Supabase)
                    </span>
                    <Badge tone="neutral">Private DB</Badge>
                  </div>
                  <p className="mt-1.5 font-mono text-xs text-slate-800">
                    Roll: SYN-2026-042 • Name: Aarav Mehta (CSE Sem 7)
                  </p>
                </div>

                <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-violet-950">
                      On-Chain Commitment (Ethereum Sepolia)
                    </span>
                    <Badge tone="web3" mono>
                      Zero PII
                    </Badge>
                  </div>
                  <p
                    className="mt-1.5 font-mono text-xs text-violet-950 break-all"
                    aria-label="Pseudonymous student hash 0x7259 ending in 2149"
                  >
                    studentIdHash: 0x72596763...0693572149
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-violet-200/70 pt-2.5">
                    <StatusBadge status="PRESENT" amended={false} />
                    <span
                      className="font-mono text-xs text-slate-700"
                      aria-label="Transaction hash 0x8a3f ending in 91b2"
                    >
                      Tx: 0x8a3f...91b2 (Block #7482910)
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950">
                  <span className="font-semibold">Attendance Formula:</span>{" "}
                  <code>
                    (Present + Late) / (Closed Enrolled − Excused − Cancelled) ×
                    100
                  </code>{" "}
                  • 75.00% Eligibility Threshold
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* 3-Card Feature Grid */}
        <section
          aria-labelledby="features-heading"
          className="mt-16 border-t border-slate-200 pt-12"
        >
          <h2
            id="features-heading"
            className="text-2xl font-bold tracking-tight text-slate-900"
          >
            Engineered for Academic Integrity &amp; Privacy
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card title="Zero On-Chain PII via Salted Hashes">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                Student names and roll numbers never touch the public
                blockchain. On-chain storage keys attendance strictly by a
                salted <code>bytes32 studentIdHash</code>, allowing teachers to
                mark attendance even before a student connects MetaMask.
              </p>
            </Card>

            <Card title="Gas-Efficient Batch & Dynamic QR Roll Call">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                <QrCode className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                Project a live 30-second rotating cryptographic QR code (and
                6-character PIN) for student check-ins, review the live class
                roster, and commit 50+ students in a single packed batch
                transaction (<code>recordBatchAttendance</code>).
              </p>
            </Card>

            <Card title="Immutable Correction Audit Trail">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                <History className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                Closed lecture sessions lock standard marking. Post-lecture
                amendments require an explicit <code>correctAttendance</code>{" "}
                transaction with a mandatory <code>reasonHash</code>, preserving
                both original and amended states forever.
              </p>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          AttendChain MVP • Synthetic Academic Data Only (<code>SYN-*</code>) •
          Ethereum Sepolia &amp; Hardhat Local
        </div>
      </footer>
    </div>
  );
}
