"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  QrCode,
  RefreshCw,
  KeyRound,
  Clock,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface DynamicQrProjectorProps {
  sessionId: number;
  isOpen: boolean;
  onRefreshTriggered?: () => void;
}

export function DynamicQrProjector({
  sessionId,
  isOpen,
  onRefreshTriggered,
}: DynamicQrProjectorProps) {
  const [displayPin, setDisplayPin] = useState<string>("------");
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNewToken = async () => {
    if (!isOpen) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAsLate: false }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error?.message || "Failed to generate QR challenge"
        );
      }

      setDisplayPin(data.displayPin);
      setQrToken(data.token);
      setSecondsRemaining(30);
      if (onRefreshTriggered) {
        onRefreshTriggered();
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error refreshing QR token"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (isOpen) {
      fetchNewToken();
    }
  }, [sessionId, isOpen]);

  // 1-second countdown interval
  useEffect(() => {
    if (!isOpen) return;

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          fetchNewToken();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [sessionId, isOpen]);

  // SVG representation for high contrast QR simulation
  const qrSvgUrl = qrToken
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
        JSON.stringify({ sessionId, token: qrToken, pin: displayPin })
      )}`
    : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">
            Live Classroom Dynamic QR Code
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={secondsRemaining > 10 ? "present" : "late"} mono>
            <Clock className="h-3 w-3" />
            <span>Rotates in {secondsRemaining}s</span>
          </Badge>
          <Button
            variant="ghost"
            onClick={fetchNewToken}
            isLoading={isLoading}
            aria-label="Force QR refresh"
            className="p-1.5"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="my-6 rounded-lg bg-rose-50 p-4 text-xs text-rose-800">
          <AlertCircle className="mb-1 inline h-4 w-4" /> {error}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center justify-center text-center">
          {/* QR Container */}
          <div className="relative flex h-60 w-60 items-center justify-center rounded-2xl border-4 border-indigo-600/20 bg-slate-50 p-4 shadow-sm">
            {qrSvgUrl ? (
              <img
                src={qrSvgUrl}
                alt={`Dynamic check-in QR code for session ${sessionId}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <QrCode className="h-24 w-24 text-slate-300 animate-pulse" />
            )}
          </div>

          {/* Accessible 6-character PIN */}
          <div className="mt-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Desktop / Accessible Fallback PIN
            </span>
            <div className="mt-1 flex items-center justify-center gap-1.5">
              <KeyRound className="h-4 w-4 text-indigo-600" />
              <span className="font-mono text-2xl font-black tracking-widest text-slate-900">
                {displayPin}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Students can enter this 6-character PIN or scan the rotating QR
              code in MetaMask.
            </p>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mt-6">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-indigo-600 transition-all duration-1000 ease-linear"
            style={{ width: `${(secondsRemaining / 30) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
