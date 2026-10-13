import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ethers } from "ethers";
import { getMemoryDb } from "@/lib/db/client";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { computeCourseIdHash } from "@/lib/attendance/identity";
import type { Course } from "@/types";
import { logger } from "@/lib/logger";

const coursePostSchema = z.object({
  courseCode: z.string().min(2).max(24),
  title: z.string().min(2).max(100),
  semester: z.number().int().min(1).max(8),
  teacherWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid 20-byte Ethereum address"),
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid 32-byte transaction hash")
    .optional()
    .nullable(),
  enrollStudentHashes: z
    .array(z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid bytes32 hash"))
    .optional()
    .default([]),
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
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid session." } },
        { status: 401 }
      );
    }

    const db = getMemoryDb();
    const url = new URL(request.url);
    const teacherWalletParam = url.searchParams.get("teacherWallet");

    let courses = Array.from(db.courses.values());

    if (session.role === "ADMIN") {
      if (teacherWalletParam) {
        const checksummed = ethers.getAddress(teacherWalletParam).toLowerCase();
        courses = courses.filter(
          (c) => c.teacherWallet.toLowerCase() === checksummed
        );
      }
    } else if (session.role === "TEACHER") {
      const teacherAddr = session.walletAddress.toLowerCase();
      courses = courses.filter(
        (c) => c.teacherWallet.toLowerCase() === teacherAddr
      );
    } else if (session.role === "STUDENT") {
      const studentHash = session.studentIdHash?.toLowerCase();
      if (!studentHash) {
        courses = [];
      } else {
        courses = courses.filter((c) =>
          c.enrolledStudentHashes.some((h) => h.toLowerCase() === studentHash)
        );
      }
    }

    return NextResponse.json({ courses });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error ? err.message : "Failed to fetch courses",
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
            message: "Administrator role required to create courses.",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = coursePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid course parameters.",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const {
      courseCode,
      title,
      semester,
      teacherWallet,
      txHash,
      enrollStudentHashes,
    } = parsed.data;

    const normalizedCode = courseCode.trim().toUpperCase();
    const courseIdHash = computeCourseIdHash(normalizedCode);
    const checksummedTeacher = ethers.getAddress(teacherWallet);

    const db = getMemoryDb();

    // Check if teacher has TEACHER role
    const teacherProfile = db.users.get(checksummedTeacher.toLowerCase());
    if (
      teacherProfile &&
      teacherProfile.role !== "TEACHER" &&
      teacherProfile.role !== "ADMIN"
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TEACHER",
            message: `Wallet ${checksummedTeacher} is registered with role ${teacherProfile.role}, not TEACHER.`,
          },
        },
        { status: 400 }
      );
    }

    // Check if course already exists
    if (db.courses.has(courseIdHash)) {
      return NextResponse.json(
        {
          error: {
            code: "COURSE_EXISTS",
            message: `Course with code "${normalizedCode}" already exists.`,
          },
        },
        { status: 409 }
      );
    }

    const newCourse: Course = {
      id: `crs-${normalizedCode.toLowerCase()}`,
      courseCode: normalizedCode,
      courseIdHash,
      title: title.trim(),
      semester,
      teacherWallet: checksummedTeacher,
      txHash: txHash ?? null,
      isActive: true,
      enrolledStudentHashes: enrollStudentHashes.map((h) => h.toLowerCase()),
      createdAt: new Date().toISOString(),
    };

    db.courses.set(courseIdHash, newCourse);

    logger.info("Course created successfully", {
      eventCode: "COURSE_CREATED",
      courseId: newCourse.id,
      courseCode: normalizedCode,
      courseIdHash,
      teacherWallet: checksummedTeacher,
      enrolledCount: enrollStudentHashes.length,
    });

    return NextResponse.json({ course: newCourse }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error ? err.message : "Failed to create course",
        },
      },
      { status: 500 }
    );
  }
}
