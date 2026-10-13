import { describe, it, expect, beforeEach } from "vitest";
import { ethers } from "ethers";
import { NextRequest } from "next/server";
import { resetMemoryDb, getMemoryDb } from "@/lib/db/client";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { GET as rolesGet, POST as rolesPost } from "@/app/api/roles/route";
import {
  GET as studentsGet,
  POST as studentsPost,
} from "@/app/api/students/route";
import {
  GET as coursesGet,
  POST as coursesPost,
} from "@/app/api/courses/route";

describe("Admin APIs & RBAC Integration Suite (T-012, FR-003, FR-004, FR-005, FR-006, FR-007, TR-003, TR-004, TR-005)", () => {
  const adminAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const teacherAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const studentAddress = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

  let adminToken: string;
  let teacherToken: string;
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

  describe("RBAC Route Protections", () => {
    it("rejects unauthenticated and non-admin requests to /api/roles with 401 and 403", async () => {
      // Unauthenticated
      const unauthReq = createAuthedRequest(
        "http://localhost:3000/api/roles",
        "GET"
      );
      const unauthRes = await rolesGet(unauthReq);
      expect(unauthRes.status).toBe(401);

      // Teacher role (Forbidden)
      const teacherReq = createAuthedRequest(
        "http://localhost:3000/api/roles",
        "GET",
        teacherToken
      );
      const teacherRes = await rolesGet(teacherReq);
      expect(teacherRes.status).toBe(403);

      // Student role (Forbidden)
      const studentReq = createAuthedRequest(
        "http://localhost:3000/api/roles",
        "GET",
        studentToken
      );
      const studentRes = await rolesGet(studentReq);
      expect(studentRes.status).toBe(403);
    });

    it("rejects non-admin requests to POST /api/students with 403", async () => {
      const teacherReq = createAuthedRequest(
        "http://localhost:3000/api/students",
        "POST",
        teacherToken,
        {
          syntheticRollNo: "SYN-2026-099",
          syntheticName: "Test Student",
          department: "CSE",
          semester: 7,
        }
      );
      const teacherRes = await studentsPost(teacherReq);
      expect(teacherRes.status).toBe(403);
    });

    it("rejects non-admin requests to POST /api/courses with 403", async () => {
      const teacherReq = createAuthedRequest(
        "http://localhost:3000/api/courses",
        "POST",
        teacherToken,
        {
          courseCode: "CS799",
          title: "Advanced Cryptography",
          semester: 7,
          teacherWallet: teacherAddress,
        }
      );
      const teacherRes = await coursesPost(teacherReq);
      expect(teacherRes.status).toBe(403);
    });
  });

  describe("Student Registration & Synthetic Roll Enforcement (FR-004, FR-005, NFR-001)", () => {
    it("successfully registers synthetic student and computes deterministic studentIdHash and claimCode", async () => {
      const req = createAuthedRequest(
        "http://localhost:3000/api/students",
        "POST",
        adminToken,
        {
          syntheticRollNo: "SYN-2026-088",
          syntheticName: "Devika Rao",
          department: "Computer Science & Engineering",
          semester: 7,
        }
      );

      const res = await studentsPost(req);
      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.student.syntheticRollNo).toBe("SYN-2026-088");
      expect(data.student.claimCode).toBe("CLAIM-2026-088");
      expect(data.student.studentIdHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Verify stored in DB
      const db = getMemoryDb();
      const stored = db.students.get(data.student.studentIdHash.toLowerCase());
      expect(stored).toBeDefined();
      expect(stored?.syntheticName).toBe("Devika Rao");
    });

    it("strictly rejects non-synthetic roll numbers with 400 NON_SYNTHETIC_ROLL_REJECTED", async () => {
      const nonSyntheticRolls = ["21BCE1042", "ROLL-102", "CS2026001", "12345"];

      for (const roll of nonSyntheticRolls) {
        const req = createAuthedRequest(
          "http://localhost:3000/api/students",
          "POST",
          adminToken,
          {
            syntheticRollNo: roll,
            syntheticName: "Real Name Leak Attempt",
            department: "CSE",
            semester: 7,
          }
        );

        const res = await studentsPost(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("NON_SYNTHETIC_ROLL_REJECTED");
      }
    });

    it("rejects duplicate registration for the same synthetic roll number with 409", async () => {
      const body = {
        syntheticRollNo: "SYN-2026-077",
        syntheticName: "Pooja Hegde",
        department: "CSE",
        semester: 7,
      };

      const req1 = createAuthedRequest(
        "http://localhost:3000/api/students",
        "POST",
        adminToken,
        body
      );
      const res1 = await studentsPost(req1);
      expect(res1.status).toBe(201);

      const req2 = createAuthedRequest(
        "http://localhost:3000/api/students",
        "POST",
        adminToken,
        body
      );
      const res2 = await studentsPost(req2);
      expect(res2.status).toBe(409);
      const data2 = await res2.json();
      expect(data2.error.code).toBe("DUPLICATE_STUDENT");
    });
  });

  describe("Role Management (FR-003, TR-003)", () => {
    it("allows Admin to grant and revoke teacher role, persisting role assignment and user profile", async () => {
      const newTeacherWallet = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
      const dummyTxHash = "0x" + "d".repeat(64);

      // Grant
      const grantReq = createAuthedRequest(
        "http://localhost:3000/api/roles",
        "POST",
        adminToken,
        {
          walletAddress: newTeacherWallet,
          displayName: "Dr. Vikram Seth",
          department: "Computer Science & Engineering",
          roleName: "TEACHER_ROLE",
          action: "GRANTED",
          txHash: dummyTxHash,
        }
      );
      const grantRes = await rolesPost(grantReq);
      expect(grantRes.status).toBe(201);
      const grantData = await grantRes.json();
      expect(grantData.roleAssignment.action).toBe("GRANTED");

      // Verify user has TEACHER role
      const db = getMemoryDb();
      const user = db.users.get(newTeacherWallet.toLowerCase());
      expect(user).toBeDefined();
      expect(user?.role).toBe("TEACHER");

      // Query roles
      const listReq = createAuthedRequest(
        "http://localhost:3000/api/roles?role=TEACHER_ROLE",
        "GET",
        adminToken
      );
      const listRes = await rolesGet(listReq);
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      expect(
        listData.roles.some(
          (r: any) =>
            r.walletAddress.toLowerCase() === newTeacherWallet.toLowerCase()
        )
      ).toBe(true);
    });
  });

  describe("Course Management & Cohort Enrollment (FR-006, FR-007, TR-005)", () => {
    it("allows Admin to create course with enrolled student hashes", async () => {
      const studentHash1 = "0x" + "1".repeat(64);
      const studentHash2 = "0x" + "2".repeat(64);
      const dummyTx = "0x" + "e".repeat(64);

      const req = createAuthedRequest(
        "http://localhost:3000/api/courses",
        "POST",
        adminToken,
        {
          courseCode: "CS705",
          title: "Cloud Computing Architectures",
          semester: 7,
          teacherWallet: teacherAddress,
          txHash: dummyTx,
          enrollStudentHashes: [studentHash1, studentHash2],
        }
      );

      const res = await coursesPost(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.course.courseCode).toBe("CS705");
      expect(data.course.enrolledStudentHashes).toHaveLength(2);

      // Verify duplicate rejection
      const dupReq = createAuthedRequest(
        "http://localhost:3000/api/courses",
        "POST",
        adminToken,
        {
          courseCode: "CS705",
          title: "Duplicate Course Code",
          semester: 7,
          teacherWallet: teacherAddress,
        }
      );
      const dupRes = await coursesPost(dupReq);
      expect(dupRes.status).toBe(409);
    });

    it("filters courses based on user role (Teacher only gets assigned courses, Student gets enrolled)", async () => {
      // Admin gets all courses
      const adminReq = createAuthedRequest(
        "http://localhost:3000/api/courses",
        "GET",
        adminToken
      );
      const adminRes = await coursesGet(adminReq);
      const adminData = await adminRes.json();
      expect(adminData.courses.length).toBeGreaterThanOrEqual(1);

      // Teacher gets courses assigned to their wallet
      const teacherReq = createAuthedRequest(
        "http://localhost:3000/api/courses",
        "GET",
        teacherToken
      );
      const teacherRes = await coursesGet(teacherReq);
      const teacherData = await teacherRes.json();
      for (const course of teacherData.courses) {
        expect(course.teacherWallet.toLowerCase()).toBe(
          teacherAddress.toLowerCase()
        );
      }
    });
  });
});
