import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ethers } from "ethers";
import {
  GET as correctionsGet,
  POST as correctionsPost,
} from "@/app/api/attendance/corrections/route";
import { GET as attendanceGet } from "@/app/api/attendance/route";
import { getMemoryDb } from "@/lib/db/client";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { computeReasonHash } from "@/lib/attendance/identity";

function createAuthedRequest(
  url: string,
  method: "GET" | "POST",
  token: string,
  body?: unknown
): NextRequest {
  const headers = new Headers();
  headers.set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);
  if (body) {
    headers.set("Content-Type", "application/json");
  }

  return new NextRequest(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Attendance Corrections and Dispute Workflow Suite (T-017, FR-015, FR-016, FR-017)", () => {
  const teacherWallet = ethers.Wallet.createRandom();
  const studentWallet = ethers.Wallet.createRandom();

  const studentHash =
    "0x1111111111111111111111111111111111111111111111111111111111111111";

  let teacherToken: string;
  let studentToken: string;

  beforeEach(async () => {
    const db = getMemoryDb();

    // Reset database state
    db.sessions.clear();
    db.courses.clear();
    db.attendanceRecords.clear();
    db.students.clear();
    db.corrections = [];

    teacherToken = await createSessionToken({
      sub: teacherWallet.address,
      walletAddress: teacherWallet.address,
      role: "TEACHER",
      displayName: "Prof. Alan Turing",
      department: "Computer Science",
    });

    studentToken = await createSessionToken({
      sub: studentWallet.address,
      walletAddress: studentWallet.address,
      role: "STUDENT",
      displayName: "Student Alice",
      department: "Computer Science",
      studentIdHash: studentHash,
    });

    // Seed student profile
    db.students.set(studentHash, {
      id: "stud-1",
      syntheticRollNo: "SYN-2026-042",
      syntheticName: "Student Alice",
      studentIdHash: studentHash,
      walletAddress: studentWallet.address.toLowerCase(),
      claimCode: "CLAIM-042",
      semester: 7,
      department: "Computer Science",
      createdAt: new Date().toISOString(),
    });

    // Seed course
    db.courses.set("CS701", {
      id: "course-1",
      courseCode: "CS701",
      courseIdHash: ethers.keccak256(ethers.toUtf8Bytes("CS701")),
      title: "Distributed Systems & Blockchain",
      semester: 7,
      teacherWallet: teacherWallet.address.toLowerCase(),
      txHash: "0x" + "a".repeat(64),
      isActive: true,
      enrolledStudentHashes: [studentHash],
      createdAt: new Date().toISOString(),
    });

    // Seed closed session
    db.sessions.set(17, {
      id: "sess-17",
      onChainSessionId: 17,
      courseId: "course-1",
      courseCode: "CS701",
      courseIdHash: ethers.keccak256(ethers.toUtf8Bytes("CS701")),
      teacherWallet: teacherWallet.address.toLowerCase(),
      topic: "Smart Contract Security & Audits",
      metadataHash: ethers.keccak256(ethers.toUtf8Bytes("Topic 17")),
      startTime: new Date(Date.now() - 86400000).toISOString(),
      endTime: new Date(Date.now() - 82800000).toISOString(),
      status: "CLOSED",
      qrEnabled: true,
      lateCutoffMinutes: 10,
      openTxHash: "0x" + "b".repeat(64),
      closeTxHash: "0x" + "c".repeat(64),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    });

    // Seed initial record where student was marked ABSENT
    db.attendanceRecords.set(`17:${studentHash.toLowerCase()}`, {
      id: `rec-17-alice`,
      sessionId: "sess-17",
      onChainSessionId: 17,
      courseCode: "CS701",
      courseIdHash: ethers.keccak256(ethers.toUtf8Bytes("CS701")),
      sessionTopic: "Smart Contract Security & Audits",
      sessionStartTime: new Date(Date.now() - 86400000).toISOString(),
      sessionStatus: "CLOSED",
      studentId: "stud-1",
      syntheticRollNo: "SYN-2026-042",
      syntheticName: "Student Alice",
      studentIdHash: studentHash,
      draftStatus: "ABSENT",
      onChainStatus: "ABSENT",
      effectiveStatus: "ABSENT",
      checkInMethod: "TEACHER_MANUAL",
      amendmentCount: 0,
      updatedByWallet: teacherWallet.address.toLowerCase(),
      txHash: "0x" + "c".repeat(64),
      blockNumber: 100,
      recordedAt: new Date(Date.now() - 86400000).toISOString(),
      amendedAt: null,
    });
  });

  it("allows student to submit an attendance dispute with valid reason", async () => {
    const disputeReq = createAuthedRequest(
      "http://localhost:3000/api/attendance/corrections",
      "POST",
      studentToken,
      {
        action: "DISPUTE",
        sessionId: 17,
        desiredStatus: "EXCUSED",
        reasonText: "Approved Medical Certificate #MC-104",
      }
    );

    const disputeRes = await correctionsPost(disputeReq);
    expect(disputeRes.status).toBe(200);
    const data = await disputeRes.json();
    expect(data.success).toBe(true);
    expect(data.dispute.requestStatus).toBe("PENDING_DISPUTE");
    expect(data.dispute.previousStatus).toBe("ABSENT");
    expect(data.dispute.newStatus).toBe("EXCUSED");
    expect(data.dispute.reasonHash).toBe(
      computeReasonHash("Approved Medical Certificate #MC-104")
    );
  });

  it("rejects dispute submission if reason is under 10 characters", async () => {
    const invalidReq = createAuthedRequest(
      "http://localhost:3000/api/attendance/corrections",
      "POST",
      studentToken,
      {
        action: "DISPUTE",
        sessionId: 17,
        desiredStatus: "EXCUSED",
        reasonText: "Sick today", // 10 chars exact, let's test 9 chars
      }
    );

    const invalidReqShort = createAuthedRequest(
      "http://localhost:3000/api/attendance/corrections",
      "POST",
      studentToken,
      {
        action: "DISPUTE",
        sessionId: 17,
        desiredStatus: "EXCUSED",
        reasonText: "Sick note", // 9 chars
      }
    );

    const res = await correctionsPost(invalidReqShort);
    expect(res.status).toBe(400);
  });

  it("executes teacher on-chain correction, updates attendance percentage, and preserves audit log", async () => {
    const dummyTx = "0x" + "f".repeat(64);

    const correctReq = createAuthedRequest(
      "http://localhost:3000/api/attendance/corrections",
      "POST",
      teacherToken,
      {
        action: "EXECUTE_CORRECTION",
        sessionId: 17,
        studentIdHash: studentHash,
        newStatus: "EXCUSED",
        reasonText: "Approved Medical Certificate #MC-104",
        txHash: dummyTx,
      }
    );

    const res = await correctionsPost(correctReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.correction.newStatus).toBe("EXCUSED");

    // Check attendance records and calculator metrics:
    // EXCUSED sessions are excluded from the denominator in calculateAttendanceMetrics
    const attReq = createAuthedRequest(
      "http://localhost:3000/api/attendance",
      "GET",
      studentToken
    );
    const attRes = await attendanceGet(attReq);
    expect(attRes.status).toBe(200);
    const attData = await attRes.json();

    expect(attData.records[0].effectiveStatus).toBe("EXCUSED");
    expect(attData.records[0].amendmentCount).toBe(1);
    expect(attData.metrics.excusedCount).toBe(1);
    expect(attData.metrics.eligibleSessionsCount).toBe(0); // Excluded from denominator

    // Check corrections list contains the amendment record
    const getCorrReq = createAuthedRequest(
      "http://localhost:3000/api/attendance/corrections",
      "GET",
      studentToken
    );
    const corrRes = await correctionsGet(getCorrReq);
    expect(corrRes.status).toBe(200);
    const corrData = await corrRes.json();
    expect(corrData.corrections.length).toBe(1);
    expect(corrData.corrections[0].requestStatus).toBe("APPROVED_ON_CHAIN");
  });
});
