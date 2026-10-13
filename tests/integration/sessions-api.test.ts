import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { resetMemoryDb, getMemoryDb } from "@/lib/db/client";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {
  GET as sessionsGet,
  POST as sessionsPost,
} from "@/app/api/sessions/route";

describe("Sessions API Suite (T-014, FR-008, FR-009, TR-006)", () => {
  const adminAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const teacherAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const unassignedTeacherAddress = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
  const studentAddress = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

  let adminToken: string;
  let teacherToken: string;
  let unassignedTeacherToken: string;
  let studentToken: string;

  beforeEach(async () => {
    resetMemoryDb();

    adminToken = await createSessionToken({
      sub: adminAddress,
      walletAddress: adminAddress,
      role: "ADMIN",
      displayName: "Dr. Rajesh Sharma",
    });

    teacherToken = await createSessionToken({
      sub: teacherAddress,
      walletAddress: teacherAddress,
      role: "TEACHER",
      displayName: "Prof. Ananya Verma",
    });

    unassignedTeacherToken = await createSessionToken({
      sub: unassignedTeacherAddress,
      walletAddress: unassignedTeacherAddress,
      role: "TEACHER",
      displayName: "Dr. Vikram Seth",
    });

    studentToken = await createSessionToken({
      sub: studentAddress,
      walletAddress: studentAddress,
      role: "STUDENT",
      displayName: "Rohan Kulkarni (SYN-2026-007)",
      studentIdHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
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

  it("allows assigned teacher to open a lecture session for CS701", async () => {
    const now = new Date();
    const startIso = now.toISOString();
    const endIso = new Date(now.getTime() + 50 * 60 * 1000).toISOString();
    const dummyTx = "0x" + "a".repeat(64);

    const req = createAuthedRequest(
      "http://localhost:3000/api/sessions",
      "POST",
      teacherToken,
      {
        courseId: "CS701",
        onChainSessionId: 101,
        topic: "Byzantine Agreement & Raft Consensus",
        startTime: startIso,
        endTime: endIso,
        openTxHash: dummyTx,
      }
    );

    const res = await sessionsPost(req);
    expect(res.status).toBe(201);
    const data = await res.json();

    expect(data.session.onChainSessionId).toBe(101);
    expect(data.session.courseCode).toBe("CS701");
    expect(data.session.status).toBe("OPEN");
    expect(data.session.metadataHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

    const db = getMemoryDb();
    expect(db.sessions.has(101)).toBe(true);
  });

  it("rejects unassigned teacher attempting to open a session for CS701 with 403 NOT_COURSE_TEACHER", async () => {
    const now = new Date();
    const startIso = now.toISOString();
    const endIso = new Date(now.getTime() + 50 * 60 * 1000).toISOString();

    const req = createAuthedRequest(
      "http://localhost:3000/api/sessions",
      "POST",
      unassignedTeacherToken,
      {
        courseId: "CS701",
        onChainSessionId: 102,
        topic: "Unauthorized Session Opening",
        startTime: startIso,
        endTime: endIso,
      }
    );

    const res = await sessionsPost(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("NOT_COURSE_TEACHER");
  });

  it("rejects student role from calling POST /api/sessions with 403", async () => {
    const now = new Date();
    const req = createAuthedRequest(
      "http://localhost:3000/api/sessions",
      "POST",
      studentToken,
      {
        courseId: "CS701",
        onChainSessionId: 103,
        topic: "Student Hacking Attempt",
        startTime: now.toISOString(),
        endTime: new Date(now.getTime() + 3600000).toISOString(),
      }
    );

    const res = await sessionsPost(req);
    expect(res.status).toBe(403);
  });

  it("rejects invalid time windows (endTime <= startTime) with 400 INVALID_WINDOW", async () => {
    const now = new Date();
    const req = createAuthedRequest(
      "http://localhost:3000/api/sessions",
      "POST",
      teacherToken,
      {
        courseId: "CS701",
        onChainSessionId: 104,
        topic: "Negative Duration Session",
        startTime: now.toISOString(),
        endTime: new Date(now.getTime() - 1000).toISOString(), // Ended before start
      }
    );

    const res = await sessionsPost(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_WINDOW");
  });

  it("allows querying sessions by courseId and status", async () => {
    // Query existing seeded sessions
    const req = createAuthedRequest(
      "http://localhost:3000/api/sessions?courseId=CS701",
      "GET",
      teacherToken
    );

    const res = await sessionsGet(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.sessions)).toBe(true);
  });
});
