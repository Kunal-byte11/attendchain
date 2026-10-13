"use client";

import React, { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Wallet,
  AlertCircle,
} from "lucide-react";
import { useWallet } from "@/lib/blockchain/wallet";

export interface WalletStatusPillProps {
  className?: string;
  roleBadge?: string;
}

export function WalletStatusPill({
  className = "",
  roleBadge,
}: WalletStatusPillProps) {
  const {
    account,
    state,
    isSupportedNetwork,
    activeNetworkConfig,
    connectWallet,
    disconnectWallet,
    isMetaMaskAvailable,
  } = useWallet();

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failures in restricted environments
    }
  };

  const truncated = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : "";

  if (state === "disconnected" || !account) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <button
          type="button"
          onClick={() => connectWallet()}
          disabled={!isMetaMaskAvailable}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Connect Web3 Wallet"
        >
          <Wallet className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
          <span>Connect Wallet</span>
        </button>
      </div>
    );
  }

  if (state === "connecting") {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-900 border border-slate-700 text-slate-300 ${className}`}
      >
        <Loader2
          className="w-3.5 h-3.5 text-amber-400 animate-spin"
          aria-hidden="true"
        />
        <span>Connecting...</span>
      </div>
    );
  }

  if (state === "wrong-network" || !isSupportedNetwork) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-rose-950/80 border border-rose-800 text-rose-200 ${className}`}
      >
        <AlertCircle
          className="w-3.5 h-3.5 text-rose-400 shrink-0"
          aria-hidden="true"
        />
        <span className="font-mono">{truncated}</span>
        <span className="bg-rose-900 text-rose-100 px-1.5 py-0.5 rounded text-[10px] font-semibold">
          Wrong Net
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-slate-900/90 border border-slate-700/80 text-slate-200 backdrop-blur-sm shadow-sm ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>

      <span className="font-mono text-slate-200 tracking-tight" title={account}>
        {truncated}
      </span>

      {roleBadge && (
        <span className="bg-indigo-950 border border-indigo-800 text-indigo-300 px-1.5 py-0.2 rounded text-[10px] uppercase tracking-wider font-semibold">
          {roleBadge}
        </span>
      )}

      {activeNetworkConfig && (
        <span className="hidden sm:inline-block text-[11px] text-slate-400 border-l border-slate-700 pl-2">
          {activeNetworkConfig.chainId === 31337 ? "Hardhat" : "Sepolia"}
        </span>
      )}

      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy wallet address"
        className="text-slate-400 hover:text-slate-200 p-0.5 rounded transition focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
        title="Copy address"
      >
        {copied ? (
          <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
        ) : (
          <Copy className="w-3 h-3" aria-hidden="true" />
        )}
      </button>

      <button
        type="button"
        onClick={disconnectWallet}
        aria-label="Disconnect wallet"
        className="text-slate-400 hover:text-rose-400 text-[11px] pl-1 transition cursor-pointer"
        title="Disconnect"
      >
        Disconnect
      </button>
    </div>
  );
}
