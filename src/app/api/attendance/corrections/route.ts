import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ethers } from "ethers";
import { getMemoryDb } from "@/lib/db/client";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { computeReasonHash } from "@/lib/attendance/identity";
import {
  CODE_TO_ATTENDANCE_STATUS,
  type AttendanceCorrectionView,
  type AttendanceStatus,
} from "@/types";
import { logger } from "@/lib/logger";

const createDisputeSchema = z.object({
  action: z.literal("DISPUTE"),
  sessionId: z.number().int().positive(),
  desiredStatus: z.enum(["PRESENT", "EXCUSED", "LATE"]),
  reasonText: z
    .string()
    .min(10, "Correction reason must be at least 10 characters long.")
    .max(500),
});

const executeCorrectionSchema = z.object({
  action: z.literal("EXECUTE_CORRECTION"),
  sessionId: z.number().int().positive(),
  studentIdHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid studentIdHash format."),
  newStatus: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  reasonText: z
    .string()
    .min(10, "Correction reason must be at least 10 characters long.")
    .max(500),
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid 32-byte transaction hash."),
  disputeId: z.string().optional(),
});

const correctionsPostSchema = z.discriminatedUnion("action", [
  createDisputeSchema,
  executeCorrectionSchema,
]);

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
    const statusParam = url.searchParams.get("status");

    let items = [...db.corrections];

    // Filter by Session
    if (sessionIdParam) {
      const sId = Number(sessionIdParam);
      items = items.filter((c) => c.onChainSessionId === sId);
    }

    // Filter by requestStatus
    if (statusParam) {
      items = items.filter((c) => c.requestStatus === statusParam);
    }

    // Role-based visibility
    if (sessionUser.role === "STUDENT") {
      const studentHash = sessionUser.studentIdHash?.toLowerCase();
      if (!studentHash) {
        items = [];
      } else {
        items = items.filter(
          (c) => c.studentIdHash.toLowerCase() === studentHash
        );
      }
    } else if (sessionUser.role === "TEACHER") {
      // Teachers see disputes/corrections for sessions belonging to courses they teach
      const teacherAddr = sessionUser.walletAddress.toLowerCase();
      const teacherCourseCodes = new Set(
        Array.from(db.courses.values())
          .filter((c) => c.teacherWallet.toLowerCase() === teacherAddr)
          .map((c) => c.courseCode)
      );

      items = items.filter((c) => teacherCourseCodes.has(c.courseCode));
    }

    // Return in reverse chronological order
    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ corrections: items });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error ? err.message : "Failed to fetch corrections",
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
    if (!sessionUser) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid session." } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = correctionsPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Validation failed.",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const db = getMemoryDb();

    // ACTION 1: STUDENT DISPUTE SUBMISSION
    if (parsed.data.action === "DISPUTE") {
      if (sessionUser.role !== "STUDENT") {
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "Only students can submit attendance disputes.",
            },
          },
          { status: 403 }
        );
      }

      const { sessionId, desiredStatus, reasonText } = parsed.data;
      const studentIdHash = sessionUser.studentIdHash?.toLowerCase();
      if (!studentIdHash) {
        return NextResponse.json(
          {
            error: {
              code: "WALLET_NOT_BOUND",
              message: "Student wallet is not bound to a profile.",
            },
          },
          { status: 403 }
        );
      }

      const session = db.sessions.get(sessionId);
      if (!session) {
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

      if (session.status !== "CLOSED") {
        return NextResponse.json(
          {
            error: {
              code: "SESSION_NOT_CLOSED",
              message: "Disputes can only be filed against closed sessions.",
            },
          },
          { status: 400 }
        );
      }

      const recordKey = `${sessionId}:${studentIdHash}`;
      const record = db.attendanceRecords.get(recordKey);
      if (!record) {
        return NextResponse.json(
          {
            error: {
              code: "ATTENDANCE_NOT_FOUND",
              message: "No attendance record found for this session.",
            },
          },
          { status: 404 }
        );
      }

      if (record.effectiveStatus === desiredStatus) {
        return NextResponse.json(
          {
            error: {
              code: "IDENTICAL_STATUS",
              message: `Current status is already ${desiredStatus}.`,
            },
          },
          { status: 400 }
        );
      }

      const reasonHash = computeReasonHash(reasonText);
      const studentProfile = db.students.get(studentIdHash);

      const disputeRecord: AttendanceCorrectionView = {
        id: `disp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        attendanceRecordId: record.id,
        onChainSessionId: sessionId,
        courseCode: session.courseCode,
        syntheticRollNo:
          studentProfile?.syntheticRollNo || record.syntheticRollNo,
        studentIdHash,
        requestedByWallet: ethers.getAddress(sessionUser.walletAddress),
        requestStatus: "PENDING_DISPUTE",
        previousStatus: record.effectiveStatus,
        newStatus: desiredStatus,
        reasonText: reasonText.trim(),
        reasonHash,
        approvedByWallet: null,
        txHash: null,
        blockNumber: null,
        createdAt: new Date().toISOString(),
      };

      db.corrections.push(disputeRecord);

      logger.info("Student attendance dispute created", {
        eventCode: "DISPUTE_SUBMITTED",
        sessionId,
        studentIdHash,
        disputeId: disputeRecord.id,
      });

      return NextResponse.json({
        success: true,
        dispute: disputeRecord,
      });
    }

    // ACTION 2: TEACHER / ADMIN ON-CHAIN CORRECTION EXECUTION
    if (parsed.data.action === "EXECUTE_CORRECTION") {
      if (sessionUser.role !== "TEACHER" && sessionUser.role !== "ADMIN") {
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message:
                "Faculty or Administrator role required for corrections.",
            },
          },
          { status: 403 }
        );
      }

      const {
        sessionId,
        studentIdHash,
        newStatus,
        reasonText,
        txHash,
        disputeId,
      } = parsed.data;

      const session = db.sessions.get(sessionId);
      if (!session) {
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

      if (session.status !== "CLOSED") {
        return NextResponse.json(
          {
            error: {
              code: "SESSION_NOT_CLOSED",
              message: "Corrections can only be applied to closed sessions.",
            },
          },
          { status: 400 }
        );
      }

      // Check teacher assignment
      if (sessionUser.role === "TEACHER") {
        const callerAddr = sessionUser.walletAddress.toLowerCase();
        if (session.teacherWallet.toLowerCase() !== callerAddr) {
          return NextResponse.json(
            {
              error: {
                code: "FORBIDDEN",
                message:
                  "You are not the assigned instructor for this session.",
              },
            },
            { status: 403 }
          );
        }
      }

      const recordKey = `${sessionId}:${studentIdHash.toLowerCase()}`;
      const record = db.attendanceRecords.get(recordKey);
      if (!record) {
        return NextResponse.json(
          {
            error: {
              code: "RECORD_NOT_FOUND",
              message: "Attendance record not found for this student.",
            },
          },
          { status: 404 }
        );
      }

      if (record.effectiveStatus === newStatus) {
        return NextResponse.json(
          {
            error: {
              code: "IDENTICAL_STATUS",
              message: `New status (${newStatus}) cannot be identical to current status.`,
            },
          },
          { status: 400 }
        );
      }

      const reasonHash = computeReasonHash(reasonText);
      const studentProfile = db.students.get(studentIdHash.toLowerCase());

      // Update the Attendance Record View
      const previousStatus = record.effectiveStatus;
      record.effectiveStatus = newStatus;
      record.amendmentCount += 1;
      record.checkInMethod = "CORRECTION";
      record.updatedByWallet = ethers.getAddress(sessionUser.walletAddress);
      record.amendedAt = new Date().toISOString();

      // If resolving an existing dispute, mark it APPROVED_ON_CHAIN
      let resolvedDispute: AttendanceCorrectionView | undefined;
      if (disputeId) {
        resolvedDispute = db.corrections.find((c) => c.id === disputeId);
        if (resolvedDispute) {
          resolvedDispute.requestStatus = "APPROVED_ON_CHAIN";
          resolvedDispute.approvedByWallet = ethers.getAddress(
            sessionUser.walletAddress
          );
          resolvedDispute.txHash = txHash;
        }
      }

      // If no existing dispute record was updated, append this execution to corrections log
      if (!resolvedDispute) {
        const correctionLog: AttendanceCorrectionView = {
          id: `corr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          attendanceRecordId: record.id,
          onChainSessionId: sessionId,
          courseCode: session.courseCode,
          syntheticRollNo:
            studentProfile?.syntheticRollNo || record.syntheticRollNo,
          studentIdHash: studentIdHash.toLowerCase(),
          requestedByWallet: ethers.getAddress(sessionUser.walletAddress),
          requestStatus: "APPROVED_ON_CHAIN",
          previousStatus,
          newStatus,
          reasonText: reasonText.trim(),
          reasonHash,
          approvedByWallet: ethers.getAddress(sessionUser.walletAddress),
          txHash,
          blockNumber: 105,
          createdAt: new Date().toISOString(),
        };
        db.corrections.push(correctionLog);
      }

      logger.info("On-chain attendance correction indexed", {
        eventCode: "ATTENDANCE_CORRECTED",
        sessionId,
        studentIdHash,
        previousStatus,
        newStatus,
        reasonHash,
        txHash,
      });

      return NextResponse.json({
        success: true,
        correction: {
          sessionId,
          studentIdHash,
          previousStatus,
          newStatus,
          reasonHash,
          txHash,
        },
      });
    }

    return NextResponse.json(
      { error: { code: "INVALID_ACTION", message: "Unsupported action." } },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error ? err.message : "Failed to process correction",
        },
      },
      { status: 500 }
    );
  }
}
