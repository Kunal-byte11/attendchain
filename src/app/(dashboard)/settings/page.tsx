"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Layers,
  RefreshCw,
  Server,
  Shield,
  Wifi,
  Wallet,
} from "lucide-react";
import { useWallet } from "@/lib/blockchain/wallet";
import { SUPPORTED_NETWORKS } from "@/lib/blockchain/provider";

export default function SettingsPage() {
  const { account, chainId, isSupportedNetwork, switchNetwork } = useWallet();
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const [primaryLatency, setPrimaryLatency] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [copiedContract, setCopiedContract] = useState(false);

  const contractAddress =
    chainId === 11155111
      ? process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA ||
        "0x5FbDB2315678afecb367f032d93F642f64180aa3"
      : process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_LOCAL ||
        "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  useEffect(() => {
    // Measure primary RPC ping
    const startTime = Date.now();
    const rpcUrl =
      process.env.NEXT_PUBLIC_HARDHAT_RPC_URL || "http://127.0.0.1:8545";

    fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: [],
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setPrimaryLatency(Date.now() - startTime);
        if (data.result) {
          setBlockHeight(parseInt(data.result, 16));
        }
      })
      .catch(() => {
        setPrimaryLatency(null);
      });
  }, []);

  const handleCopyContract = async () => {
    try {
      await navigator.clipboard.writeText(contractAddress);
      setCopiedContract(true);
      setTimeout(() => setCopiedContract(false), 2000);
    } catch {
      // Ignore clipboard write failures in restricted environments
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(
          `Sync completed: ${data.processedEvents || 0} events indexed.`
        );
      } else {
        setSyncStatus("Sync failed or endpoint not yet initialized.");
      }
    } catch {
      setSyncStatus("Failed to contact sync service.");
    } finally {
      setIsSyncing(false);
    }
  };

  const activeConfig = chainId ? SUPPORTED_NETWORKS[chainId] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-slate-400 hover:text-white transition p-1 rounded-lg"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Settings &amp; Network Information
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto px-4 py-8 flex-1 space-y-6">
        {/* Network & Contract Information */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-indigo-400">
            <Layers className="w-5 h-5" />
            <h2 className="text-base font-semibold text-white">
              Connected Blockchain Network
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-1">
              <span className="text-slate-400">Active Network</span>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <span>
                  {activeConfig ? activeConfig.chainName : "Unknown Network"}
                </span>
                {isSupportedNetwork ? (
                  <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-semibold">
                    Supported
                  </span>
                ) : (
                  <span className="bg-rose-950 text-rose-400 border border-rose-800 px-2 py-0.5 rounded text-[10px] font-semibold">
                    Unsupported
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-1">
              <span className="text-slate-400">Chain ID</span>
              <div className="text-sm font-mono text-white">
                {chainId !== null ? chainId : "Not Connected"}
              </div>
            </div>

            <div className="sm:col-span-2 rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">
                  AttendChainRegistry Contract Address
                </span>
                <button
                  type="button"
                  onClick={handleCopyContract}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedContract ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <div className="font-mono text-xs text-indigo-200 break-all select-all">
                {contractAddress}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => switchNetwork(11155111)}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition cursor-pointer"
            >
              Switch to Sepolia (11155111)
            </button>
            <button
              type="button"
              onClick={() => switchNetwork(31337)}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition cursor-pointer"
            >
              Switch to Hardhat (31337)
            </button>
          </div>
        </section>

        {/* RPC Health & Indexer Diagnostics */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-indigo-400">
            <Server className="w-5 h-5" />
            <h2 className="text-base font-semibold text-white">
              RPC Health &amp; Diagnostics
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-1">
              <span className="text-slate-400">Current Block Height</span>
              <div className="text-sm font-mono text-white">
                {blockHeight !== null
                  ? `#${blockHeight.toLocaleString()}`
                  : "Fetching..."}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-1">
              <span className="text-slate-400">Primary RPC Latency</span>
              <div className="text-sm font-mono text-white flex items-center gap-2">
                <span>
                  {primaryLatency !== null
                    ? `${primaryLatency} ms`
                    : "Offline / Unchecked"}
                </span>
                {primaryLatency !== null && primaryLatency <= 300 && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-1">
              <span className="text-slate-400">Failover Mode</span>
              <div className="text-sm font-semibold text-emerald-400">
                Automatic Sequential
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
              />
              <span>Force Re-Sync Contract Events</span>
            </button>
            {syncStatus && (
              <span className="text-xs text-slate-300">{syncStatus}</span>
            )}
          </div>
        </section>

        {/* Privacy & Zero-PII Cryptographic Identity */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-indigo-400">
            <Shield className="w-5 h-5" />
            <h2 className="text-base font-semibold text-white">
              Privacy &amp; Cryptographic Provenance
            </h2>
          </div>

          <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
            <p>
              AttendChain never stores student names, emails, or institutional
              roll numbers on the Ethereum blockchain.
            </p>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-slate-300 space-y-1">
              <div>
                {"/* Deterministic Pseudonymous Commitment Formula (TR-004) */"}
              </div>
              <div className="text-indigo-300">
                studentIdHash = keccak256(InstitutionSaltCommitment,
                canonicalRollNo)
              </div>
            </div>
            <p className="text-slate-400 text-[11px]">
              Connected Wallet:{" "}
              <span className="font-mono text-slate-200">
                {account || "None"}
              </span>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
