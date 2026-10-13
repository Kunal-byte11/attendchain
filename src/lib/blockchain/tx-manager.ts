import { ethers } from "ethers";

export type TxStage =
  "awaiting-signature" | "pending-confirm" | "confirmed" | "reverted";

export interface ManagedTransaction {
  txHash: string;
  stage: TxStage;
  functionName: string;
  description: string;
  chainId: number;
  submittedAt: number;
  confirmedAt?: number;
  error?: string;
  blockNumber?: number;
}

export const STORAGE_KEY_PENDING_TX = "attendchain_pending_txs";

/**
 * Human-readable mapping of custom Solidity error selectors in AttendChainRegistry.sol
 */
export const CONTRACT_ERROR_DESCRIPTIONS: Record<string, string> = {
  InvalidAddress: "The provided Ethereum address is zero or invalid.",
  InvalidTeacherRole: "The designated account does not hold the TEACHER_ROLE.",
  CourseAlreadyExists: "A course with this course code already exists.",
  CourseNotFound: "Course identifier was not found in the registry.",
  UnauthorizedCourseTeacher:
    "Only the assigned teacher or an administrator can perform this action.",
  ArrayLengthMismatch:
    "The student commitment array length does not match the status array length.",
  BatchSizeExceeded:
    "The maximum allowed batch size (100 students) was exceeded.",
  StudentNotEnrolled: "The student commitment is not enrolled in this course.",
  SessionNotOpen: "The lecture session is not open for attendance recording.",
  SessionNotClosed:
    "Attendance corrections can only be made on closed lecture sessions.",
  InvalidTimeWindow: "The session start and end times are invalid.",
  InvalidAttendanceStatus: "The requested attendance status code is invalid.",
  AttendanceAlreadyRecorded:
    "Attendance has already been recorded for this student in this session.",
  AttendanceNotYetRecorded:
    "No attendance record exists yet for this student in this session.",
  IdenticalAttendanceStatus:
    "The requested new status is identical to the current recorded status.",
  EmptyCorrectionReason:
    "A valid, non-empty correction reason text is required.",
  ExpiredQrTicket: "The dynamic QR check-in ticket has expired.",
  InvalidQrTicketSignature:
    "The QR check-in ticket signature is invalid or forged.",
  AccessControlUnauthorizedAccount:
    "Your wallet lacks the required smart contract role to perform this action.",
};

/**
 * Decodes custom contract errors, RPC errors, or user rejections into human-readable messages.
 */
export function decodeContractError(
  error: unknown,
  contractInterface?: ethers.Interface
): { code: string; userMessage: string; technicalDetail?: string } {
  if (!error) {
    return {
      code: "UNKNOWN_ERROR",
      userMessage: "An unknown error occurred during transaction execution.",
    };
  }

  const errRecord = error as Record<string, unknown>;

  // 1. User rejection in wallet (ACTION_REJECTED / code 4001)
  if (
    errRecord.code === "ACTION_REJECTED" ||
    errRecord.code === 4001 ||
    (typeof errRecord.message === "string" &&
      errRecord.message.toLowerCase().includes("user rejected"))
  ) {
    return {
      code: "ACTION_REJECTED",
      userMessage:
        "Signature request was cancelled in MetaMask. No transaction was sent and your form selections are preserved.",
    };
  }

  // 2. Insufficient funds for gas
  if (
    errRecord.code === "INSUFFICIENT_FUNDS" ||
    (typeof errRecord.message === "string" &&
      errRecord.message.toLowerCase().includes("insufficient funds"))
  ) {
    return {
      code: "INSUFFICIENT_FUNDS",
      userMessage:
        "Your wallet does not have enough Sepolia ETH to pay gas for this transaction.",
    };
  }

  // 3. Attempt decoding through contract ABI custom error selectors
  const data =
    (errRecord.data as string) ||
    ((errRecord.error as Record<string, unknown>)?.data as string) ||
    errRecord.revertData;

  if (typeof data === "string" && data.startsWith("0x") && data.length >= 10) {
    if (contractInterface) {
      try {
        const parsed = contractInterface.parseError(data);
        if (parsed) {
          const errorName = parsed.name;
          const customDesc = CONTRACT_ERROR_DESCRIPTIONS[errorName];
          let formattedArgs = "";
          if (parsed.args && parsed.args.length > 0) {
            formattedArgs = ` (${parsed.args.map((a) => String(a)).join(", ")})`;
          }

          return {
            code: errorName,
            userMessage: `Transaction Reverted: ${customDesc || errorName}${formattedArgs}.`,
            technicalDetail: data,
          };
        }
      } catch {
        // Fall through to regex or raw message matching
      }
    }
  }

  // 4. Direct check for known error names in message text
  if (typeof errRecord.message === "string") {
    for (const [errName, desc] of Object.entries(CONTRACT_ERROR_DESCRIPTIONS)) {
      if (errRecord.message.includes(errName)) {
        return {
          code: errName,
          userMessage: `Transaction Reverted: ${desc} (${errName})`,
          technicalDetail: errRecord.message,
        };
      }
    }
  }

  // 5. Default fallback message
  const msg =
    typeof errRecord.message === "string"
      ? errRecord.message
      : "Transaction execution reverted by the EVM.";

  return {
    code: "TRANSACTION_REVERTED",
    userMessage: msg,
    technicalDetail: JSON.stringify(errRecord),
  };
}

/**
 * Storage helpers for persisting pending transactions across page reloads (FR-022)
 */
export function getSavedPendingTransactions(): ManagedTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_PENDING_TX);
    if (!raw) return [];
    return JSON.parse(raw) as ManagedTransaction[];
  } catch {
    return [];
  }
}

export function savePendingTransaction(tx: ManagedTransaction): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getSavedPendingTransactions().filter(
      (t) => t.txHash !== tx.txHash
    );
    existing.push(tx);
    sessionStorage.setItem(STORAGE_KEY_PENDING_TX, JSON.stringify(existing));
  } catch {
    // Ignore sessionStorage quota errors
  }
}

export function removeSavedTransaction(txHash: string): void {
  if (typeof window === "undefined") return;
  try {
    const remaining = getSavedPendingTransactions().filter(
      (t) => t.txHash !== txHash
    );
    sessionStorage.setItem(STORAGE_KEY_PENDING_TX, JSON.stringify(remaining));
  } catch {
    // Ignore sessionStorage errors
  }
}
