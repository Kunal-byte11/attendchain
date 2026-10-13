import crypto from "node:crypto";
import { ethers } from "ethers";

export const QR_ROTATION_SECONDS = 30;
export const QR_GRACE_WINDOW_SECONDS = 5;
export const QR_TOTAL_TTL_SECONDS =
  QR_ROTATION_SECONDS + QR_GRACE_WINDOW_SECONDS; // 35 seconds

export interface GeneratedQrToken {
  token: string;
  tokenHash: string;
  displayPin: string;
  expiresAt: number; // Unix timestamp in ms
  ttlSeconds: number;
}

/**
 * Generates a high-entropy 32-byte cryptographic challenge token and an accessible 6-character PIN (FR-018).
 */
export function generateQrSessionChallenge(
  sessionId: number
): GeneratedQrToken {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = ethers.keccak256(ethers.toUtf8Bytes(token));

  // Generate 6-char accessible uppercase alphanumeric PIN excluding confusing chars (0, O, 1, I)
  const charset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const pinBytes = crypto.randomBytes(6);
  let displayPin = "";
  for (let i = 0; i < 6; i++) {
    const byte = pinBytes[i] ?? 0;
    displayPin += charset[byte % charset.length];
  }

  const expiresAt = Date.now() + QR_TOTAL_TTL_SECONDS * 1000;

  return {
    token,
    tokenHash,
    displayPin,
    expiresAt,
    ttlSeconds: QR_ROTATION_SECONDS,
  };
}

/**
 * Validates freshness of a challenge token against the 35-second TTL window.
 */
export function isQrTokenFresh(
  expiresAt: number,
  now: number = Date.now()
): boolean {
  return now <= expiresAt;
}

/**
 * Construct check-in message string to be signed by the student's wallet.
 */
export function constructCheckInSignMessage(
  sessionId: number,
  tokenOrPin: string,
  timestamp: number
): string {
  return `AttendChain QR Check-In\nSession ID: ${sessionId}\nChallenge: ${tokenOrPin}\nTimestamp: ${timestamp}`;
}
