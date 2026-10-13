"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  X,
} from "lucide-react";
import {
  type ManagedTransaction,
  getSavedPendingTransactions,
  removeSavedTransaction,
  savePendingTransaction,
} from "@/lib/blockchain/tx-manager";
import { useWallet } from "@/lib/blockchain/wallet";

export function TxLifecycleBanner() {
  const { getBrowserProvider, chainId } = useWallet();
  const [activeTxs, setActiveTxs] = useState<ManagedTransaction[]>([]);

  // Load persisted transactions from sessionStorage on mount (FR-022)
  useEffect(() => {
    const saved = getSavedPendingTransactions();
    if (saved.length > 0) {
      setActiveTxs(saved);
    }
  }, []);

  const pollTransaction = useCallback(
    async (tx: ManagedTransaction) => {
      const provider = getBrowserProvider();
      if (!provider) return;

      try {
        const receipt = await provider.waitForTransaction(tx.txHash, 1, 60000);
        if (receipt) {
          const updated: ManagedTransaction = {
            ...tx,
            stage: receipt.status === 1 ? "confirmed" : "reverted",
            confirmedAt: Date.now(),
            blockNumber: receipt.blockNumber,
          };
          savePendingTransaction(updated);
          setActiveTxs((prev) =>
            prev.map((t) => (t.txHash === tx.txHash ? updated : t))
          );
        }
      } catch (err: unknown) {
        const updated: ManagedTransaction = {
          ...tx,
          stage: "reverted",
          error: err instanceof Error ? err.message : "Confirmation failed",
        };
        savePendingTransaction(updated);
        setActiveTxs((prev) =>
          prev.map((t) => (t.txHash === tx.txHash ? updated : t))
        );
      }
    },
    [getBrowserProvider]
  );

  useEffect(() => {
    activeTxs
      .filter((tx) => tx.stage === "pending-confirm")
      .forEach((tx) => {
        void pollTransaction(tx);
      });
  }, [activeTxs, pollTransaction]);

  const dismissTx = (txHash: string) => {
    removeSavedTransaction(txHash);
    setActiveTxs((prev) => prev.filter((t) => t.txHash !== txHash));
  };

  if (activeTxs.length === 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-2"
    >
      {activeTxs.map((tx) => {
        const truncated = `${tx.txHash.slice(0, 8)}...${tx.txHash.slice(-6)}`;
        const explorerUrl =
          chainId === 11155111
            ? `https://sepolia.etherscan.io/tx/${tx.txHash}`
            : null;

        return (
          <div
            key={tx.txHash}
            className={`rounded-xl border p-4 shadow-xl backdrop-blur-md text-xs transition ${
              tx.stage === "confirmed"
                ? "bg-emerald-950/90 border-emerald-700 text-emerald-200"
                : tx.stage === "reverted"
                  ? "bg-rose-950/90 border-rose-700 text-rose-200"
                  : "bg-slate-900/95 border-slate-700 text-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {tx.stage === "pending-confirm" && (
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0 mt-0.5" />
                )}
                {tx.stage === "confirmed" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                {tx.stage === "reverted" && (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}

                <div>
                  <div className="font-semibold text-white">
                    {tx.stage === "pending-confirm" && "Transaction Pending..."}
                    {tx.stage === "confirmed" &&
                      "Transaction Confirmed on Blockchain!"}
                    {tx.stage === "reverted" && "Transaction Reverted"}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    {tx.description}
                  </div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-slate-400">
                    <span
                      aria-label={`Transaction hash ${tx.txHash.slice(0, 6)} ending in ${tx.txHash.slice(-4)}`}
                    >
                      {truncated}
                    </span>
                    {explorerUrl && (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-indigo-400 hover:text-indigo-300 underline"
                      >
                        <span>Etherscan</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismissTx(tx.txHash)}
                className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
