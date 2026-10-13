import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ethers } from "ethers";
import { getMemoryDb } from "@/lib/db/client";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { calculateAttendanceMetrics } from "@/lib/attendance/calculator";
import {
  CODE_TO_ATTENDANCE_STATUS,
  type AttendanceRecordView,
  type AttendanceStatus,
} from "@/types";
import { logger } from "@/lib/logger";

const attendanceBatchPostSchema = z.object({
  sessionId: z.number().int().positive(),
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid 32-byte transaction hash"),
  records: z.array(
    z.object({
      studentIdHash: z
        .string()
        .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid studentIdHash"),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
    })
  ),
  closeSession: z.boolean().optional().default(true),
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

    const sessionUser = await verifySessionToken(token);
    if (!sessionUser) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid session." } },
        { status: 401 }
      );
    }

    const db = getMemoryDb();
    const url = new URL(request.url);
    const sessionIdParam = url.searchParams.get("sessionId");
    const studentIdHashParam = url.searchParams.get("studentIdHash");
    const courseIdParam = url.searchParams.get("courseId");

    let records = Array.from(db.attendanceRecords.values());

    // 1. Session Filter
    if (sessionIdParam) {
      const sId = Number(sessionIdParam);
      records = records.filter((r) => r.onChainSessionId === sId);
    }

    // 2. Course Filter
    if (courseIdParam) {
      records = records.filter(
        (r) =>
          r.courseCode === courseIdParam ||
          r.courseIdHash.toLowerCase() === courseIdParam.toLowerCase()
      );
    }

    // 3. Student Security Guard: Student can only see their own records (FR-012, 04_ARCHITECTURE Section 5)
    if (sessionUser.role === "STUDENT") {
      const callerStudentHash = sessionUser.studentIdHash?.toLowerCase();
      if (!callerStudentHash) {
        records = [];
      } else {
        records = records.filter(
          (r) => r.studentIdHash.toLowerCase() === callerStudentHash
        );
      }
    } else if (studentIdHashParam) {
      records = records.filter(
        (r) =>
          r.studentIdHash.toLowerCase() === studentIdHashParam.toLowerCase()
      );
    }

    // Calculate metrics for returned records
    const calcInputs = records.map((r) => ({
      status: r.effectiveStatus,
      sessionStatus: r.sessionStatus,
    }));
    const metrics = calculateAttendanceMetrics(calcInputs);

    return NextResponse.json({ records, metrics });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error
              ? err.message
              : "Failed to fetch attendance records",
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

    const sessionUser = await verifySessionToken(token);
    if (
      !sessionUser ||
      (sessionUser.role !== "TEACHER" && sessionUser.role !== "ADMIN")
    ) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message:
              "Faculty or Administrator role required to commit attendance.",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = attendanceBatchPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid batch attendance parameters.",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const { sessionId, txHash, records, closeSession } = parsed.data;

    const db = getMemoryDb();
    const lectureSession = db.sessions.get(sessionId);

    if (!lectureSession) {
      return NextResponse.json(
        {
          error: {
            code: "SESSION_NOT_FOUND",
            message: `Session #${sessionId} not found.`,
          },
        },
        { status: 404 }
      );
    }

    // Verify course teacher assignment
    const callerAddress = sessionUser.walletAddress.toLowerCase();
    const isAssigned =
      lectureSession.teacherWallet.toLowerCase() === callerAddress;
    if (sessionUser.role !== "ADMIN" && !isAssigned) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_COURSE_TEACHER",
            message: "You are not the assigned instructor for this session.",
          },
        },
        { status: 403 }
      );
    }

    // Update attendance records in database
    let syncedCount = 0;
    const nowIso = new Date().toISOString();

    for (const item of records) {
      const studentHash = item.studentIdHash.toLowerCase();
      const key = `${sessionId}:${studentHash}`;
      const existing = db.attendanceRecords.get(key);
      const student = db.students.get(studentHash);

      const record: AttendanceRecordView = {
        id: existing?.id ?? `att-${sessionId}-${studentHash.slice(0, 8)}`,
        sessionId: lectureSession.id,
        onChainSessionId: sessionId,
        courseCode: lectureSession.courseCode,
        courseIdHash: lectureSession.courseIdHash,
        sessionTopic: lectureSession.topic,
        sessionStartTime: lectureSession.startTime,
        sessionStatus: closeSession ? "CLOSED" : "OPEN",
        studentId: student?.id ?? `std-${studentHash.slice(0, 8)}`,
        syntheticRollNo: student?.syntheticRollNo ?? "SYN-2026-000",
        syntheticName: student?.syntheticName ?? "Anonymous Student",
        studentIdHash: studentHash,
        draftStatus: item.status,
        onChainStatus: item.status,
        effectiveStatus: item.status,
        checkInMethod: existing?.checkInMethod ?? "TEACHER_MANUAL",
        amendmentCount: existing?.amendmentCount ?? 0,
        updatedByWallet: ethers.getAddress(sessionUser.walletAddress),
        txHash,
        blockNumber: 1,
        recordedAt: existing?.recordedAt ?? nowIso,
        amendedAt: existing?.amendedAt ?? null,
      };

      db.attendanceRecords.set(key, record);
      syncedCount++;
    }

    if (closeSession) {
      lectureSession.status = "CLOSED";
      lectureSession.closeTxHash = txHash;
    }

    logger.info("Batch attendance committed and indexed", {
      eventCode: "ATTENDANCE_BATCH_COMMITTED",
      sessionId,
      courseCode: lectureSession.courseCode,
      committedCount: syncedCount,
      closeSession,
      txHash,
    });

    return NextResponse.json({
      success: true,
      syncedCount,
      txHash,
      sessionStatus: lectureSession.status,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error
              ? err.message
              : "Failed to commit batch attendance",
        },
      },
      { status: 500 }
    );
  }
}
