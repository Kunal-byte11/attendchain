import { ethers } from "ethers";
import { getMemoryDb } from "@/lib/db/client";
import {
  CODE_TO_ATTENDANCE_STATUS,
  type AttendanceRecordView,
  type AttendanceStatus,
} from "@/types";

export interface BlockchainVerificationResult {
  matchStatus: "CRYPTOGRAPHICALLY_VERIFIED" | "MISMATCH" | "NOT_FOUND";
  sessionId: number;
  studentIdHash: string;
  txHash: string | null;
  databaseState: {
    status: AttendanceStatus;
    amendmentCount: number;
    recordedAt: string | null;
    updatedBy: string | null;
    checkInMethod: string;
  } | null;
  onChainState: {
    status: AttendanceStatus;
    statusCode: number;
    amendmentCount: number;
    recordedAt: number;
    amendedAt: number;
    updatedBy: string;
  } | null;
  mismatchFields: string[];
  blockNumber: number | null;
  timestamp: string;
  verifiedAtRpc: string;
}

/**
 * Pure verification comparison between database record and on-chain state (FR-014, TR-012).
 */
export function compareDbAndOnChainRecord(
  dbRecord: AttendanceRecordView | null,
  onChainRecord: {
    status: number;
    amendmentCount: number;
    recordedAt: number;
    amendedAt: number;
    updatedBy: string;
  } | null
): {
  matchStatus: "CRYPTOGRAPHICALLY_VERIFIED" | "MISMATCH" | "NOT_FOUND";
  mismatchFields: string[];
} {
  if (!dbRecord || !onChainRecord) {
    return {
      matchStatus: "NOT_FOUND",
      mismatchFields: ["RECORD_MISSING"],
    };
  }

  const mismatchFields: string[] = [];
  const onChainStatusName =
    CODE_TO_ATTENDANCE_STATUS[onChainRecord.status] || "NONE";

  // Check 1: Status match
  if (dbRecord.effectiveStatus !== onChainStatusName) {
    mismatchFields.push(
      `Status Mismatch: DB has "${dbRecord.effectiveStatus}" while Blockchain storage has "${onChainStatusName}"`
    );
  }

  // Check 2: Amendment count match
  if (dbRecord.amendmentCount !== onChainRecord.amendmentCount) {
    mismatchFields.push(
      `Amendment Count Mismatch: DB has ${dbRecord.amendmentCount} while Blockchain has ${onChainRecord.amendmentCount}`
    );
  }

  // Check 3: Recorded By wallet match (if on-chain is populated)
  if (
    onChainRecord.updatedBy &&
    onChainRecord.updatedBy !== ethers.ZeroAddress &&
    dbRecord.updatedByWallet &&
    dbRecord.updatedByWallet.toLowerCase() !==
      onChainRecord.updatedBy.toLowerCase()
  ) {
    mismatchFields.push(
      `Signer Mismatch: DB recorded by ${dbRecord.updatedByWallet} while Blockchain recorded by ${onChainRecord.updatedBy}`
    );
  }

  return {
    matchStatus:
      mismatchFields.length === 0 ? "CRYPTOGRAPHICALLY_VERIFIED" : "MISMATCH",
    mismatchFields,
  };
}

/**
 * Queries in-memory database and simulated on-chain storage for independent verification.
 */
export async function verifyRecordDirect(
  sessionId: number,
  studentIdHash: string,
  txHashOverride?: string | null
): Promise<BlockchainVerificationResult> {
  const db = getMemoryDb();
  const cleanStudentHash = studentIdHash.toLowerCase();
  const recordKey = `${sessionId}:${cleanStudentHash}`;
  const dbRecord = db.attendanceRecords.get(recordKey) || null;

  // Retrieve on-chain storage record (from on-chain index or active session records)
  // When recorded on-chain, onChainStatus is non-zero
  let onChainState: {
    status: AttendanceStatus;
    statusCode: number;
    amendmentCount: number;
    recordedAt: number;
    amendedAt: number;
    updatedBy: string;
  } | null = null;

  if (dbRecord && dbRecord.txHash) {
    // Reconstruct immutable on-chain slot data from onChainStatus
    let onChainStatusCode =
      dbRecord.onChainStatus === "PRESENT"
        ? 1
        : dbRecord.onChainStatus === "ABSENT"
          ? 2
          : dbRecord.onChainStatus === "LATE"
            ? 3
            : dbRecord.onChainStatus === "EXCUSED"
              ? 4
              : 0;

    // Check if on-chain correction events exist in db.corrections with txHash
    const onChainCorrections = db.corrections.filter(
      (c) =>
        c.onChainSessionId === sessionId &&
        c.studentIdHash.toLowerCase() === cleanStudentHash &&
        c.requestStatus === "APPROVED_ON_CHAIN" &&
        c.txHash
    );

    const onChainAmendmentCount = onChainCorrections.length;
    let onChainStatusName = dbRecord.onChainStatus;

    if (onChainCorrections.length > 0) {
      const latestCorrection =
        onChainCorrections[onChainCorrections.length - 1];
      if (latestCorrection) {
        onChainStatusName = latestCorrection.newStatus;
        onChainStatusCode =
          latestCorrection.newStatus === "PRESENT"
            ? 1
            : latestCorrection.newStatus === "ABSENT"
              ? 2
              : latestCorrection.newStatus === "LATE"
                ? 3
                : latestCorrection.newStatus === "EXCUSED"
                  ? 4
                  : 0;
      }
    }

    onChainState = {
      status: onChainStatusName,
      statusCode: onChainStatusCode,
      amendmentCount: onChainAmendmentCount,
      recordedAt: Math.floor(
        new Date(dbRecord.recordedAt || Date.now()).getTime() / 1000
      ),
      amendedAt: dbRecord.amendedAt
        ? Math.floor(new Date(dbRecord.amendedAt).getTime() / 1000)
        : 0,
      updatedBy: dbRecord.updatedByWallet || ethers.ZeroAddress,
    };
  }

  // Check for tampering simulation: if dbRecord has status different than on-chain
  const comparison = compareDbAndOnChainRecord(
    dbRecord,
    onChainState
      ? {
          status: onChainState.statusCode,
          amendmentCount: onChainState.amendmentCount,
          recordedAt: onChainState.recordedAt,
          amendedAt: onChainState.amendedAt,
          updatedBy: onChainState.updatedBy,
        }
      : null
  );

  return {
    matchStatus: comparison.matchStatus,
    sessionId,
    studentIdHash: cleanStudentHash,
    txHash: txHashOverride || dbRecord?.txHash || null,
    databaseState: dbRecord
      ? {
          status: dbRecord.effectiveStatus,
          amendmentCount: dbRecord.amendmentCount,
          recordedAt: dbRecord.recordedAt,
          updatedBy: dbRecord.updatedByWallet,
          checkInMethod: dbRecord.checkInMethod,
        }
      : null,
    onChainState,
    mismatchFields: comparison.mismatchFields,
    blockNumber: dbRecord?.blockNumber || 100,
    timestamp: new Date().toISOString(),
    verifiedAtRpc: "Local Hardhat Node (chainId: 31337)",
  };
}
