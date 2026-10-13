import { describe, it, expect, beforeEach } from "vitest";
import { ethers } from "ethers";
import {
  decodeContractError,
  getSavedPendingTransactions,
  savePendingTransaction,
  removeSavedTransaction,
  type ManagedTransaction,
  CONTRACT_ERROR_DESCRIPTIONS,
} from "@/lib/blockchain/tx-manager";

describe("Transaction Lifecycle & Error Decoding Suite (T-010, FR-021, FR-022, TR-001, TR-013)", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }

    // Mock window and sessionStorage for Node environment
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
      },
    };

    (globalThis as unknown as { window?: unknown }).window = {
      sessionStorage: mockStorage,
    };
    (globalThis as unknown as { sessionStorage?: unknown }).sessionStorage =
      mockStorage;
  });

  describe("decodeContractError", () => {
    it("decodes MetaMask user rejection (ACTION_REJECTED / 4001)", () => {
      const rejectionError = {
        code: "ACTION_REJECTED",
        message: "user rejected action",
      };
      const decoded = decodeContractError(rejectionError);
      expect(decoded.code).toBe("ACTION_REJECTED");
      expect(decoded.userMessage).toContain(
        "Signature request was cancelled in MetaMask"
      );
    });

    it("decodes INSUFFICIENT_FUNDS error", () => {
      const fundError = {
        code: "INSUFFICIENT_FUNDS",
        message: "insufficient funds for gas * price + value",
      };
      const decoded = decodeContractError(fundError);
      expect(decoded.code).toBe("INSUFFICIENT_FUNDS");
      expect(decoded.userMessage).toContain("does not have enough Sepolia ETH");
    });

    it("decodes custom Solidity revert error with arguments via contract Interface", () => {
      const iface = new ethers.Interface([
        "error AttendanceAlreadyRecorded(uint256 sessionId, bytes32 studentIdHash)",
        "error UnauthorizedCourseTeacher(bytes32 courseIdHash, address caller)",
      ]);

      const sessionId = 15n;
      const studentHash =
        "0x3e9b111111111111111111111111111111111111111111111111111111111111";
      const encodedError = iface.encodeErrorResult(
        "AttendanceAlreadyRecorded",
        [sessionId, studentHash]
      );

      const errObj = { data: encodedError };
      const decoded = decodeContractError(errObj, iface);

      expect(decoded.code).toBe("AttendanceAlreadyRecorded");
      expect(decoded.userMessage).toContain("Transaction Reverted:");
      expect(decoded.userMessage).toContain(
        "Attendance has already been recorded"
      );
      expect(decoded.userMessage).toContain("15");
    });

    it("falls back to human message when error matches known custom error text in message string", () => {
      const err = {
        message:
          "execution reverted: custom error SessionNotOpen(sessionId=4, status=2)",
      };
      const decoded = decodeContractError(err);
      expect(decoded.code).toBe("SessionNotOpen");
      expect(decoded.userMessage).toContain("The lecture session is not open");
    });

    it("handles unknown generic revert", () => {
      const err = { message: "Internal JSON-RPC execution error" };
      const decoded = decodeContractError(err);
      expect(decoded.code).toBe("TRANSACTION_REVERTED");
      expect(decoded.userMessage).toBe("Internal JSON-RPC execution error");
    });
  });

  describe("sessionStorage Persistence & Recovery (FR-022)", () => {
    const sampleTx: ManagedTransaction = {
      txHash:
        "0x8a3f91b2c4d5e6f70123456789abcdef0123456789abcdef0123456789abcdef",
      stage: "pending-confirm",
      functionName: "recordBatchAttendance",
      description: "Batch attendance for 30 students in CS701 (Session #15)",
      chainId: 11155111,
      submittedAt: Date.now(),
    };

    it("saves and retrieves pending transaction across reloads", () => {
      expect(getSavedPendingTransactions()).toHaveLength(0);

      savePendingTransaction(sampleTx);
      const retrieved = getSavedPendingTransactions();
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]?.txHash).toBe(sampleTx.txHash);
      expect(retrieved[0]?.stage).toBe("pending-confirm");
    });

    it("updates existing transaction stage on new save without duplicating", () => {
      savePendingTransaction(sampleTx);

      const confirmedTx: ManagedTransaction = {
        ...sampleTx,
        stage: "confirmed",
        confirmedAt: Date.now(),
        blockNumber: 7482910,
      };
      savePendingTransaction(confirmedTx);

      const list = getSavedPendingTransactions();
      expect(list).toHaveLength(1);
      expect(list[0]?.stage).toBe("confirmed");
      expect(list[0]?.blockNumber).toBe(7482910);
    });

    it("removes transaction upon dismissal", () => {
      savePendingTransaction(sampleTx);
      expect(getSavedPendingTransactions()).toHaveLength(1);

      removeSavedTransaction(sampleTx.txHash);
      expect(getSavedPendingTransactions()).toHaveLength(0);
    });
  });
});
