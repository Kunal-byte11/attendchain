import { ethers } from "ethers";
import { getMemoryDb } from "@/lib/db/client";
import {
  CODE_TO_ATTENDANCE_STATUS,
  type AttendanceStatus,
  type AttendanceRecordView,
  type LectureSession,
} from "@/types";
import { logger } from "@/lib/logger";

export interface SyncOptions {
  chainId?: number;
  txHash?: string;
  fromBlock?: number;
  toBlock?: number;
}

export interface SyncResult {
  chainId: number;
  processedEvents: number;
  latestSyncedBlock: number;
  txHashIndexed?: string;
  syncedRecordsCount: number;
}

/**
 * Event signatures for AttendChainRegistry
 */
export const EVENT_TOPICS = {
  SessionOpened:
    "SessionOpened(uint256 indexed sessionId, bytes32 indexed courseIdHash, address indexed teacher, uint40 startTime, uint40 endTime, bytes32 metadataHash)",
  SessionClosed:
    "SessionClosed(uint256 indexed sessionId, address indexed closedBy, uint40 timestamp)",
  SessionCancelled:
    "SessionCancelled(uint256 indexed sessionId, address indexed cancelledBy, bytes32 reasonHash, uint40 timestamp)",
  AttendanceRecorded:
    "AttendanceRecorded(uint256 indexed sessionId, bytes32 indexed studentIdHash, uint8 status, address indexed recordedBy, uint40 timestamp)",
  AttendanceBatchCommitted:
    "AttendanceBatchCommitted(uint256 indexed sessionId, uint256 studentCount, address indexed committedBy, bool sessionClosed, uint40 timestamp)",
  AttendanceCorrected:
    "AttendanceCorrected(uint256 indexed sessionId, bytes32 indexed studentIdHash, uint8 previousStatus, uint8 newStatus, bytes32 reasonHash, address indexed correctedBy, uint8 amendmentCount, uint40 timestamp)",
};

export const REGISTRY_EVENT_INTERFACE = new ethers.Interface([
  `event ${EVENT_TOPICS.SessionOpened}`,
  `event ${EVENT_TOPICS.SessionClosed}`,
  `event ${EVENT_TOPICS.SessionCancelled}`,
  `event ${EVENT_TOPICS.AttendanceRecorded}`,
  `event ${EVENT_TOPICS.AttendanceBatchCommitted}`,
  `event ${EVENT_TOPICS.AttendanceCorrected}`,
]);

/**
 * Synchronizes confirmed blockchain events and transaction receipts idempotently (TR-011, NFR-007).
 * Deduplicates events using (chainId, txHash, logIndex).
 */
export async function syncBlockchainEvents(
  provider: ethers.Provider,
  contractAddress: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const db = getMemoryDb();
  const network = await provider.getNetwork();
  const chainId = options.chainId ?? Number(network.chainId);

  let processedCount = 0;
  let syncedRecordsCount = 0;
  let latestBlock = 0;

  // 1. Targeted Transaction Receipt Sync (if txHash is provided)
  if (options.txHash) {
    const receipt = await provider.getTransactionReceipt(options.txHash);
    if (!receipt) {
      throw new Error(`Transaction receipt for ${options.txHash} not found.`);
    }

    latestBlock = receipt.blockNumber;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== contractAddress.toLowerCase()) {
        continue;
      }

      const dedupeKey = `${chainId}:${log.transactionHash.toLowerCase()}:${log.index}`;
      if (db.indexedEvents.has(dedupeKey)) {
        continue; // Strictly idempotent (NFR-007)
      }

      const didProcess = processLog(log, chainId, db);
      if (didProcess) {
        db.indexedEvents.add(dedupeKey);
        processedCount++;
        syncedRecordsCount++;
      }
    }

    return {
      chainId,
      processedEvents: processedCount,
      latestSyncedBlock: latestBlock,
      txHashIndexed: options.txHash,
      syncedRecordsCount,
    };
  }

  // 2. Block Range Filter Sync
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = options.fromBlock ?? Math.max(0, currentBlock - 100);
  const toBlock = options.toBlock ?? currentBlock;
  latestBlock = toBlock;

  const logs = await provider.getLogs({
    address: contractAddress,
    fromBlock,
    toBlock,
  });

  for (const log of logs) {
    const dedupeKey = `${chainId}:${log.transactionHash.toLowerCase()}:${log.index}`;
    if (db.indexedEvents.has(dedupeKey)) {
      continue;
    }

    const didProcess = processLog(log, chainId, db);
    if (didProcess) {
      db.indexedEvents.add(dedupeKey);
      processedCount++;
      syncedRecordsCount++;
    }
  }

  return {
    chainId,
    processedEvents: processedCount,
    latestSyncedBlock: latestBlock,
    syncedRecordsCount,
  };
}

