import { describe, it, expect, beforeEach, vi } from "vitest";
import hre from "hardhat";
import { resetMemoryDb, getMemoryDb } from "@/lib/db/client";
import { syncBlockchainEvents } from "@/lib/blockchain/sync";
import { POST as syncHandler } from "@/app/api/sync/route";
import * as providerModule from "@/lib/blockchain/provider";

const { ethers } = hre;

describe("Blockchain Event Sync & Idempotent Indexing Suite (T-011, NFR-007, TR-011)", () => {
  const COURSE_CS701 = ethers.id("CS701");
  const TOPIC_HASH = ethers.id("Distributed Consensus & Raft");
  const SALT =
    "0x1111111111111111111111111111111111111111111111111111111111111111";

  // Synthetic student hash matching SYN-2026-042
  const STUDENT_1 = ethers.solidityPackedKeccak256(
    ["bytes32", "string"],
    [SALT, "SYN-2026-042"]
  );

  beforeEach(() => {
    resetMemoryDb();
    vi.restoreAllMocks();
  });

  async function deployAndSetupFixture() {
    const [admin, teacher] = await ethers.getSigners();
    if (!admin || !teacher) {
      throw new Error("Missing signers");
    }

    const Factory = await ethers.getContractFactory("AttendChainRegistry");
    const registry = await Factory.deploy(admin.address, admin.address);
    await registry.waitForDeployment();

    // 1. Grant teacher role
    await registry.connect(admin).grantTeacherRole(teacher.address);

    // 2. Create Course (courseIdHash, teacherAddress)
    await registry.connect(admin).createCourse(COURSE_CS701, teacher.address);

    // 3. Enroll Student
    await registry
      .connect(admin)
      .enrollStudentsBatch(COURSE_CS701, [STUDENT_1]);

    const registryAddress = await registry.getAddress();

    return {
      registry,
      registryAddress,
      admin,
      teacher,
    };
  }

  it("idempotently indexes SessionOpened, AttendanceRecorded, and AttendanceCorrected via syncBlockchainEvents", async () => {
    const { registry, registryAddress, teacher } =
      await deployAndSetupFixture();
    const provider = ethers.provider;
    const db = getMemoryDb();

    // 1. Teacher opens a session: openSession(courseIdHash, metadataHash, startTime, endTime)
    const now = Math.floor(Date.now() / 1000);
    const openTx = await registry
      .connect(teacher)
      .openSession(COURSE_CS701, TOPIC_HASH, now, now + 3600);
    const openReceipt = await openTx.wait();
    expect(openReceipt).toBeDefined();

    // 2. Record Attendance for student 1: recordBatchAttendance(sessionId, students, statuses, closeSession)
    // status 1 = PRESENT, closeSession = false
    const recordTx = await registry
      .connect(teacher)
      .recordBatchAttendance(1, [STUDENT_1], [1], false);
    const recordReceipt = await recordTx.wait();
    expect(recordReceipt).toBeDefined();

    // 3. First Sync via txHash: verify session and record exist in memory DB
    const res1 = await syncBlockchainEvents(provider, registryAddress, {
      txHash: recordReceipt?.hash,
    });
    expect(res1.processedEvents).toBe(1);
    expect(res1.syncedRecordsCount).toBe(1);

    const recordKey = `1:${STUDENT_1.toLowerCase()}`;
    const initialRecord = db.attendanceRecords.get(recordKey);
    expect(initialRecord).toBeDefined();
    expect(initialRecord?.effectiveStatus).toBe("PRESENT");

    // 4. Repeated Sync with same txHash (Idempotency test 1)
    const res2 = await syncBlockchainEvents(provider, registryAddress, {
      txHash: recordReceipt?.hash,
    });
    expect(res2.processedEvents).toBe(0);
    expect(res2.syncedRecordsCount).toBe(0);

    // 5. Repeated Sync 3rd time (NFR-007: 3 consecutive runs)
    const res3 = await syncBlockchainEvents(provider, registryAddress, {
      txHash: recordReceipt?.hash,
    });
    expect(res3.processedEvents).toBe(0);
    expect(res3.syncedRecordsCount).toBe(0);

    // Verify exactly 1 attendance record exists in DB (0 duplicate rows)
    expect(db.attendanceRecords.size).toBe(1);

    // 6. Close the session so it can be corrected
    await (await registry.connect(teacher).closeSession(1)).wait();

    // 7. Correct attendance: correctAttendance(sessionId, studentIdHash, newStatus, reasonHash)
    // 4 = EXCUSED in contract (1: PRESENT, 2: ABSENT, 3: LATE, 4: EXCUSED)
    const reasonHash = ethers.id("Medical slip approved by HOD");
    const correctTx = await registry
      .connect(teacher)
      .correctAttendance(1, STUDENT_1, 4, reasonHash);
    const correctReceipt = await correctTx.wait();
    expect(correctReceipt).toBeDefined();

    const initialCorrectionsCount = db.corrections.length;

    // 8. Sync correction transaction
    const correctRes = await syncBlockchainEvents(provider, registryAddress, {
      txHash: correctReceipt?.hash,
    });
    expect(correctRes.processedEvents).toBe(1);

    const updatedRecord = db.attendanceRecords.get(recordKey);
    expect(updatedRecord?.effectiveStatus).toBe("EXCUSED");
    expect(updatedRecord?.amendmentCount).toBe(1);
    expect(db.corrections.length).toBe(initialCorrectionsCount + 1);
    const latestCorrection = db.corrections[db.corrections.length - 1];
    expect(latestCorrection?.newStatus).toBe("EXCUSED");

    // 9. Re-sync correction transaction: must be 0 processed
    const repeatCorrectionRes = await syncBlockchainEvents(
      provider,
      registryAddress,
      {
        txHash: correctReceipt?.hash,
      }
    );
    expect(repeatCorrectionRes.processedEvents).toBe(0);
    expect(db.attendanceRecords.size).toBe(1);
    expect(db.corrections.length).toBe(initialCorrectionsCount + 1);
  });

  it("synchronizes events across a block range and strictly avoids duplicate database records", async () => {
    const { registry, registryAddress, teacher } =
      await deployAndSetupFixture();
    const provider = ethers.provider;
    const db = getMemoryDb();

    const startBlock = await provider.getBlockNumber();

    const now = Math.floor(Date.now() / 1000);
    await (
      await registry
        .connect(teacher)
        .openSession(COURSE_CS701, TOPIC_HASH, now, now + 3600)
    ).wait();

    await (
      await registry
        .connect(teacher)
        .recordBatchAttendance(1, [STUDENT_1], [1], true)
    ) // true = sessionClosed
      .wait();

    const endBlock = await provider.getBlockNumber();

    // Run 1: Range sync
    const sync1 = await syncBlockchainEvents(provider, registryAddress, {
      fromBlock: startBlock,
      toBlock: endBlock,
    });
    expect(sync1.processedEvents).toBeGreaterThanOrEqual(2);

    const initialAttendanceCount = db.attendanceRecords.size;
    expect(initialAttendanceCount).toBe(1);
    const session = db.sessions.get(1);
    expect(session?.status).toBe("CLOSED");

    // Run 2: Consecutive duplicate range sync
    const sync2 = await syncBlockchainEvents(provider, registryAddress, {
      fromBlock: startBlock,
      toBlock: endBlock,
    });
    expect(sync2.processedEvents).toBe(0);
    expect(db.attendanceRecords.size).toBe(initialAttendanceCount);

    // Run 3: Consecutive duplicate range sync
    const sync3 = await syncBlockchainEvents(provider, registryAddress, {
      fromBlock: startBlock,
      toBlock: endBlock,
    });
    expect(sync3.processedEvents).toBe(0);
    expect(db.attendanceRecords.size).toBe(initialAttendanceCount);
  });

  it("POST /api/sync endpoint handles request validation and invokes sync service", async () => {
    const { registryAddress } = await deployAndSetupFixture();

    // Mock getReadProvider to return Hardhat ethers.provider
    vi.spyOn(providerModule, "getReadProvider").mockReturnValue(
      ethers.provider as unknown as ReturnType<
        typeof providerModule.getReadProvider
      >
    );

    // Valid POST request for current block range
    const req = new Request("http://localhost:3000/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainId: 31337,
        fromBlock: 0,
        toBlock: 10,
      }),
    });

    const res = await syncHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.chainId).toBe(31337);

    // Invalid parameters return 400
    const badReq = new Request("http://localhost:3000/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainId: -5,
        txHash: "0x123", // invalid length
      }),
    });
    const badRes = await syncHandler(badReq);
    expect(badRes.status).toBe(400);
    const badData = await badRes.json();
    expect(badData.error.code).toBe("INVALID_REQUEST");
  });
});
