import { describe, it, expect } from "vitest";
import {
  generateQrSessionChallenge,
  isQrTokenFresh,
  constructCheckInSignMessage,
  QR_ROTATION_SECONDS,
  QR_TOTAL_TTL_SECONDS,
} from "@/lib/attendance/qr-token";

describe("QR Token Generation & TTL Suite (T-015, FR-018, TR-007)", () => {
  it("generates 32-byte hex token, valid keccak256 tokenHash, and 6-char accessible PIN", () => {
    const challenge = generateQrSessionChallenge(15);

    expect(challenge.token).toHaveLength(64); // 32 bytes hex
    expect(challenge.tokenHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(challenge.displayPin).toHaveLength(6);
    expect(challenge.displayPin).toMatch(
      /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/
    );
    expect(challenge.ttlSeconds).toBe(QR_ROTATION_SECONDS);
    expect(challenge.expiresAt).toBeGreaterThan(Date.now());
  });

  it("validates freshness within 35s window and expires strictly after 35s", () => {
    const now = Date.now();
    const expiresAt = now + QR_TOTAL_TTL_SECONDS * 1000;

    // Fresh at 0s, 10s, 30s, 35s
    expect(isQrTokenFresh(expiresAt, now)).toBe(true);
    expect(isQrTokenFresh(expiresAt, now + 10000)).toBe(true);
    expect(isQrTokenFresh(expiresAt, now + 30000)).toBe(true);
    expect(isQrTokenFresh(expiresAt, now + 35000)).toBe(true);

    // Expired at 36s (>35s TTL)
    expect(isQrTokenFresh(expiresAt, now + 36000)).toBe(false);
  });

  it("constructs deterministic check-in message", () => {
    const msg = constructCheckInSignMessage(15, "ABC987", 1700000000);
    expect(msg).toContain("Session ID: 15");
    expect(msg).toContain("Challenge: ABC987");
    expect(msg).toContain("Timestamp: 1700000000");
  });
});
