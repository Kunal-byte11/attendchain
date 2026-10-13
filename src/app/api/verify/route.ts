import { NextRequest, NextResponse } from "next/server";
import { getMemoryDb } from "@/lib/db/client";
import { verifyRecordDirect } from "@/lib/blockchain/verify";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const txParam = url.searchParams.get("tx");
    const sessionParam = url.searchParams.get("sessionId");
    const studentHashParam = url.searchParams.get("studentIdHash");

    const db = getMemoryDb();

    let targetSessionId: number | null = sessionParam
      ? Number(sessionParam)
      : null;
    let targetStudentHash: string | null = studentHashParam
      ? studentHashParam.toLowerCase()
      : null;

    // If txHash is provided, look up the record by transaction hash
    if (txParam) {
      const cleanTx = txParam.trim().toLowerCase();
      const matchedRecord = Array.from(db.attendanceRecords.values()).find(
        (r) => r.txHash?.toLowerCase() === cleanTx
      );

      if (matchedRecord) {
        targetSessionId = matchedRecord.onChainSessionId;
        targetStudentHash = matchedRecord.studentIdHash.toLowerCase();
      } else {
        // Also check corrections log
        const matchedCorrection = db.corrections.find(
          (c) => c.txHash?.toLowerCase() === cleanTx
        );
        if (matchedCorrection) {
          targetSessionId = matchedCorrection.onChainSessionId;
          targetStudentHash = matchedCorrection.studentIdHash.toLowerCase();
        }
      }
    }

    if (!targetSessionId || !targetStudentHash) {
      return NextResponse.json(
        {
          error: {
            code: "MISSING_PARAMETERS",
            message:
              "Please provide either a valid transaction hash (?tx=0x...) or both (?sessionId=15&studentIdHash=0x...).",
          },
        },
        { status: 400 }
      );
    }

    const verification = await verifyRecordDirect(
      targetSessionId,
      targetStudentHash,
      txParam
    );

    logger.info("Independent verification executed", {
      eventCode: "VERIFICATION_QUERY",
      sessionId: targetSessionId,
      studentIdHash: targetStudentHash,
      matchStatus: verification.matchStatus,
    });

    return NextResponse.json(verification);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error ? err.message : "Verification query failed",
        },
      },
      { status: 500 }
    );
  }
}
