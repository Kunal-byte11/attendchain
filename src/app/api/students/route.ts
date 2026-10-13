import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ethers } from "ethers";
import { getMemoryDb, getInstitutionSalt } from "@/lib/db/client";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { computeStudentIdHash } from "@/lib/attendance/identity";
import type { StudentProfile } from "@/types";
import { logger } from "@/lib/logger";

const studentPostSchema = z.object({
  syntheticRollNo: z
    .string()
    .regex(
      /^SYN-[A-Z0-9-]+$/,
      "Must be a synthetic roll number starting with SYN-"
    ),
  syntheticName: z
    .string()
    .min(2, "Synthetic name must be at least 2 characters")
    .max(100),
  department: z.string().min(2, "Department must be at least 2 characters"),
  semester: z.number().int().min(1).max(8),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid 20-byte Ethereum address")
    .optional()
    .nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    const token = sessionCookie?.value;
    if (!token) {
      return NextResponse.json(
        {
          error: { code: "UNAUTHORIZED", message: "Authentication required." },
        },
        { status: 401 }
      );
    }

    const session = await verifySessionToken(token);
    if (!session || (session.role !== "ADMIN" && session.role !== "TEACHER")) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message:
              "Administrator or Teacher role required to view student profiles.",
          },
        },
        { status: 403 }
      );
    }

    const db = getMemoryDb();
    const url = new URL(request.url);
    const courseId = url.searchParams.get("courseId");

    let students = Array.from(db.students.values());

    if (courseId) {
      // Find course to get enrolled hashes
      const course = Array.from(db.courses.values()).find(
        (c) =>
          c.id === courseId ||
          c.courseCode === courseId ||
          c.courseIdHash === courseId
      );
      if (course) {
        const enrolledSet = new Set(
          course.enrolledStudentHashes.map((h) => h.toLowerCase())
        );
        students = students.filter((s) =>
          enrolledSet.has(s.studentIdHash.toLowerCase())
        );
      }
    }

    return NextResponse.json({ students });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error ? err.message : "Failed to fetch students",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    const token = sessionCookie?.value;
    if (!token) {
      return NextResponse.json(
        {
          error: { code: "UNAUTHORIZED", message: "Authentication required." },
        },
        { status: 401 }
      );
    }

    const session = await verifySessionToken(token);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Administrator role required to register students.",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Check synthetic roll format explicitly first for standard rejection code
    if (
      typeof body.syntheticRollNo !== "string" ||
      !body.syntheticRollNo.startsWith("SYN-")
    ) {
      return NextResponse.json(
        {
          error: {
            code: "NON_SYNTHETIC_ROLL_REJECTED",
            message:
              "Roll number rejected: AttendChain strictly requires synthetic roll numbers matching ^SYN-[A-Z0-9-]+$ (e.g., SYN-2026-042).",
          },
        },
        { status: 400 }
      );
    }

    const parsed = studentPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid student registration parameters.",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const {
      syntheticRollNo,
      syntheticName,
      department,
      semester,
      walletAddress,
    } = parsed.data;

    const salt = getInstitutionSalt();
    const studentIdHash = computeStudentIdHash(salt, syntheticRollNo);

    const db = getMemoryDb();

    // Check for duplicate student
    const existingStudent = db.students.get(studentIdHash.toLowerCase());
    if (existingStudent) {
      return NextResponse.json(
        {
          error: {
            code: "DUPLICATE_STUDENT",
            message: `Student with roll number "${syntheticRollNo}" is already registered.`,
          },
        },
        { status: 409 }
      );
    }

    const claimCode = `CLAIM-${syntheticRollNo.replace(/^SYN-/, "")}`;
    const studentId = `std-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newStudent: StudentProfile = {
      id: studentId,
      syntheticRollNo,
      syntheticName,
      studentIdHash,
      walletAddress: walletAddress ? ethers.getAddress(walletAddress) : null,
      claimCode,
      semester,
      department,
      createdAt: new Date().toISOString(),
    };

    db.students.set(studentIdHash.toLowerCase(), newStudent);

    // If walletAddress was provided, also register student user account
    if (walletAddress) {
      const checksummed = ethers.getAddress(walletAddress);
      db.users.set(checksummed.toLowerCase(), {
        id: `usr-${studentId}`,
        walletAddress: checksummed,
        role: "STUDENT",
        displayName: `${syntheticName} (${syntheticRollNo})`,
        department,
        isActive: true,
        studentIdHash,
        createdAt: new Date().toISOString(),
      });
    }

    logger.info("Synthetic student registered successfully", {
      eventCode: "STUDENT_REGISTERED",
      studentId,
      studentIdHash,
      syntheticRollNo,
      department,
      semester,
    });

    return NextResponse.json({ student: newStudent }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error ? err.message : "Failed to register student",
        },
      },
      { status: 500 }
    );
  }
}
