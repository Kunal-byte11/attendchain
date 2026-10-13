import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ethers } from "ethers";
import { GET as verifyGet } from "@/app/api/verify/route";
import { getMemoryDb } from "@/lib/db/client";
import {
  compareDbAndOnChainRecord,
  verifyRecordDirect,
} from "@/lib/blockchain/verify";
import type { AttendanceRecordView } from "@/types";

describe("Independent Blockchain Verification & Tampering Suite (T-018, FR-014, TR-012)", () => {
  const teacherWallet = ethers.Wallet.createRandom();
  const studentHash =
    "0x1111111111111111111111111111111111111111111111111111111111111111";
  const dummyTx = "0x" + "a".repeat(64);

  beforeEach(() => {
    const db = getMemoryDb();
    db.attendanceRecords.clear();
    db.sessions.clear();
    db.corrections = [];

    // Seed session 18
    db.sessions.set(18, {
      id: "sess-18",
      onChainSessionId: 18,
      courseId: "course-1",
      courseCode: "CS701",
      courseIdHash: ethers.keccak256(ethers.toUtf8Bytes("CS701")),
      teacherWallet: teacherWallet.address.toLowerCase(),
      topic: "Zero-Knowledge Verification",
      metadataHash: ethers.keccak256(ethers.toUtf8Bytes("Topic 18")),
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
      status: "CLOSED",
      qrEnabled: true,
      lateCutoffMinutes: 10,
      openTxHash: "0x" + "1".repeat(64),
      closeTxHash: dummyTx,
      createdAt: new Date().toISOString(),
    });

    // Seed clean matching record in DB
    db.attendanceRecords.set(`18:${studentHash.toLowerCase()}`, {
      id: "rec-18",
      sessionId: "sess-18",
      onChainSessionId: 18,
      courseCode: "CS701",
      courseIdHash: ethers.keccak256(ethers.toUtf8Bytes("CS701")),
      sessionTopic: "Zero-Knowledge Verification",
      sessionStartTime: new Date(Date.now() - 3600000).toISOString(),
      sessionStatus: "CLOSED",
      studentId: "stud-1",
      syntheticRollNo: "SYN-2026-042",
      syntheticName: "Student Alice",
      studentIdHash: studentHash,
      draftStatus: "PRESENT",
      onChainStatus: "PRESENT",
      effectiveStatus: "PRESENT",
      checkInMethod: "QR_VERIFIED",
      amendmentCount: 0,
      updatedByWallet: teacherWallet.address.toLowerCase(),
      txHash: dummyTx,
      blockNumber: 120,
      recordedAt: new Date().toISOString(),
      amendedAt: null,
    });
  });

  it("returns CRYPTOGRAPHICALLY_VERIFIED when off-chain record exactly matches on-chain slot", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/verify?tx=${dummyTx}`,
      {
        method: "GET",
      }
    );

    const res = await verifyGet(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.matchStatus).toBe("CRYPTOGRAPHICALLY_VERIFIED");
    expect(data.mismatchFields.length).toBe(0);
    expect(data.databaseState.status).toBe("PRESENT");
    expect(data.onChainState.status).toBe("PRESENT");
  });

  it("detects simulated database tampering attack and triggers MISMATCH verdict", async () => {
    // Tamper attack: An adversary modifies PostgreSQL database directly, changing Alice's status
    // from PRESENT to ABSENT without an on-chain transaction or event.
    const db = getMemoryDb();
    const targetRecord = db.attendanceRecords.get(
      `18:${studentHash.toLowerCase()}`
    );
    expect(targetRecord).toBeDefined();

    // Adversary tampers with the off-chain record
    targetRecord!.effectiveStatus = "ABSENT";

    // Query the verification endpoint
    const req = new NextRequest(
      `http://localhost:3000/api/verify?sessionId=18&studentIdHash=${studentHash}`,
      { method: "GET" }
    );

    const res = await verifyGet(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.matchStatus).toBe("MISMATCH");
    expect(data.mismatchFields.length).toBeGreaterThan(0);
    expect(data.mismatchFields[0]).toContain("Status Mismatch");
    expect(data.databaseState.status).toBe("ABSENT");
    expect(data.onChainState.status).toBe("PRESENT");
  });

  it("returns NOT_FOUND when neither DB nor on-chain storage exists for session", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/verify?sessionId=999&studentIdHash=${studentHash}`,
      { method: "GET" }
    );

    const res = await verifyGet(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.matchStatus).toBe("NOT_FOUND");
  });
});
