import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  resetMemoryDb,
  getMemoryDb,
  getInstitutionSalt,
} from "@/lib/db/client";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { computeStudentIdHash } from "@/lib/attendance/identity";
import { POST as qrPost } from "@/app/api/sessions/[sessionId]/qr/route";
import { POST as qrCheckInPost } from "@/app/api/attendance/qr-checkin/route";
import {
  GET as attendanceGet,
  POST as attendancePost,
} from "@/app/api/attendance/route";
import { constructCheckInSignMessage } from "@/lib/attendance/qr-token";

describe("QR Rotation, Check-In & Batch Commit Suite (T-015, FR-009, FR-010, FR-011, FR-018, FR-019)", () => {
  const teacherAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  // Bound student SYN-2026-042 (Aarav Mehta)
  const studentAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  const studentHash =
    "0x1111111111111111111111111111111111111111111111111111111111111111";

  let teacherToken: string;
  let studentToken: string;

  beforeEach(async () => {
    resetMemoryDb();

    teacherToken = await createSessionToken({
      sub: teacherAddress,
      walletAddress: teacherAddress,
      role: "TEACHER",
      displayName: "Prof. Ananya Verma",
    });

    const salt = getInstitutionSalt();
    const student1Hash = computeStudentIdHash(salt, "SYN-2026-042");

    studentToken = await createSessionToken({
      sub: studentAddress,
      walletAddress: studentAddress,
      role: "STUDENT",
      displayName: "Aarav Mehta (SYN-2026-042)",
      studentIdHash: student1Hash,
    });

    // Create an OPEN session in DB
    const db = getMemoryDb();
    const now = new Date();
    db.sessions.set(15, {
      id: "ses-15",
      onChainSessionId: 15,
      courseId: "crs-cs701",
      courseCode: "CS701",
      courseIdHash: "0x" + "a".repeat(64),
      teacherWallet: teacherAddress,
      topic: "Dynamic QR Validation",
      metadataHash: "0x" + "b".repeat(64),
      startTime: now.toISOString(),
      endTime: new Date(now.getTime() + 3600000).toISOString(),
      status: "OPEN",
      qrEnabled: true,
      lateCutoffMinutes: 15,
      openTxHash: "0x" + "c".repeat(64),
      closeTxHash: null,
      createdAt: now.toISOString(),
    });
  });

  function createAuthedRequest(
    url: string,
    method: "GET" | "POST",
    token?: string,
    body?: unknown
  ): NextRequest {
    const headers = new Headers();
    if (token) {
      headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
    }
    if (body) {
      headers.set("Content-Type", "application/json");
    }

    return new NextRequest(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("generates 30s dynamic QR code and 6-char PIN for OPEN session", async () => {
    const req = createAuthedRequest(
      "http://localhost:3000/api/sessions/15/qr",
      "POST",
      teacherToken,
      { markAsLate: false }
    );

    const res = await qrPost(req, {
      params: Promise.resolve({ sessionId: "15" }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.displayPin).toHaveLength(6);
    expect(data.token).toHaveLength(64);
    expect(data.ttlSeconds).toBe(30);

    const db = getMemoryDb();
    expect(db.qrTokens.has(data.token)).toBe(true);
  });

  it("stages student QR check-in when valid PIN and signature are submitted", async () => {
    // 1. Teacher generates QR PIN
    const qrReq = createAuthedRequest(
      "http://localhost:3000/api/sessions/15/qr",
      "POST",
      teacherToken
    );
    const qrRes = await qrPost(qrReq, {
      params: Promise.resolve({ sessionId: "15" }),
    });
    const qrData = await qrRes.json();

    // 2. Student checks in using 6-character PIN
    const dummySignature = "0x" + "8".repeat(130);
    const checkInReq = createAuthedRequest(
      "http://localhost:3000/api/attendance/qr-checkin",
      "POST",
      studentToken,
      {
        sessionId: 15,
        tokenOrPin: qrData.displayPin,
        signature: dummySignature,
        signedTimestamp: Math.floor(Date.now() / 1000),
      }
    );

    const checkInRes = await qrCheckInPost(checkInReq);
    expect(checkInRes.status).toBe(200);
    const checkInData = await checkInRes.json();
    expect(checkInData.checkIn.status).toBe("PRESENT");
    expect(checkInData.checkIn.staged).toBe(true);

    // 3. Second check-in by same student rejects with 409 ALREADY_CHECKED_IN
    const dupReq = createAuthedRequest(
      "http://localhost:3000/api/attendance/qr-checkin",
      "POST",
      studentToken,
      {
        sessionId: 15,
        tokenOrPin: qrData.displayPin,
        signature: dummySignature,
        signedTimestamp: Math.floor(Date.now() / 1000),
      }
    );
    const dupRes = await qrCheckInPost(dupReq);
    expect(dupRes.status).toBe(409);
    const dupData = await dupRes.json();
    expect(dupData.error.code).toBe("ALREADY_CHECKED_IN");
  });

  it("rejects expired QR tokens (>35s TTL) with 400 QR_TOKEN_EXPIRED", async () => {
    const qrReq = createAuthedRequest(
      "http://localhost:3000/api/sessions/15/qr",
      "POST",
      teacherToken
    );
    const qrRes = await qrPost(qrReq, {
      params: Promise.resolve({ sessionId: "15" }),
    });
    const qrData = await qrRes.json();

    // Manually expire token in memory DB
    const db = getMemoryDb();
    const record = db.qrTokens.get(qrData.displayPin);
    expect(record).toBeDefined();
    record!.expiresAt = Date.now() - 1000; // Expired 1 second ago

    const dummySignature = "0x" + "8".repeat(130);
    const checkInReq = createAuthedRequest(
      "http://localhost:3000/api/attendance/qr-checkin",
      "POST",
      studentToken,
      {
        sessionId: 15,
        tokenOrPin: qrData.displayPin,
        signature: dummySignature,
        signedTimestamp: Math.floor(Date.now() / 1000),
      }
    );

    const checkInRes = await qrCheckInPost(checkInReq);
    expect(checkInRes.status).toBe(400);
    const checkInData = await checkInRes.json();
    expect(checkInData.error.code).toBe("QR_TOKEN_EXPIRED");
  });

  it("commits batch attendance on-chain, transitions session to CLOSED, and indexes records", async () => {
    const dummyTx = "0x" + "d".repeat(64);
    const req = createAuthedRequest(
      "http://localhost:3000/api/attendance",
      "POST",
      teacherToken,
      {
        sessionId: 15,
        txHash: dummyTx,
        records: [
          {
            studentIdHash:
              "0x1111111111111111111111111111111111111111111111111111111111111111",
            status: "PRESENT",
          },
        ],
        closeSession: true,
      }
    );

    const res = await attendancePost(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.syncedCount).toBe(1);
    expect(data.sessionStatus).toBe("CLOSED");

    const db = getMemoryDb();
    const session = db.sessions.get(15);
    expect(session?.status).toBe("CLOSED");
  });
});
