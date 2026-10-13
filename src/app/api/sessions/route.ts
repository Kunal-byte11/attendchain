import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ethers } from "ethers";
import { getMemoryDb } from "@/lib/db/client";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { computeMetadataHash } from "@/lib/attendance/identity";
import type { LectureSession } from "@/types";
import { logger } from "@/lib/logger";

const sessionPostSchema = z.object({
  courseId: z.string().min(2),
  onChainSessionId: z.number().int().positive(),
  topic: z.string().min(3).max(200),
  metadataHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid 32-byte metadata hash")
    .optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  openTxHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid 32-byte transaction hash")
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
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid session." } },
        { status: 401 }
      );
    }

    const db = getMemoryDb();
    const url = new URL(request.url);
    const courseId = url.searchParams.get("courseId");
    const status = url.searchParams.get("status");

    let sessionsList = Array.from(db.sessions.values());

    if (courseId) {
      sessionsList = sessionsList.filter(
        (s) =>
          s.courseId === courseId ||
          s.courseCode === courseId ||
          s.courseIdHash.toLowerCase() === courseId.toLowerCase()
      );
    }

    if (status) {
      sessionsList = sessionsList.filter((s) => s.status === status);
    }

    // Role filtering: Teacher only gets their own sessions unless query specifies course
    if (session.role === "TEACHER" && !courseId) {
      const teacherAddr = session.walletAddress.toLowerCase();
      sessionsList = sessionsList.filter(
        (s) => s.teacherWallet.toLowerCase() === teacherAddr
      );
    }

    return NextResponse.json({ sessions: sessionsList });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error ? err.message : "Failed to fetch sessions",
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
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message:
              "Teacher or Administrator role required to open lecture sessions.",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = sessionPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid session creation parameters.",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const {
      courseId,
      onChainSessionId,
      topic,
      metadataHash: providedMetadataHash,
      startTime,
      endTime,
      openTxHash,
    } = parsed.data;

    // Validate time window
    const startUnix = new Date(startTime).getTime();
    const endUnix = new Date(endTime).getTime();
    if (endUnix <= startUnix) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_WINDOW",
            message: "Session end time must be after session start time.",
          },
        },
        { status: 400 }
      );
    }

    const db = getMemoryDb();

    // Find course by ID, code, or courseIdHash
    const course = Array.from(db.courses.values()).find(
      (c) =>
        c.id === courseId ||
        c.courseCode === courseId ||
        c.courseIdHash.toLowerCase() === courseId.toLowerCase()
    );

    if (!course) {
      return NextResponse.json(
        {
          error: {
            code: "COURSE_NOT_FOUND",
            message: `Course "${courseId}" not found.`,
          },
        },
        { status: 404 }
      );
    }

    // Enforce teacher assignment: Caller must be assigned teacher or ADMIN (FR-008)
    const callerAddress = session.walletAddress.toLowerCase();
    const isAssigned = course.teacherWallet.toLowerCase() === callerAddress;
    if (session.role !== "ADMIN" && !isAssigned) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_COURSE_TEACHER",
            message: `Wallet ${session.walletAddress} is not the assigned instructor for ${course.courseCode}.`,
          },
        },
        { status: 403 }
      );
    }

    const metadataHash = providedMetadataHash || computeMetadataHash(topic);

    const newSession: LectureSession = {
      id: `ses-${onChainSessionId}`,
      onChainSessionId,
      courseId: course.id,
      courseCode: course.courseCode,
      courseIdHash: course.courseIdHash,
      teacherWallet: ethers.getAddress(session.walletAddress),
      topic: topic.trim(),
      metadataHash,
      startTime,
      endTime,
      status: "OPEN",
      qrEnabled: true,
      lateCutoffMinutes: 15,
      openTxHash: openTxHash ?? null,
      closeTxHash: null,
      createdAt: new Date().toISOString(),
    };

    db.sessions.set(onChainSessionId, newSession);

    logger.info("Lecture session created successfully", {
      eventCode: "SESSION_CREATED",
      sessionId: onChainSessionId,
      courseCode: course.courseCode,
      teacherWallet: session.walletAddress,
      openTxHash: openTxHash ?? "N/A",
    });

    return NextResponse.json({ session: newSession }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error ? err.message : "Failed to create session",
        },
      },
      { status: 500 }
    );
  }
}
