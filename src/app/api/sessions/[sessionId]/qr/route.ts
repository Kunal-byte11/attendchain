import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMemoryDb } from "@/lib/db/client";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { generateQrSessionChallenge } from "@/lib/attendance/qr-token";
import { logger } from "@/lib/logger";

const qrGenerateSchema = z.object({
  markAsLate: z.boolean().optional().default(false),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
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
              "Faculty or Administrator role required to generate QR codes.",
          },
        },
        { status: 403 }
      );
    }

    const { sessionId: rawSessionId } = await context.params;
    const sessionId = Number(rawSessionId);
    if (isNaN(sessionId) || sessionId <= 0) {
      return NextResponse.json(
        {
          error: { code: "INVALID_SESSION_ID", message: "Invalid session ID." },
        },
        { status: 400 }
      );
    }

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
            message: `Cannot generate QR token: Session #${sessionId} is ${lectureSession.status}.`,
          },
        },
        { status: 400 }
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
            code: "FORBIDDEN",
            message: "You are not the assigned instructor for this session.",
          },
        },
        { status: 403 }
      );
    }

    let markAsLate = false;
    try {
      const body = await request.json();
      const parsed = qrGenerateSchema.safeParse(body);
      if (parsed.success) {
        markAsLate = parsed.data.markAsLate;
      }
    } catch {
      // Empty body is fine
    }

    const challenge = generateQrSessionChallenge(sessionId);

    // Save active token in in-memory DB keyed by token and pin
    const tokenRecord = {
      sessionId,
      tokenHash: challenge.tokenHash,
      displayPin: challenge.displayPin,
      expiresAt: challenge.expiresAt,
      isLate: markAsLate,
      consumedBy: new Set<string>(),
    };

    db.qrTokens.set(challenge.token, tokenRecord);
    db.qrTokens.set(challenge.displayPin.toUpperCase(), tokenRecord);

    logger.info("Dynamic QR challenge token generated", {
      eventCode: "QR_TOKEN_GENERATED",
      sessionId,
      displayPin: challenge.displayPin,
      expiresAt: challenge.expiresAt,
      isLate: markAsLate,
    });

    const qrPayload = JSON.stringify({
      sessionId,
      token: challenge.token,
      pin: challenge.displayPin,
      expiresAt: challenge.expiresAt,
    });

    return NextResponse.json({
      qrPayload,
      token: challenge.token,
      displayPin: challenge.displayPin,
      expiresAt: new Date(challenge.expiresAt).toISOString(),
      ttlSeconds: challenge.ttlSeconds,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error ? err.message : "Failed to generate QR token",
        },
      },
      { status: 500 }
    );
  }
}
