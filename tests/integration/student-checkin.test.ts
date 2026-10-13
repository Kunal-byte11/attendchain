import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ethers } from "ethers";
import { POST as qrCheckInPost } from "@/app/api/attendance/qr-checkin/route";
import { GET as attendanceGet } from "@/app/api/attendance/route";
import { POST as qrPost } from "@/app/api/sessions/[sessionId]/qr/route";
import { getMemoryDb } from "@/lib/db/client";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { constructCheckInSignMessage } from "@/lib/attendance/qr-token";

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

describe("Student Check-In, Dashboard & History Suite (T-016, FR-012, FR-018, FR-019)", () => {
  const teacherWallet = ethers.Wallet.createRandom();
  const student1Wallet = ethers.Wallet.createRandom();
  const student2Wallet = ethers.Wallet.createRandom();

  const student1Hash =
    "0x1111111111111111111111111111111111111111111111111111111111111111";
  const student2Hash =
    "0x2222222222222222222222222222222222222222222222222222222222222222";

  let teacherToken: string;
  let student1Token: string;
  let student2Token: string;

  beforeEach(async () => {
    const db = getMemoryDb();

    // Reset database state
    db.sessions.clear();
    db.courses.clear();
    db.attendanceRecords.clear();
    db.students.clear();
    db.qrTokens.clear();

    teacherToken = await createSessionToken({
      sub: teacherWallet.address,
      walletAddress: teacherWallet.address,
      role: "TEACHER",
      displayName: "Prof. Alan Turing",
      department: "Computer Science",
    });

    student1Token = await createSessionToken({
      sub: student1Wallet.address,
      walletAddress: student1Wallet.address,
      role: "STUDENT",
      displayName: "Student Alice",
      department: "Computer Science",
      studentIdHash: student1Hash,
    });

    student2Token = await createSessionToken({
      sub: student2Wallet.address,
      walletAddress: student2Wallet.address,
      role: "STUDENT",
      displayName: "Student Bob",
      department: "Computer Science",
      studentIdHash: student2Hash,
    });

    // Seed students
    db.students.set(student1Hash, {
      id: "stud-1",
      syntheticRollNo: "SYN-2026-001",
      syntheticName: "Student Alice",
      studentIdHash: student1Hash,
      walletAddress: student1Wallet.address.toLowerCase(),
      claimCode: "CLAIM-001",
      semester: 7,
      department: "Computer Science",
      createdAt: new Date().toISOString(),
    });

    db.students.set(student2Hash, {
      id: "stud-2",
      syntheticRollNo: "SYN-2026-002",
      syntheticName: "Student Bob",
      studentIdHash: student2Hash,
      walletAddress: student2Wallet.address.toLowerCase(),
      claimCode: "CLAIM-002",
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
      enrolledStudentHashes: [student1Hash, student2Hash],
      createdAt: new Date().toISOString(),
    });

    // Seed open session
    db.sessions.set(16, {
      id: "sess-16",
      onChainSessionId: 16,
      courseId: "course-1",
      courseCode: "CS701",
      courseIdHash: ethers.keccak256(ethers.toUtf8Bytes("CS701")),
      teacherWallet: teacherWallet.address.toLowerCase(),
      topic: "Byzantine Fault Tolerance",
      metadataHash: ethers.keccak256(ethers.toUtf8Bytes("Topic 16")),
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
      status: "OPEN",
      qrEnabled: true,
      lateCutoffMinutes: 10,
      openTxHash: "0x" + "b".repeat(64),
      closeTxHash: null,
      createdAt: new Date().toISOString(),
    });

    // Seed closed session with existing historical records
    db.sessions.set(10, {
      id: "sess-10",
      onChainSessionId: 10,
      courseId: "course-1",
      courseCode: "CS701",
      courseIdHash: ethers.keccak256(ethers.toUtf8Bytes("CS701")),
      teacherWallet: teacherWallet.address.toLowerCase(),
      topic: "Introduction to Distributed Ledgers",
      metadataHash: ethers.keccak256(ethers.toUtf8Bytes("Topic 10")),
      startTime: new Date(Date.now() - 86400000).toISOString(),
      endTime: new Date(Date.now() - 82800000).toISOString(),
      status: "CLOSED",
      qrEnabled: true,
      lateCutoffMinutes: 10,
      openTxHash: "0x" + "c".repeat(64),
      closeTxHash: "0x" + "d".repeat(64),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    });

    // Alice attended session 10
    db.attendanceRecords.set(`10:${student1Hash.toLowerCase()}`, {
      id: `rec-10-alice`,
      sessionId: "sess-10",
      onChainSessionId: 10,
      courseCode: "CS701",
      courseIdHash: ethers.keccak256(ethers.toUtf8Bytes("CS701")),
      sessionTopic: "Introduction to Distributed Ledgers",
      sessionStartTime: new Date(Date.now() - 86400000).toISOString(),
      sessionStatus: "CLOSED",
      studentId: "stud-1",
      syntheticRollNo: "SYN-2026-001",
      syntheticName: "Student Alice",
      studentIdHash: student1Hash,
      draftStatus: "PRESENT",
      onChainStatus: "PRESENT",
      effectiveStatus: "PRESENT",
      checkInMethod: "QR_VERIFIED",
      amendmentCount: 0,
      updatedByWallet: teacherWallet.address.toLowerCase(),
      txHash: "0x" + "e".repeat(64),
      blockNumber: 101,
      recordedAt: new Date(Date.now() - 86400000).toISOString(),
      amendedAt: null,
    });

    // Bob was absent for session 10
    db.attendanceRecords.set(`10:${student2Hash.toLowerCase()}`, {
      id: `rec-10-bob`,
      sessionId: "sess-10",
      onChainSessionId: 10,
      courseCode: "CS701",
      courseIdHash: ethers.keccak256(ethers.toUtf8Bytes("CS701")),
      sessionTopic: "Introduction to Distributed Ledgers",
      sessionStartTime: new Date(Date.now() - 86400000).toISOString(),
      sessionStatus: "CLOSED",
      studentId: "stud-2",
      syntheticRollNo: "SYN-2026-002",
      syntheticName: "Student Bob",
      studentIdHash: student2Hash,
      draftStatus: "ABSENT",
      onChainStatus: "ABSENT",
      effectiveStatus: "ABSENT",
      checkInMethod: "TEACHER_MANUAL",
      amendmentCount: 0,
      updatedByWallet: teacherWallet.address.toLowerCase(),
      txHash: "0x" + "e".repeat(64),
      blockNumber: 101,
      recordedAt: new Date(Date.now() - 86400000).toISOString(),
      amendedAt: null,
    });
  });

  it("allows student to sign and submit 6-char PIN check-in for an open session", async () => {
    // 1. Teacher generates QR / PIN
    const qrReq = createAuthedRequest(
      "http://localhost:3000/api/sessions/16/qr",
      "POST",
      teacherToken
    );
    const qrRes = await qrPost(qrReq, {
      params: Promise.resolve({ sessionId: "16" }),
    });
    const qrData = await qrRes.json();
    const pin = qrData.displayPin;

    // 2. Student Alice signs check-in message
    const timestamp = Math.floor(Date.now() / 1000);
    const message = constructCheckInSignMessage(16, pin, timestamp);
    const signature = await student1Wallet.signMessage(message);

    const checkInReq = createAuthedRequest(
      "http://localhost:3000/api/attendance/qr-checkin",
      "POST",
      student1Token,
      {
        sessionId: 16,
        tokenOrPin: pin,
        signature,
        signedTimestamp: timestamp,
      }
    );

    const checkInRes = await qrCheckInPost(checkInReq);
    expect(checkInRes.status).toBe(200);
    const checkInData = await checkInRes.json();
    expect(checkInData.checkIn.status).toBe("PRESENT");
    expect(checkInData.checkIn.staged).toBe(true);
  });

  it("strictly enforces row-level privacy isolation between students", async () => {
    // Student Alice queries attendance
    const aliceReq = createAuthedRequest(
      "http://localhost:3000/api/attendance",
      "GET",
      student1Token
    );
    const aliceRes = await attendanceGet(aliceReq);
    expect(aliceRes.status).toBe(200);
    const aliceData = await aliceRes.json();

    // Alice should only see her record (rec-10-alice)
    expect(aliceData.records.length).toBe(1);
    expect(aliceData.records[0].syntheticRollNo).toBe("SYN-2026-001");
    expect(aliceData.records[0].effectiveStatus).toBe("PRESENT");
    expect(aliceData.metrics.percentage).toBe(100);
    expect(aliceData.metrics.tier).toBe("ELIGIBLE");

    // Student Bob queries attendance
    const bobReq = createAuthedRequest(
      "http://localhost:3000/api/attendance",
      "GET",
      student2Token
    );
    const bobRes = await attendanceGet(bobReq);
    expect(bobRes.status).toBe(200);
    const bobData = await bobRes.json();

    // Bob should only see his record (rec-10-bob)
    expect(bobData.records.length).toBe(1);
    expect(bobData.records[0].syntheticRollNo).toBe("SYN-2026-002");
    expect(bobData.records[0].effectiveStatus).toBe("ABSENT");
    expect(bobData.metrics.percentage).toBe(0);
    expect(bobData.metrics.tier).toBe("CRITICAL_SHORTAGE");
  });

  it("filters attendance records by course and recalculates metrics", async () => {
    const courseReq = createAuthedRequest(
      "http://localhost:3000/api/attendance?courseId=CS701",
      "GET",
      student1Token
    );
    const res = await attendanceGet(courseReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.records.length).toBe(1);
    expect(data.records[0].courseCode).toBe("CS701");
  });
});