function processLog(
  log: ethers.Log,
  chainId: number,
  db: ReturnType<typeof getMemoryDb>
): boolean {
  try {
    const parsed = REGISTRY_EVENT_INTERFACE.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });
    if (!parsed) return false;

    const eventName = parsed.name;

    if (eventName === "SessionOpened") {
      const sessionId = Number(parsed.args.sessionId);
      const courseIdHash = String(parsed.args.courseIdHash);
      const teacher = ethers.getAddress(String(parsed.args.teacher));
      const startTime = Number(parsed.args.startTime);
      const endTime = Number(parsed.args.endTime);
      const metadataHash = String(parsed.args.metadataHash);

      const existing = db.sessions.get(sessionId);
      const course = db.courses.get(courseIdHash);

      const session: LectureSession = {
        id: existing?.id ?? `ses-${sessionId}`,
        onChainSessionId: sessionId,
        courseId: course?.id ?? `crs-${courseIdHash.slice(0, 8)}`,
        courseCode: course?.courseCode ?? "CS701",
        courseIdHash,
        teacherWallet: teacher,
        topic: existing?.topic ?? "Distributed Systems Lecture",
        metadataHash,
        startTime: new Date(startTime * 1000).toISOString(),
        endTime: new Date(endTime * 1000).toISOString(),
        status: "OPEN",
        qrEnabled: existing?.qrEnabled ?? true,
        lateCutoffMinutes: existing?.lateCutoffMinutes ?? 15,
        openTxHash: log.transactionHash,
        closeTxHash: null,
        createdAt: new Date().toISOString(),
      };
      db.sessions.set(sessionId, session);
      return true;
    }

    if (eventName === "SessionClosed") {
      const sessionId = Number(parsed.args.sessionId);
      const session = db.sessions.get(sessionId);
      if (session) {
        session.status = "CLOSED";
        session.closeTxHash = log.transactionHash;
      }
      return true;
    }

    if (eventName === "SessionCancelled") {
      const sessionId = Number(parsed.args.sessionId);
      const session = db.sessions.get(sessionId);
      if (session) {
        session.status = "CANCELLED";
        session.closeTxHash = log.transactionHash;
      }
      return true;
    }

    if (eventName === "AttendanceRecorded") {
      const sessionId = Number(parsed.args.sessionId);
      const studentIdHash = String(parsed.args.studentIdHash).toLowerCase();
      const statusCode = Number(parsed.args.status);
      const recordedBy = ethers.getAddress(String(parsed.args.recordedBy));
      const timestamp = Number(parsed.args.timestamp);

      const status =
        CODE_TO_ATTENDANCE_STATUS[statusCode] ??
        ("PRESENT" as AttendanceStatus);

      const session = db.sessions.get(sessionId);
      const student = db.students.get(studentIdHash);
      const key = `${sessionId}:${studentIdHash}`;

      const existingRecord = db.attendanceRecords.get(key);

      const record: AttendanceRecordView = {
        id:
          existingRecord?.id ?? `att-${sessionId}-${studentIdHash.slice(0, 8)}`,
        sessionId: session?.id ?? `ses-${sessionId}`,
        onChainSessionId: sessionId,
        courseCode: session?.courseCode ?? "CS701",
        courseIdHash: session?.courseIdHash ?? "",
        sessionTopic: session?.topic ?? "Lecture Session",
        sessionStartTime: session?.startTime ?? new Date().toISOString(),
        sessionStatus: session?.status ?? "OPEN",
        studentId: student?.id ?? `std-${studentIdHash.slice(0, 8)}`,
        syntheticRollNo: student?.syntheticRollNo ?? "SYN-2026-000",
        syntheticName: student?.syntheticName ?? "Anonymous Student",
        studentIdHash,
        draftStatus: status,
        onChainStatus: status,
        effectiveStatus: status,
        checkInMethod: existingRecord?.checkInMethod ?? "TEACHER_MANUAL",
        amendmentCount: existingRecord?.amendmentCount ?? 0,
        updatedByWallet: recordedBy,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        recordedAt: new Date(timestamp * 1000).toISOString(),
        amendedAt: existingRecord?.amendedAt ?? null,
      };

      db.attendanceRecords.set(key, record);
      return true;
    }

    if (eventName === "AttendanceCorrected") {
      const sessionId = Number(parsed.args.sessionId);
      const studentIdHash = String(parsed.args.studentIdHash).toLowerCase();
      const prevCode = Number(parsed.args.previousStatus);
      const newCode = Number(parsed.args.newStatus);
      const reasonHash = String(parsed.args.reasonHash);
      const correctedBy = ethers.getAddress(String(parsed.args.correctedBy));
      const amendmentCount = Number(parsed.args.amendmentCount);
      const timestamp = Number(parsed.args.timestamp);

      const previousStatus =
        CODE_TO_ATTENDANCE_STATUS[prevCode] ?? ("ABSENT" as AttendanceStatus);
      const newStatus =
        CODE_TO_ATTENDANCE_STATUS[newCode] ?? ("EXCUSED" as AttendanceStatus);

      const key = `${sessionId}:${studentIdHash}`;
      const existingRecord = db.attendanceRecords.get(key);
      const session = db.sessions.get(sessionId);
      const student = db.students.get(studentIdHash);

      if (existingRecord) {
        existingRecord.onChainStatus = newStatus;
        existingRecord.effectiveStatus = newStatus;
        existingRecord.amendmentCount = amendmentCount;
        existingRecord.amendedAt = new Date(timestamp * 1000).toISOString();
        existingRecord.updatedByWallet = correctedBy;
        existingRecord.txHash = log.transactionHash;
        existingRecord.blockNumber = log.blockNumber;
      }

      db.corrections.push({
        id: `corr-${log.transactionHash.slice(0, 10)}-${log.index}`,
        attendanceRecordId:
          existingRecord?.id ?? `att-${sessionId}-${studentIdHash.slice(0, 8)}`,
        onChainSessionId: sessionId,
        courseCode: session?.courseCode ?? "CS701",
        syntheticRollNo: student?.syntheticRollNo ?? "SYN-2026-000",
        studentIdHash,
        requestedByWallet: correctedBy,
        requestStatus: "APPROVED_ON_CHAIN",
        previousStatus,
        newStatus,
        reasonText: `On-chain verified amendment (${reasonHash.slice(0, 10)}...)`,
        reasonHash,
        approvedByWallet: correctedBy,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        createdAt: new Date(timestamp * 1000).toISOString(),
      });

      return true;
    }

    return false;
  } catch (err: unknown) {
    logger.warn("Failed to parse log in sync processor", {
      eventCode: "SYNC_LOG_PARSE_SKIPPED",
      error: err instanceof Error ? err.message : String(err),
      logIndex: log.index,
    });
    return false;
  }
}
