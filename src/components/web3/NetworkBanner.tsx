"use client";

import React, { useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useWallet } from "@/lib/blockchain/wallet";

export interface NetworkBannerProps {
  preferredChainId?: number;
}

export function NetworkBanner({
  preferredChainId = 11155111,
}: NetworkBannerProps) {
  const {
    chainId,
    isSupportedNetwork,
    state,
    switchNetwork,
    isMetaMaskAvailable,
  } = useWallet();
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // If wallet is not connected or already on a supported network, render nothing
  if (state === "disconnected" || isSupportedNetwork || chainId === null) {
    return null;
  }

  const handleSwitch = async () => {
    setIsSwitching(true);
    setSwitchError(null);
    try {
      const success = await switchNetwork(preferredChainId);
      if (!success) {
        setSwitchError(
          "Failed to switch network. Please approve the prompt in MetaMask."
        );
      }
    } finally {
      setIsSwitching(false);
    }
  };

  const targetName =
    preferredChainId === 31337
      ? "Hardhat Localhost (31337)"
      : "Sepolia Testnet (11155111)";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="w-full bg-rose-900/90 border-b border-rose-700 text-white px-4 py-3 shadow-md"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-rose-100">
          <AlertTriangle
            className="w-5 h-5 text-rose-400 shrink-0"
            aria-hidden="true"
          />
          <span>
            <strong className="font-semibold text-white">
              Wrong Network Detected:
            </strong>{" "}
            You are connected to Chain ID{" "}
            <code className="bg-rose-950 px-1 py-0.5 rounded text-rose-200">
              {chainId}
            </code>
            . AttendChain requires <strong>Ethereum Sepolia</strong> or{" "}
            <strong>Hardhat Localhost</strong>.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSwitch}
            disabled={isSwitching || !isMetaMaskAvailable}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white text-rose-950 font-medium hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-rose-900 focus:ring-white transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-xs sm:text-sm"
          >
            {isSwitching ? (
              "Switching in Wallet..."
            ) : (
              <>
                Switch to {targetName}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
      {switchError && (
        <div className="max-w-7xl mx-auto mt-2 text-xs text-rose-200">
          {switchError}
        </div>
      )}
    </div>
  );
}
