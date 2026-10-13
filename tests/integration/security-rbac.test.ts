import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ethers } from "ethers";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { POST as rolesPost, GET as rolesGet } from "@/app/api/roles/route";
import {
  POST as studentsPost,
  GET as studentsGet,
} from "@/app/api/students/route";
import {
  POST as coursesPost,
  GET as coursesGet,
} from "@/app/api/courses/route";
import {
  POST as sessionsPost,
  GET as sessionsGet,
} from "@/app/api/sessions/route";
import {
  POST as attendancePost,
  GET as attendanceGet,
} from "@/app/api/attendance/route";
import {
  POST as correctionsPost,
  GET as correctionsGet,
} from "@/app/api/attendance/corrections/route";
import { checkRateLimit, resetRateLimitBuckets } from "@/lib/auth/rate-limit";

function makeReq(
  url: string,
  method: "GET" | "POST",
  token?: string,
  body?: unknown
) {
  const headers = new Headers();
  if (token) {
    headers.set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);
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

describe("Security Hardening & RBAC Authorization Matrix (T-019, NFR-005, FR-004)", () => {
  const adminWallet = ethers.Wallet.createRandom();
  const teacherWallet = ethers.Wallet.createRandom();
  const studentWallet = ethers.Wallet.createRandom();

  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;

  beforeEach(async () => {
    resetRateLimitBuckets();

    adminToken = await createSessionToken({
      sub: adminWallet.address,
      walletAddress: adminWallet.address,
      role: "ADMIN",
      displayName: "Admin Alice",
    });

    teacherToken = await createSessionToken({
      sub: teacherWallet.address,
      walletAddress: teacherWallet.address,
      role: "TEACHER",
      displayName: "Teacher Bob",
    });

    studentToken = await createSessionToken({
      sub: studentWallet.address,
      walletAddress: studentWallet.address,
      role: "STUDENT",
      displayName: "Student Charlie",
      studentIdHash: "0x" + "1".repeat(64),
    });
  });

  describe("100% Write API Protection Matrix (Unauthenticated -> 401)", () => {
    it("rejects unauthenticated POST /api/roles with 401", async () => {
      const res = await rolesPost(
        makeReq("http://localhost:3000/api/roles", "POST")
      );
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated POST /api/students with 401", async () => {
      const res = await studentsPost(
        makeReq("http://localhost:3000/api/students", "POST")
      );
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated POST /api/courses with 401", async () => {
      const res = await coursesPost(
        makeReq("http://localhost:3000/api/courses", "POST")
      );
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated POST /api/sessions with 401", async () => {
      const res = await sessionsPost(
        makeReq("http://localhost:3000/api/sessions", "POST")
      );
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated POST /api/attendance with 401", async () => {
      const res = await attendancePost(
        makeReq("http://localhost:3000/api/attendance", "POST")
      );
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated POST /api/attendance/corrections with 401", async () => {
      const res = await correctionsPost(
        makeReq("http://localhost:3000/api/attendance/corrections", "POST")
      );
      expect(res.status).toBe(401);
    });
  });

  describe("Cross-Role Privilege Boundaries (Unauthorized -> 403)", () => {
    it("rejects Student role accessing POST /api/roles with 403", async () => {
      const res = await rolesPost(
        makeReq("http://localhost:3000/api/roles", "POST", studentToken, {
          targetWallet: teacherWallet.address,
          roleName: "TEACHER_ROLE",
          action: "GRANT",
          displayName: "Hacker Teacher",
          department: "CS",
          txHash: "0x" + "a".repeat(64),
        })
      );
      expect(res.status).toBe(403);
    });

    it("rejects Teacher role accessing POST /api/roles with 403", async () => {
      const res = await rolesPost(
        makeReq("http://localhost:3000/api/roles", "POST", teacherToken, {
          targetWallet: teacherWallet.address,
          roleName: "DEFAULT_ADMIN_ROLE",
          action: "GRANT",
          displayName: "Self Escalation",
          department: "CS",
          txHash: "0x" + "a".repeat(64),
        })
      );
      expect(res.status).toBe(403);
    });

    it("rejects Student role accessing POST /api/students with 403", async () => {
      const res = await studentsPost(
        makeReq("http://localhost:3000/api/students", "POST", studentToken, {
          syntheticRollNo: "SYN-2026-999",
          syntheticName: "Fake Student",
          semester: 7,
          department: "CS",
        })
      );
      expect(res.status).toBe(403);
    });

    it("rejects Student role attempting to open a lecture session with 403", async () => {
      const res = await sessionsPost(
        makeReq("http://localhost:3000/api/sessions", "POST", studentToken, {
          courseCode: "CS701",
          topic: "Unauthorized Session",
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
          openTxHash: "0x" + "b".repeat(64),
        })
      );
      expect(res.status).toBe(403);
    });
  });

  describe("Sliding-Window Rate Limiting Engine", () => {
    it("allows requests under the rate limit threshold", () => {
      const config = { maxRequests: 5, windowSeconds: 10 };
      for (let i = 0; i < 5; i++) {
        const res = checkRateLimit("client-1", config);
        expect(res.allowed).toBe(true);
      }
    });

    it("blocks request and returns retry-after when threshold exceeded", () => {
      const config = { maxRequests: 3, windowSeconds: 10 };
      checkRateLimit("client-2", config);
      checkRateLimit("client-2", config);
      checkRateLimit("client-2", config);

      const blocked = checkRateLimit("client-2", config);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetSeconds).toBeGreaterThan(0);
    });
  });
});
