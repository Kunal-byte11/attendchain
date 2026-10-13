"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  KeyRound,
  ShieldCheck,
  Wallet,
  Loader2,
  AlertCircle,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { useWallet } from "@/lib/blockchain/wallet";
import { WalletStatusPill } from "@/components/web3/WalletStatusPill";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");

  const {
    account,
    chainId,
    state: walletState,
    error: walletError,
    isSupportedNetwork,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    isMetaMaskAvailable,
    getSigner,
  } = useWallet();

  const [isSigning, setIsSigning] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [claimCode, setClaimCode] = useState("");
  const [showClaimInput, setShowClaimInput] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setAuthError(null);
    setIsSigning(true);

    try {
      let currentAccount = account;
      if (!currentAccount) {
        currentAccount = await connectWallet();
        if (!currentAccount) {
          setIsSigning(false);
          return;
        }
      }

      // 1. Fetch single-use SIWE challenge nonce from server
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: currentAccount,
          chainId: chainId ?? 31337,
        }),
      });

      if (!nonceRes.ok) {
        const errData = await nonceRes.json();
        throw new Error(
          errData.error?.message || "Failed to generate SIWE challenge"
        );
      }

      const { message } = await nonceRes.json();

      // 2. Prompt connected MetaMask wallet to sign challenge message (0 gas)
      const signer = await getSigner();
      if (!signer) {
        throw new Error("Unable to obtain signer from browser wallet");
      }

      const signature = await signer.signMessage(message);

      // 3. Verify signature on backend & set HttpOnly session cookie
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: currentAccount,
          message,
          signature,
          studentClaimCode: claimCode.trim() || undefined,
        }),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json();
        throw new Error(errData.error?.message || "SIWE verification failed");
      }

      const { user } = await verifyRes.json();

      // 4. Redirect to role workspace
      if (returnUrl) {
        router.push(returnUrl);
      } else if (user.role === "ADMIN") {
        router.push("/admin");
      } else if (user.role === "TEACHER") {
        router.push("/teacher");
      } else if (user.role === "STUDENT") {
        router.push("/student");
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : "Authentication failed"
      );
    } finally {
      setIsSigning(false);
    }
  };

  const handleDemoLogin = async (role: "ADMIN" | "TEACHER" | "STUDENT") => {
    setAuthError(null);
    setIsSigning(true);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Demo login failed");
      }

      if (returnUrl) {
        router.push(returnUrl);
      } else if (role === "ADMIN") {
        router.push("/admin");
      } else if (role === "TEACHER") {
        router.push("/teacher");
      } else if (role === "STUDENT") {
        router.push("/student");
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">
            AttendChain
          </span>
        </Link>
        <WalletStatusPill />
      </header>

      {/* Main Container */}
      <main className="max-w-md w-full mx-auto px-4 py-12 flex-1 flex flex-col justify-center">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-sm">
          <div className="text-center mb-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-950 border border-indigo-700/60 text-indigo-400 mb-4 shadow-inner">
              <KeyRound className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Authenticate with Web3
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Sign an EIP-4361 challenge with your Ethereum wallet. No passwords
              or private keys required.
            </p>
          </div>

          {(authError || walletError) && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-rose-800/80 bg-rose-950/60 p-4 text-xs text-rose-300 flex items-start gap-2.5"
            >
              <AlertCircle
                className="w-4 h-4 text-rose-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="font-semibold">{authError || walletError}</p>
                {authError?.includes("not registered") && (
                  <p className="text-[11px] text-rose-300/80">
                    If this is your personal wallet, enter a synthetic Student
                    Claim Code below (e.g. CLAIM-SYN-042) to bind it, or switch
                    your MetaMask account to one of the seeded test accounts (#0
                    Admin, #1 Teacher, #2 Student).
                  </p>
                )}
              </div>
            </div>
          )}

          {account && !isSupportedNetwork && (
            <div className="mb-6 rounded-lg border border-amber-800/80 bg-amber-950/60 p-4 text-xs text-amber-200 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle
                  className="w-4 h-4 text-amber-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold">
                    Unsupported Network Connected (Chain ID:{" "}
                    {chainId ?? "Unknown"})
                  </p>
                  <p className="mt-0.5 text-amber-300/80">
                    AttendChain runs on Local Hardhat (Chain ID: 31337) or
                    Ethereum Sepolia Testnet (Chain ID: 11155111).
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    setIsSwitchingNetwork(true);
                    await switchNetwork(31337);
                    setIsSwitchingNetwork(false);
                  }}
                  disabled={isSwitchingNetwork}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition cursor-pointer disabled:opacity-50"
                >
                  Switch to Hardhat Local (31337)
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setIsSwitchingNetwork(true);
                    await switchNetwork(11155111);
                    setIsSwitchingNetwork(false);
                  }}
                  disabled={isSwitchingNetwork}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition cursor-pointer disabled:opacity-50"
                >
                  Switch to Sepolia (11155111)
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {account ? (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300">
                  <span className="truncate pr-2">{account}</span>
                  <button
                    type="button"
                    onClick={disconnectWallet}
                    className="text-slate-400 hover:text-rose-400 font-sans text-[11px] underline cursor-pointer"
                  >
                    Change Wallet
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isSigning}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSigning ? (
                    <>
                      <Loader2
                        className="w-4 h-4 animate-spin"
                        aria-hidden="true"
                      />
                      <span>Signing SIWE Challenge...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck
                        className="w-4 h-4 text-indigo-200"
                        aria-hidden="true"
                      />
                      <span>Sign In with Connected Wallet</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => connectWallet()}
                disabled={!isMetaMaskAvailable || isSigning}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Wallet className="w-4 h-4" aria-hidden="true" />
                <span>Connect MetaMask</span>
              </button>
            )}

            {/* Optional Student Claim Code Binding */}
            <div className="pt-2">
              {!showClaimInput ? (
                <button
                  type="button"
                  onClick={() => setShowClaimInput(true)}
                  className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1 mx-auto cursor-pointer transition"
                >
                  <Sparkles
                    className="w-3.5 h-3.5 text-indigo-400"
                    aria-hidden="true"
                  />
                  <span>Have a student claim code? (New Student Setup)</span>
                </button>
              ) : (
                <div className="space-y-2 text-left pt-2 border-t border-slate-800">
                  <label
                    htmlFor="claim-code"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Synthetic Student Claim Code (Optional)
                  </label>
                  <input
                    id="claim-code"
                    type="text"
                    value={claimCode}
                    onChange={(e) => setClaimCode(e.target.value)}
                    placeholder="e.g. CLAIM-SYN-042"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    Enables binding an unregistered wallet to your
                    pre-registered synthetic student profile.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800 text-center text-xs text-slate-400 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-300">
                1-Click Demo Login (Instant Access):
              </p>
              <span className="text-[10px] text-indigo-400 font-medium">
                Bypasses Browser Wallet
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin("ADMIN")}
                disabled={isSigning}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 hover:bg-slate-900 text-white transition cursor-pointer disabled:opacity-50"
              >
                <span className="font-bold text-xs text-indigo-400">Admin</span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Dr. Sharma
                </span>
                <span className="text-[9px] text-emerald-400 font-mono mt-1">
                  #0 Admin
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin("TEACHER")}
                disabled={isSigning}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 hover:bg-slate-900 text-white transition cursor-pointer disabled:opacity-50"
              >
                <span className="font-bold text-xs text-indigo-400">
                  Teacher
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Prof. Verma
                </span>
                <span className="text-[9px] text-emerald-400 font-mono mt-1">
                  #1 Faculty
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin("STUDENT")}
                disabled={isSigning}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 hover:bg-slate-900 text-white transition cursor-pointer disabled:opacity-50"
              >
                <span className="font-bold text-xs text-indigo-400">
                  Student
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Aarav M.
                </span>
                <span className="text-[9px] text-emerald-400 font-mono mt-1">
                  SYN-042
                </span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Click any role above to instantly create a verified session, or
              sign in with your connected Web3 wallet.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-500 border-t border-slate-900">
        AttendChain Zero-PII Cryptographic Authentication • EIP-4361 SIWE &amp;
        EIP-1193
      </footer>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
