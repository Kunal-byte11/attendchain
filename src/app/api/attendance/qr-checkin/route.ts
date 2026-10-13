import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ethers } from "ethers";
import { getMemoryDb } from "@/lib/db/client";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { isQrTokenFresh } from "@/lib/attendance/qr-token";
import type { AttendanceRecordView, AttendanceStatus } from "@/types";
import { logger } from "@/lib/logger";

const qrCheckInSchema = z.object({
  sessionId: z.number().int().positive(),
  tokenOrPin: z.string().min(6),
  signature: z
    .string()
    .regex(/^0x[a-fA-F0-9]{130}$/, "Invalid 65-byte ECDSA signature"),
  signedTimestamp: z.number().int().positive(),
});

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
    if (!sessionUser || sessionUser.role !== "STUDENT") {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Student role required to perform QR check-in.",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = qrCheckInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid check-in parameters.",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const { sessionId, tokenOrPin, signature, signedTimestamp } = parsed.data;

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

    if (lectureSession.status !== "OPEN") {
      return NextResponse.json(
        {
          error: {
            code: "SESSION_NOT_OPEN",
            message: `Session #${sessionId} is ${lectureSession.status}. Check-in closed.`,
          },
        },
        { status: 400 }
      );
    }

    // 1. Verify token freshness and existence
    const cleanTokenOrPin = tokenOrPin.trim();
    const tokenRecord =
      db.qrTokens.get(cleanTokenOrPin) ||
      db.qrTokens.get(cleanTokenOrPin.toUpperCase());

    if (!tokenRecord || tokenRecord.sessionId !== sessionId) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_QR_TOKEN",
            message:
              "The submitted QR code or PIN is invalid for this session.",
          },
        },
        { status: 400 }
      );
    }

    if (!isQrTokenFresh(tokenRecord.expiresAt)) {
      return NextResponse.json(
        {
          error: {
            code: "QR_TOKEN_EXPIRED",
            message:
              "QR code or PIN has expired (30s window exceeded). Please scan active code.",
          },
        },
        { status: 400 }
      );
    }

    // 2. Identify student profile
    const studentAddress = sessionUser.walletAddress.toLowerCase();
    const studentIdHash = sessionUser.studentIdHash?.toLowerCase();

    if (!studentIdHash) {
      return NextResponse.json(
        {
          error: {
            code: "WALLET_NOT_BOUND",
            message: "Your wallet is not bound to a student profile.",
          },
        },
        { status: 403 }
      );
    }

    const studentProfile = db.students.get(studentIdHash);
    if (!studentProfile) {
      return NextResponse.json(
        {
          error: {
            code: "STUDENT_NOT_FOUND",
            message: "Student record not found for this wallet.",
          },
        },
        { status: 404 }
      );
    }

    // 3. Verify Course Enrollment
    const course = Array.from(db.courses.values()).find(
      (c) =>
        c.courseCode === lectureSession.courseCode ||
        c.courseIdHash.toLowerCase() ===
          lectureSession.courseIdHash.toLowerCase()
    );

    if (
      !course ||
      !course.enrolledStudentHashes.some(
        (h) => h.toLowerCase() === studentIdHash
      )
    ) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_ENROLLED",
            message: `Student is not enrolled in ${lectureSession.courseCode}.`,
          },
        },
        { status: 403 }
      );
    }

    // 4. Check for replay or already checked in
    const recordKey = `${sessionId}:${studentIdHash}`;
    const existingRecord = db.attendanceRecords.get(recordKey);
    if (existingRecord && existingRecord.draftStatus !== "NONE") {
      return NextResponse.json(
        {
          error: {
            code: "ALREADY_CHECKED_IN",
            message: `You have already checked in for Session #${sessionId}.`,
          },
        },
        { status: 409 }
      );
    }

    // Mark token as consumed by this student
    tokenRecord.consumedBy.add(studentIdHash);

    const effectiveStatus: AttendanceStatus = tokenRecord.isLate
      ? "LATE"
      : "PRESENT";

    // Stage attendance record in database
    const stagedRecord: AttendanceRecordView = {
      id: `att-${sessionId}-${studentIdHash.slice(0, 8)}`,
      sessionId: lectureSession.id,
      onChainSessionId: sessionId,
      courseCode: lectureSession.courseCode,
      courseIdHash: lectureSession.courseIdHash,
      sessionTopic: lectureSession.topic,
      sessionStartTime: lectureSession.startTime,
      sessionStatus: lectureSession.status,
      studentId: studentProfile.id,
      syntheticRollNo: studentProfile.syntheticRollNo,
      syntheticName: studentProfile.syntheticName,
      studentIdHash,
      draftStatus: effectiveStatus,
      onChainStatus: "NONE", // Staged until batch committed
      effectiveStatus,
      checkInMethod: "QR_VERIFIED",
      amendmentCount: 0,
      updatedByWallet: ethers.getAddress(studentAddress),
      txHash: null,
      blockNumber: null,
      recordedAt: new Date().toISOString(),
      amendedAt: null,
    };

    db.attendanceRecords.set(recordKey, stagedRecord);

    logger.info("Student QR check-in staged successfully", {
      eventCode: "QR_CHECKIN_STAGED",
      sessionId,
      studentIdHash,
      syntheticRollNo: studentProfile.syntheticRollNo,
      effectiveStatus,
    });

    return NextResponse.json({
      success: true,
      checkIn: {
        sessionId,
        status: effectiveStatus,
        staged: true,
        method: "QR_VERIFIED",
        syntheticRollNo: studentProfile.syntheticRollNo,
        recordedAt: stagedRecord.recordedAt,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : "Check-in failed",
        },
      },
      { status: 500 }
    );
  }
}
