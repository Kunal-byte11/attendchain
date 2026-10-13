import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  computeCourseIdHash,
  computeReasonHash,
  computeStudentIdHash,
} from "../attendance/identity";
import type {
  AttendanceCorrectionView,
  AttendanceRecordView,
  Course,
  LectureSession,
  RoleAssignment,
  StudentProfile,
  UserProfile,
} from "../../types";

export const DEFAULT_DEMO_SALT =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

export function getInstitutionSalt(): string {
  return process.env.INSTITUTION_HASH_SALT || DEFAULT_DEMO_SALT;
}

export function createSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }
  return createClient(url, anonKey);
}

export function createSupabaseServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return null;
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Deterministic in-memory store seeded with synthetic fixtures from supabase/seed.sql
 * so local development, unit/integration suites, and E2E tests operate deterministically
 * alongside or without an external cloud Supabase instance.
 */
export interface InMemoryDatabase {
  users: Map<string, UserProfile>;
  nonces: Map<
    string,
    {
      walletAddress: string;
      nonce: string;
      expiresAt: number;
      consumedAt: number | null;
    }
  >;
  students: Map<string, StudentProfile>;
  courses: Map<string, Course>;
  sessions: Map<number, LectureSession>;
  attendanceRecords: Map<string, AttendanceRecordView>;
  corrections: AttendanceCorrectionView[];
  roleAssignments: RoleAssignment[];
  qrTokens: Map<
    string,
    {
      sessionId: number;
      tokenHash: string;
      displayPin: string;
      expiresAt: number;
      isLate: boolean;
      consumedBy: Set<string>; // set of studentIdHashes who checked in with this token
    }
  >;
  indexedEvents: Set<string>;
}

function createInitialSeedDatabase(): InMemoryDatabase {
  const salt = getInstitutionSalt();
  const nowIso = "2026-10-13T09:00:00.000Z";

  const student1Hash = computeStudentIdHash(salt, "SYN-2026-042");
  const student2Hash = computeStudentIdHash(salt, "SYN-2026-019");
  const student3Hash = computeStudentIdHash(salt, "SYN-2026-007");

  const users = new Map<string, UserProfile>([
    [
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase(),
      {
        id: "usr-admin-1",
        walletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        role: "ADMIN",
        displayName: "Dr. Rajesh Sharma",
        department: "Academic Administration",
        isActive: true,
        createdAt: nowIso,
      },
    ],
    [
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".toLowerCase(),
      {
        id: "usr-teacher-1",
        walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        role: "TEACHER",
        displayName: "Prof. Ananya Verma",
        department: "Computer Science & Engineering",
        isActive: true,
        createdAt: nowIso,
      },
    ],
    [
      "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC".toLowerCase(),
      {
        id: "usr-student-1",
        walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        role: "STUDENT",
        displayName: "Aarav Mehta (SYN-2026-042)",
        department: "Computer Science & Engineering",
        isActive: true,
        studentIdHash: student1Hash,
        createdAt: nowIso,
      },
    ],
    [
      "0x90F79bf6EB2c4f870365E785982E1f101E93b906".toLowerCase(),
      {
        id: "usr-student-2",
        walletAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        role: "STUDENT",
        displayName: "Diya Nair (SYN-2026-019)",
        department: "Computer Science & Engineering",
        isActive: true,
        studentIdHash: student2Hash,
        createdAt: nowIso,
      },
    ],
  ]);

  const students = new Map<string, StudentProfile>([
    [
      student1Hash,
      {
        id: "std-042",
        syntheticRollNo: "SYN-2026-042",
        syntheticName: "Aarav Mehta",
        studentIdHash: student1Hash,
        walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        claimCode: "CLAIM-SYN-042",
        semester: 7,
        department: "Computer Science & Engineering",
        createdAt: nowIso,
      },
    ],
    [
      student2Hash,
      {
        id: "std-019",
        syntheticRollNo: "SYN-2026-019",
        syntheticName: "Diya Nair",
        studentIdHash: student2Hash,
        walletAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        claimCode: "CLAIM-SYN-019",
        semester: 7,
        department: "Computer Science & Engineering",
        createdAt: nowIso,
      },
    ],
    [
      student3Hash,
      {
        id: "std-007",
        syntheticRollNo: "SYN-2026-007",
        syntheticName: "Rohan Kulkarni",
        studentIdHash: student3Hash,
        walletAddress: null,
        claimCode: "CLAIM-SYN-007",
        semester: 7,
        department: "Computer Science & Engineering",
        createdAt: nowIso,
      },
    ],
  ]);

  const cs701Hash = computeCourseIdHash("CS701");
  const cs702Hash = computeCourseIdHash("CS702");

  const courses = new Map<string, Course>([
    [
      cs701Hash,
      {
        id: "crs-cs701",
        courseCode: "CS701",
        courseIdHash: cs701Hash,
        title: "Blockchain Architecture & Smart Contracts",
        semester: 7,
        teacherWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        txHash:
          "0x8a3f91b2c4d5e6f70123456789abcdef0123456789abcdef0123456789abcdef",
        isActive: true,
        enrolledStudentHashes: [student1Hash, student2Hash, student3Hash],
        createdAt: nowIso,
      },
    ],
    [
      cs702Hash,
      {
        id: "crs-cs702",
        courseCode: "CS702",
        courseIdHash: cs702Hash,
        title: "Distributed Consensus Systems",
        semester: 7,
        teacherWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        txHash:
          "0x7b4e82a1c4d5e6f70123456789abcdef0123456789abcdef0123456789abcdef",
        isActive: true,
        enrolledStudentHashes: [student1Hash, student2Hash],
        createdAt: nowIso,
      },
    ],
  ]);

  const sampleCorrectionReason = "Approved Medical Certificate Ref #MC-104";
  const sampleReasonHash = computeReasonHash(sampleCorrectionReason);

  return {
    users,
    nonces: new Map(),
    students,
    courses,
    sessions: new Map(),
    attendanceRecords: new Map(),
    corrections: [
      {
        id: "corr-seed-1",
        attendanceRecordId: "att-seed-1",
        onChainSessionId: 1,
        courseCode: "CS701",
        syntheticRollNo: "SYN-2026-019",
        studentIdHash: student2Hash,
        requestedByWallet: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        requestStatus: "APPROVED_ON_CHAIN",
        previousStatus: "ABSENT",
        newStatus: "EXCUSED",
        reasonText: sampleCorrectionReason,
        reasonHash: sampleReasonHash,
        approvedByWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        txHash:
          "0x9f1a3c4d5e6f70123456789abcdef0123456789abcdef0123456789abcdef012",
        blockNumber: 7482910,
        createdAt: nowIso,
      },
    ],
    roleAssignments: [
      {
        id: "role-assign-1",
        walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        roleName: "TEACHER_ROLE",
        displayName: "Prof. Ananya Verma",
        department: "Computer Science & Engineering",
        action: "GRANTED",
        txHash:
          "0x6a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef",
        assignedAt: nowIso,
      },
    ],
    qrTokens: new Map(),
    indexedEvents: new Set(),
  };
}

const globalForDb = globalThis as unknown as {
  __attendchainDb?: InMemoryDatabase;
};

export function getMemoryDb(): InMemoryDatabase {
  if (!globalForDb.__attendchainDb) {
    globalForDb.__attendchainDb = createInitialSeedDatabase();
  }
  return globalForDb.__attendchainDb;
}

export function resetMemoryDb(): InMemoryDatabase {
  globalForDb.__attendchainDb = createInitialSeedDatabase();
  return globalForDb.__attendchainDb;
}
