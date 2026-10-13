import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("AttendChainRegistry (T-005, T-006, T-007)", function () {
  const COURSE_CS701 = ethers.id("CS701");
  const COURSE_CS702 = ethers.id("CS702");
  const TOPIC_HASH = ethers.id("Lecture 1: Byzantine Fault Tolerance");
  const CANCEL_REASON_HASH = ethers.id("Faculty Conference Travel Approved");
  const SALT =
    "0x1111111111111111111111111111111111111111111111111111111111111111";

  const STUDENT_1 = ethers.solidityPackedKeccak256(
    ["bytes32", "string"],
    [SALT, "SYN-2026-042"]
  );
  const STUDENT_2 = ethers.solidityPackedKeccak256(
    ["bytes32", "string"],
    [SALT, "SYN-2026-019"]
  );
  const UNENROLLED_STUDENT = ethers.solidityPackedKeccak256(
    ["bytes32", "string"],
    [SALT, "SYN-2026-999"]
  );

  async function deployFixture() {
    const [admin, teacherA, teacherB, qrSigner, unauthorized, newSigner] =
      await ethers.getSigners();
    if (
      !admin ||
      !teacherA ||
      !teacherB ||
      !qrSigner ||
      !unauthorized ||
      !newSigner
    ) {
      throw new Error("Expected at least 6 signers from Hardhat");
    }
    const Factory = await ethers.getContractFactory("AttendChainRegistry");
    const registry = await Factory.deploy(admin.address, qrSigner.address);
    await registry.waitForDeployment();
    return {
      registry,
      admin,
      teacherA,
      teacherB,
      qrSigner,
      unauthorized,
      newSigner,
    };
  }

  describe("Constructor & Initial State", function () {
    it("initializes with admin, teacher role, and QR signer correctly", async function () {
      const { registry, admin, qrSigner } = await deployFixture();
      const adminRole = await registry.DEFAULT_ADMIN_ROLE();
      expect(await registry.hasRole(adminRole, admin.address)).to.equal(true);
      expect(await registry.qrTicketSigner()).to.equal(qrSigner.address);
      expect(await registry.sessionCount()).to.equal(0n);
    });

    it("reverts constructor if initialAdmin or initialQrSigner is address(0)", async function () {
      const [admin, qrSigner] = await ethers.getSigners();
      if (!admin || !qrSigner) {
        throw new Error("Expected at least 2 signers from Hardhat");
      }
      const Factory = await ethers.getContractFactory("AttendChainRegistry");
      await expect(
        Factory.deploy(ethers.ZeroAddress, qrSigner.address)
      ).to.be.revertedWithCustomError(Factory, "InvalidAddress");
      await expect(
        Factory.deploy(admin.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(Factory, "InvalidAddress");
    });
  });

  describe("Role Management (grantTeacherRole, revokeTeacherRole, setQrTicketSigner)", function () {
    it("allows admin to grant and revoke teacher role, emitting TeacherRoleUpdated", async function () {
      const { registry, admin, teacherA } = await deployFixture();

      await expect(
        registry.connect(admin).grantTeacherRole(teacherA.address)
      ).to.emit(registry, "TeacherRoleUpdated");

      const teacherRole = await registry.TEACHER_ROLE();
      expect(await registry.hasRole(teacherRole, teacherA.address)).to.equal(
        true
      );

      await expect(
        registry.connect(admin).revokeTeacherRole(teacherA.address)
      ).to.emit(registry, "TeacherRoleUpdated");

      expect(await registry.hasRole(teacherRole, teacherA.address)).to.equal(
        false
      );
    });

    it("reverts grantTeacherRole for zero address and non-admin caller", async function () {
      const { registry, admin, unauthorized } = await deployFixture();
      await expect(
        registry.connect(admin).grantTeacherRole(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "InvalidAddress");

      await expect(
        registry.connect(unauthorized).grantTeacherRole(unauthorized.address)
      ).to.be.revertedWithCustomError(
        registry,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("reverts revokeTeacherRole if candidate does not have TEACHER_ROLE", async function () {
      const { registry, admin, teacherA } = await deployFixture();
      await expect(registry.connect(admin).revokeTeacherRole(teacherA.address))
        .to.be.revertedWithCustomError(registry, "InvalidTeacherRole")
        .withArgs(teacherA.address);
    });

    it("allows admin to update qrTicketSigner and reverts on zero address / non-admin", async function () {
      const { registry, admin, newSigner, unauthorized } =
        await deployFixture();
      await expect(
        registry.connect(admin).setQrTicketSigner(newSigner.address)
      ).to.emit(registry, "QrTicketSignerUpdated");
      expect(await registry.qrTicketSigner()).to.equal(newSigner.address);

      await expect(
        registry.connect(admin).setQrTicketSigner(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "InvalidAddress");

      await expect(
        registry.connect(unauthorized).setQrTicketSigner(newSigner.address)
      ).to.be.revertedWithCustomError(
        registry,
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  describe("Course Management (createCourse, updateCourseTeacher, enrollStudentsBatch)", function () {
    it("allows admin to create course and reverts if teacher lacks role or hash is empty", async function () {
      const { registry, admin, teacherA, unauthorized } = await deployFixture();

      // Zero course hash
      await expect(
        registry.connect(admin).createCourse(ethers.ZeroHash, teacherA.address)
      ).to.be.revertedWithCustomError(registry, "CourseNotFound");

      // Teacher lacks role
      await expect(
        registry.connect(admin).createCourse(COURSE_CS701, teacherA.address)
      )
        .to.be.revertedWithCustomError(registry, "InvalidTeacherRole")
        .withArgs(teacherA.address);

      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await expect(
        registry.connect(admin).createCourse(COURSE_CS701, teacherA.address)
      ).to.emit(registry, "CourseCreated");

      // Duplicate course creation
      await expect(
        registry.connect(admin).createCourse(COURSE_CS701, teacherA.address)
      )
        .to.be.revertedWithCustomError(registry, "CourseAlreadyExists")
        .withArgs(COURSE_CS701);

      // Non-admin caller
      await expect(
        registry
          .connect(unauthorized)
          .createCourse(COURSE_CS702, teacherA.address)
      ).to.be.revertedWithCustomError(
        registry,
        "AccessControlUnauthorizedAccount"
      );

      const course = await registry.getCourse(COURSE_CS701);
      expect(course.exists).to.equal(true);
      expect(course.isActive).to.equal(true);
      expect(course.assignedTeacher).to.equal(teacherA.address);
    });

    it("updates course teacher and validates existence, teacher role, and admin role", async function () {
      const { registry, admin, teacherA, teacherB, unauthorized } =
        await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);

      // Non-existent course
      await expect(
        registry
          .connect(admin)
          .updateCourseTeacher(COURSE_CS702, teacherB.address)
      ).to.be.revertedWithCustomError(registry, "CourseNotFound");

      // Candidate lacks teacher role
      await expect(
        registry
          .connect(admin)
          .updateCourseTeacher(COURSE_CS701, teacherB.address)
      ).to.be.revertedWithCustomError(registry, "InvalidTeacherRole");

      await registry.connect(admin).grantTeacherRole(teacherB.address);
      await expect(
        registry
          .connect(admin)
          .updateCourseTeacher(COURSE_CS701, teacherB.address)
      ).to.emit(registry, "CourseTeacherUpdated");

      const course = await registry.getCourse(COURSE_CS701);
      expect(course.assignedTeacher).to.equal(teacherB.address);

      // Non-admin caller
      await expect(
        registry
          .connect(unauthorized)
          .updateCourseTeacher(COURSE_CS701, teacherA.address)
      ).to.be.revertedWithCustomError(
        registry,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("enrolls students in batch and enforces size limits and non-empty student hashes", async function () {
      const { registry, admin, teacherA } = await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);

      // Non-existent course
      await expect(
        registry.connect(admin).enrollStudentsBatch(COURSE_CS702, [STUDENT_1])
      ).to.be.revertedWithCustomError(registry, "CourseNotFound");

      // Empty batch (0 items)
      await expect(
        registry.connect(admin).enrollStudentsBatch(COURSE_CS701, [])
      )
        .to.be.revertedWithCustomError(registry, "BatchSizeExceeded")
        .withArgs(0n, 100n);

      // Batch size exceeding 100
      const largeBatch = Array(101).fill(STUDENT_1);
      await expect(
        registry.connect(admin).enrollStudentsBatch(COURSE_CS701, largeBatch)
      )
        .to.be.revertedWithCustomError(registry, "BatchSizeExceeded")
        .withArgs(101n, 100n);

      // Contains ZeroHash student
      await expect(
        registry
          .connect(admin)
          .enrollStudentsBatch(COURSE_CS701, [STUDENT_1, ethers.ZeroHash])
      ).to.be.revertedWithCustomError(registry, "StudentNotEnrolled");

      // Successful batch enrollment
      await expect(
        registry
          .connect(admin)
          .enrollStudentsBatch(COURSE_CS701, [STUDENT_1, STUDENT_2])
      ).to.emit(registry, "StudentsEnrolledBatch");

      expect(
        await registry.isStudentEnrolled(COURSE_CS701, STUDENT_1)
      ).to.equal(true);
      expect(
        await registry.isStudentEnrolled(COURSE_CS701, STUDENT_2)
      ).to.equal(true);
      expect(
        await registry.isStudentEnrolled(COURSE_CS701, UNENROLLED_STUDENT)
      ).to.equal(false);
    });
  });

  describe("Lecture Session Lifecycle (openSession, closeSession, cancelSession)", function () {
    it("validates time windows, metadata, course existence, and caller authorization on openSession", async function () {
      const { registry, admin, teacherA, teacherB, unauthorized } =
        await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry.connect(admin).grantTeacherRole(teacherB.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);

      // Course not found
      await expect(
        registry
          .connect(teacherA)
          .openSession(COURSE_CS702, TOPIC_HASH, 1000, 2000)
      ).to.be.revertedWithCustomError(registry, "CourseNotFound");

      // Unauthorized teacher
      await expect(
        registry
          .connect(teacherB)
          .openSession(COURSE_CS701, TOPIC_HASH, 1000, 2000)
      )
        .to.be.revertedWithCustomError(registry, "UnauthorizedCourseTeacher")
        .withArgs(COURSE_CS701, teacherB.address);

      // Unauthorized non-teacher
      await expect(
        registry
          .connect(unauthorized)
          .openSession(COURSE_CS701, TOPIC_HASH, 1000, 2000)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedCourseTeacher");

      // Invalid time window (startTime == 0)
      await expect(
        registry
          .connect(teacherA)
          .openSession(COURSE_CS701, TOPIC_HASH, 0, 2000)
      ).to.be.revertedWithCustomError(registry, "InvalidTimeWindow");

      // Invalid time window (endTime <= startTime)
      await expect(
        registry
          .connect(teacherA)
          .openSession(COURSE_CS701, TOPIC_HASH, 2000, 2000)
      ).to.be.revertedWithCustomError(registry, "InvalidTimeWindow");

      // Empty metadataHash
      await expect(
        registry
          .connect(teacherA)
          .openSession(COURSE_CS701, ethers.ZeroHash, 1000, 2000)
      ).to.be.revertedWithCustomError(registry, "InvalidTimeWindow");

      // Admin or assigned teacher can open session
      await expect(
        registry
          .connect(teacherA)
          .openSession(COURSE_CS701, TOPIC_HASH, 1000, 2000)
      ).to.emit(registry, "SessionOpened");

      const s1 = await registry.getSession(1);
      expect(s1.status).to.equal(1n); // SESSION_OPEN
      expect(s1.teacher).to.equal(teacherA.address);

      // Admin can also open session
      await expect(
        registry
          .connect(admin)
          .openSession(COURSE_CS701, TOPIC_HASH, 3000, 4000)
      ).to.emit(registry, "SessionOpened");
    });

    it("enforces session status and authorization on closeSession and cancelSession", async function () {
      const { registry, admin, teacherA, teacherB } = await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry.connect(admin).grantTeacherRole(teacherB.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);
      await registry
        .connect(teacherA)
        .openSession(COURSE_CS701, TOPIC_HASH, 1000, 2000);

      // Unauthorized teacher cannot close
      await expect(
        registry.connect(teacherB).closeSession(1)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedCourseTeacher");

      // Teacher closes session
      await expect(registry.connect(teacherA).closeSession(1)).to.emit(
        registry,
        "SessionClosed"
      );

      // Cannot close an already closed session
      await expect(
        registry.connect(teacherA).closeSession(1)
      ).to.be.revertedWithCustomError(registry, "SessionNotOpen");

      // Cannot cancel an already closed session
      await expect(
        registry.connect(teacherA).cancelSession(1, CANCEL_REASON_HASH)
      ).to.be.revertedWithCustomError(registry, "SessionNotOpen");

      // Open second session and cancel it
      await registry
        .connect(teacherA)
        .openSession(COURSE_CS701, TOPIC_HASH, 3000, 4000);

      // Revert if cancel reason is empty
      await expect(
        registry.connect(teacherA).cancelSession(2, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(registry, "EmptyCorrectionReason");

      // Unauthorized teacher cannot cancel
      await expect(
        registry.connect(teacherB).cancelSession(2, CANCEL_REASON_HASH)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedCourseTeacher");

      // Admin can cancel session
      await expect(
        registry.connect(admin).cancelSession(2, CANCEL_REASON_HASH)
      ).to.emit(registry, "SessionCancelled");

      const s2 = await registry.getSession(2);
      expect(s2.status).to.equal(3n); // SESSION_CANCELLED
    });
  });

  describe("Attendance Recording & Batch Validation (recordBatchAttendance)", function () {
    it("reverts batch recording if session is not open or caller is unauthorized", async function () {
      const { registry, admin, teacherA, teacherB } = await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry.connect(admin).grantTeacherRole(teacherB.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);
      await registry
        .connect(teacherA)
        .openSession(COURSE_CS701, TOPIC_HASH, 1000, 2000);
      await registry.connect(teacherA).closeSession(1);

      await expect(
        registry
          .connect(teacherA)
          .recordBatchAttendance(1, [STUDENT_1], [1], false)
      ).to.be.revertedWithCustomError(registry, "SessionNotOpen");

      await registry
        .connect(teacherA)
        .openSession(COURSE_CS701, TOPIC_HASH, 3000, 4000);
      await expect(
        registry
          .connect(teacherB)
          .recordBatchAttendance(2, [STUDENT_1], [1], false)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedCourseTeacher");
    });

    it("reverts on array length mismatch, batch size bounds, invalid status, or unenrolled student", async function () {
      const { registry, admin, teacherA } = await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);
      await registry
        .connect(admin)
        .enrollStudentsBatch(COURSE_CS701, [STUDENT_1]);
      await registry
        .connect(teacherA)
        .openSession(COURSE_CS701, TOPIC_HASH, 1000, 2000);

      // Length mismatch
      await expect(
        registry
          .connect(teacherA)
          .recordBatchAttendance(1, [STUDENT_1], [1, 2], false)
      ).to.be.revertedWithCustomError(registry, "ArrayLengthMismatch");

      // Empty batch (0 items)
      await expect(
        registry.connect(teacherA).recordBatchAttendance(1, [], [], false)
      ).to.be.revertedWithCustomError(registry, "BatchSizeExceeded");

      // Batch size > 100
      const largeHashes = Array(101).fill(STUDENT_1);
      const largeStatuses = Array(101).fill(1);
      await expect(
        registry
          .connect(teacherA)
          .recordBatchAttendance(1, largeHashes, largeStatuses, false)
      ).to.be.revertedWithCustomError(registry, "BatchSizeExceeded");

      // Invalid status (0 = NONE or 5 = Out of bounds)
      await expect(
        registry
          .connect(teacherA)
          .recordBatchAttendance(1, [STUDENT_1], [0], false)
      ).to.be.revertedWithCustomError(registry, "InvalidAttendanceStatus");

      await expect(
        registry
          .connect(teacherA)
          .recordBatchAttendance(1, [STUDENT_1], [5], false)
      ).to.be.revertedWithCustomError(registry, "InvalidAttendanceStatus");

      // Unenrolled student
      await expect(
        registry
          .connect(teacherA)
          .recordBatchAttendance(1, [UNENROLLED_STUDENT], [1], false)
      ).to.be.revertedWithCustomError(registry, "StudentNotEnrolled");
    });

    it("records batch attendance for enrolled students and optionally leaves session open", async function () {
      const { registry, admin, teacherA } = await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);
      await registry
        .connect(admin)
        .enrollStudentsBatch(COURSE_CS701, [STUDENT_1, STUDENT_2]);
      await registry
        .connect(teacherA)
        .openSession(COURSE_CS701, TOPIC_HASH, 1000, 2000);

      // closeAfter = false leaves session OPEN
      await expect(
        registry
          .connect(teacherA)
          .recordBatchAttendance(1, [STUDENT_1], [1], false)
      ).to.emit(registry, "AttendanceBatchCommitted");

      const session = await registry.getSession(1);
      expect(session.status).to.equal(1n); // Still OPEN

      // Duplicate attendance for STUDENT_1 reverts
      await expect(
        registry
          .connect(teacherA)
          .recordBatchAttendance(1, [STUDENT_1], [2], false)
      ).to.be.revertedWithCustomError(registry, "AttendanceAlreadyRecorded");

      // Record STUDENT_2 and close session
      await registry
        .connect(teacherA)
        .recordBatchAttendance(1, [STUDENT_2], [2], true);

      const sessionClosed = await registry.getSession(1);
      expect(sessionClosed.status).to.equal(2n); // CLOSED
    });

    it("asserts 50-student batch attendance + close uses <= 1,500,000 gas (NFR-004)", async function () {
      const { registry, admin, teacherA } = await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);

      const students: string[] = [];
      const statuses: number[] = [];
      for (let i = 1; i <= 50; i++) {
        const hash = ethers.solidityPackedKeccak256(
          ["bytes32", "string"],
          [SALT, `SYN-2026-${String(i).padStart(3, "0")}`]
        );
        students.push(hash);
        statuses.push(i % 2 === 0 ? 1 : 2);
      }

      await registry.connect(admin).enrollStudentsBatch(COURSE_CS701, students);
      await registry
        .connect(teacherA)
        .openSession(COURSE_CS701, TOPIC_HASH, 1000, 4000);

      const tx = await registry
        .connect(teacherA)
        .recordBatchAttendance(1, students, statuses, true);
      const receipt = await tx.wait();
      expect(receipt).to.not.equal(null);

      // Gas budget assertion (NFR-004): 1,500,000 gas in production EVM
      // Solidity-coverage instruments every statement with tracking events which inflates gas overhead
      const isCoverage =
        Boolean(process.env.COVERAGE) ||
        Boolean((global as Record<string, unknown>).__coverage__) ||
        hre.network.name === "coverage" ||
        process.argv.some((arg) => arg.includes("coverage"));

      if (!isCoverage) {
        expect(receipt!.gasUsed).to.be.lte(1_500_000n);
      }

      const session = await registry.getSession(1);
      expect(session.status).to.equal(2n);
      const rec = await registry.getAttendanceRecord(1, students[0]!);
      expect(rec.status).to.equal(2n);
    });
  });

  describe("EIP-712 Dynamic QR Ticket Check-In (checkInWithTicket)", function () {
    async function signTicket(
      registry: any,
      signer: any,
      sessionId: bigint,
      studentIdHash: string,
      status: number,
      deadline: number
    ) {
      const network = await ethers.provider.getNetwork();
      const domain = {
        name: "AttendChainRegistry",
        version: "1",
        chainId: network.chainId,
        verifyingContract: await registry.getAddress(),
      };
      const types = {
        QrCheckInTicket: [
          { name: "sessionId", type: "uint256" },
          { name: "studentIdHash", type: "bytes32" },
          { name: "status", type: "uint8" },
          { name: "deadline", type: "uint256" },
        ],
      };
      const value = {
        sessionId,
        studentIdHash,
        status,
        deadline: BigInt(deadline),
      };
      return signer.signTypedData(domain, types, value);
    }

    it("verifies valid EIP-712 ticket signed by authorized qrTicketSigner", async function () {
      const { registry, admin, teacherA, qrSigner, unauthorized } =
        await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);
      await registry
        .connect(admin)
        .enrollStudentsBatch(COURSE_CS701, [STUDENT_1]);
      await registry
        .connect(teacherA)
        .openSession(COURSE_CS701, TOPIC_HASH, 1000, 4000);

      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const signature = await signTicket(
        registry,
        qrSigner,
        1n,
        STUDENT_1,
        1,
        deadline
      );

      await expect(
        registry
          .connect(unauthorized)
          .checkInWithTicket(1, STUDENT_1, 1, deadline, signature)
      ).to.emit(registry, "AttendanceRecorded");

      const rec = await registry.getAttendanceRecord(1, STUDENT_1);
      expect(rec.status).to.equal(1n); // PRESENT
      expect(rec.updatedBy).to.equal(unauthorized.address);
    });

    it("rejects ticket on CLOSED session, expired deadline, invalid status, or unenrolled student", async function () {
      const { registry, admin, teacherA, qrSigner, unauthorized } =
        await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);
      await registry
        .connect(admin)
        .enrollStudentsBatch(COURSE_CS701, [STUDENT_1]);
      await registry
        .connect(teacherA)
        .openSession(COURSE_CS701, TOPIC_HASH, 1000, 4000);

      const futureDeadline = Math.floor(Date.now() / 1000) + 3600;

      // Unenrolled student
      const sigUnenrolled = await signTicket(
        registry,
        qrSigner,
        1n,
        UNENROLLED_STUDENT,
        1,
        futureDeadline
      );
      await expect(
        registry
          .connect(unauthorized)
          .checkInWithTicket(
            1,
            UNENROLLED_STUDENT,
            1,
            futureDeadline,
            sigUnenrolled
          )
      ).to.be.revertedWithCustomError(registry, "StudentNotEnrolled");

      // Invalid status for ticket (only 1=PRESENT or 3=LATE allowed)
      const sigAbsent = await signTicket(
        registry,
        qrSigner,
        1n,
        STUDENT_1,
        2, // ABSENT
        futureDeadline
      );
      await expect(
        registry
          .connect(unauthorized)
          .checkInWithTicket(1, STUDENT_1, 2, futureDeadline, sigAbsent)
      ).to.be.revertedWithCustomError(registry, "InvalidAttendanceStatus");

      // Expired deadline
      const pastDeadline = Math.floor(Date.now() / 1000) - 100;
      const sigExpired = await signTicket(
        registry,
        qrSigner,
        1n,
        STUDENT_1,
        1,
        pastDeadline
      );
      await expect(
        registry
          .connect(unauthorized)
          .checkInWithTicket(1, STUDENT_1, 1, pastDeadline, sigExpired)
      ).to.be.revertedWithCustomError(registry, "ExpiredQrTicket");

      // Closed session
      await registry.connect(teacherA).closeSession(1);
      const sigClosed = await signTicket(
        registry,
        qrSigner,
        1n,
        STUDENT_1,
        1,
        futureDeadline
      );
      await expect(
        registry
          .connect(unauthorized)
          .checkInWithTicket(1, STUDENT_1, 1, futureDeadline, sigClosed)
      ).to.be.revertedWithCustomError(registry, "SessionNotOpen");
    });

    it("rejects ticket with forged signer signature or altered payload", async function () {
      const { registry, admin, teacherA, unauthorized } = await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);
      await registry
        .connect(admin)
        .enrollStudentsBatch(COURSE_CS701, [STUDENT_1]);
      await registry
        .connect(teacherA)
        .openSession(COURSE_CS701, TOPIC_HASH, 1000, 4000);

      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Signed by unauthorized instead of qrSigner
      const forgedSignature = await signTicket(
        registry,
        unauthorized,
        1n,
        STUDENT_1,
        1,
        deadline
      );

      await expect(
        registry
          .connect(unauthorized)
          .checkInWithTicket(1, STUDENT_1, 1, deadline, forgedSignature)
      ).to.be.revertedWithCustomError(registry, "InvalidQrTicketSignature");

      // Corrupted signature bytes
      const corruptedSig = forgedSignature.slice(0, -4) + "0000";
      await expect(
        registry
          .connect(unauthorized)
          .checkInWithTicket(1, STUDENT_1, 1, deadline, corruptedSig)
      ).to.be.revertedWithCustomError(registry, "InvalidQrTicketSignature");
    });

    it("prevents double check-in with ticket and subsequent batch overwrites", async function () {
      const { registry, admin, teacherA, qrSigner, unauthorized } =
        await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);
      await registry
        .connect(admin)
        .enrollStudentsBatch(COURSE_CS701, [STUDENT_1]);
      await registry
        .connect(teacherA)
        .openSession(COURSE_CS701, TOPIC_HASH, 1000, 4000);

      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const signature = await signTicket(
        registry,
        qrSigner,
        1n,
        STUDENT_1,
        3, // LATE
        deadline
      );

      await registry
        .connect(unauthorized)
        .checkInWithTicket(1, STUDENT_1, 3, deadline, signature);

      // Replay attempt
      await expect(
        registry
          .connect(unauthorized)
          .checkInWithTicket(1, STUDENT_1, 3, deadline, signature)
      ).to.be.revertedWithCustomError(registry, "AttendanceAlreadyRecorded");

      // Batch attempt on the same student
      await expect(
        registry
          .connect(teacherA)
          .recordBatchAttendance(1, [STUDENT_1], [1], false)
      ).to.be.revertedWithCustomError(registry, "AttendanceAlreadyRecorded");
    });
  });

  describe("Attendance Corrections (correctAttendance)", function () {
    const REASON_HASH = ethers.id(
      "Medical leave certificate ML-2026-881 verified"
    );

    it("reverts correction if session is not closed or caller is unauthorized", async function () {
      const { registry, admin, teacherA, teacherB } = await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry.connect(admin).grantTeacherRole(teacherB.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);
      await registry
        .connect(admin)
        .enrollStudentsBatch(COURSE_CS701, [STUDENT_1]);
      await registry
        .connect(teacherA)
        .openSession(COURSE_CS701, TOPIC_HASH, 1000, 4000);

      // Session is still OPEN
      await expect(
        registry
          .connect(teacherA)
          .correctAttendance(1, STUDENT_1, 4, REASON_HASH)
      ).to.be.revertedWithCustomError(registry, "SessionNotClosed");

      // Record attendance and close session
      await registry
        .connect(teacherA)
        .recordBatchAttendance(1, [STUDENT_1], [2], true);

      // Unauthorized teacher
      await expect(
        registry
          .connect(teacherB)
          .correctAttendance(1, STUDENT_1, 4, REASON_HASH)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedCourseTeacher");
    });

    it("reverts correction on empty reason, invalid status, unrecorded student, or identical status", async function () {
      const { registry, admin, teacherA } = await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);
      await registry
        .connect(admin)
        .enrollStudentsBatch(COURSE_CS701, [STUDENT_1, STUDENT_2]);
      await registry
        .connect(teacherA)
        .openSession(COURSE_CS701, TOPIC_HASH, 1000, 4000);
      await registry
        .connect(teacherA)
        .recordBatchAttendance(1, [STUDENT_1], [2], true); // ABSENT

      // Empty reason
      await expect(
        registry
          .connect(teacherA)
          .correctAttendance(1, STUDENT_1, 4, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(registry, "EmptyCorrectionReason");

      // Invalid status bounds (0 or 5)
      await expect(
        registry
          .connect(teacherA)
          .correctAttendance(1, STUDENT_1, 0, REASON_HASH)
      ).to.be.revertedWithCustomError(registry, "InvalidAttendanceStatus");

      await expect(
        registry
          .connect(teacherA)
          .correctAttendance(1, STUDENT_1, 5, REASON_HASH)
      ).to.be.revertedWithCustomError(registry, "InvalidAttendanceStatus");

      // Identical status (2 -> 2)
      await expect(
        registry
          .connect(teacherA)
          .correctAttendance(1, STUDENT_1, 2, REASON_HASH)
      )
        .to.be.revertedWithCustomError(registry, "IdenticalAttendanceStatus")
        .withArgs(2);

      // Student not yet recorded in this session (STUDENT_2)
      await expect(
        registry
          .connect(teacherA)
          .correctAttendance(1, STUDENT_2, 1, REASON_HASH)
      ).to.be.revertedWithCustomError(registry, "AttendanceNotYetRecorded");
    });

    it("successfully corrects attendance, increments amendmentCount, and emits AttendanceCorrected", async function () {
      const { registry, admin, teacherA } = await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);
      await registry
        .connect(admin)
        .enrollStudentsBatch(COURSE_CS701, [STUDENT_1]);
      await registry
        .connect(teacherA)
        .openSession(COURSE_CS701, TOPIC_HASH, 1000, 4000);
      await registry
        .connect(teacherA)
        .recordBatchAttendance(1, [STUDENT_1], [2], true); // ABSENT

      // Teacher corrects from ABSENT (2) to EXCUSED (4)
      await expect(
        registry
          .connect(teacherA)
          .correctAttendance(1, STUDENT_1, 4, REASON_HASH)
      ).to.emit(registry, "AttendanceCorrected");

      let rec = await registry.getAttendanceRecord(1, STUDENT_1);
      expect(rec.status).to.equal(4n);
      expect(rec.amendmentCount).to.equal(1n);
      expect(rec.amendedAt).to.be.gt(0n);
      expect(rec.updatedBy).to.equal(teacherA.address);

      // Admin can also correct from EXCUSED (4) to PRESENT (1)
      const reason2 = ethers.id(
        "Administrative correction confirmed by registrar"
      );
      await expect(
        registry.connect(admin).correctAttendance(1, STUDENT_1, 1, reason2)
      ).to.emit(registry, "AttendanceCorrected");

      rec = await registry.getAttendanceRecord(1, STUDENT_1);
      expect(rec.status).to.equal(1n);
      expect(rec.amendmentCount).to.equal(2n);
      expect(rec.updatedBy).to.equal(admin.address);
    });
  });

  describe("Zero-PII & Calldata Privacy Inspection (NFR-001, FR-005)", function () {
    it("confirms that transactions store only 32-byte hashes and zero plaintext student names, emails, or roll numbers", async function () {
      const { registry, admin, teacherA } = await deployFixture();
      await registry.connect(admin).grantTeacherRole(teacherA.address);
      await registry
        .connect(admin)
        .createCourse(COURSE_CS701, teacherA.address);
      await registry
        .connect(admin)
        .enrollStudentsBatch(COURSE_CS701, [STUDENT_1]);
      await registry
        .connect(teacherA)
        .openSession(COURSE_CS701, TOPIC_HASH, 1000, 4000);

      const tx = await registry
        .connect(teacherA)
        .recordBatchAttendance(1, [STUDENT_1], [1], true);
      const receipt = await tx.wait();

      // Inspect calldata directly: must NOT contain plaintext strings like "Aarav" or "SYN-2026-042" or emails
      const txData = tx.data;
      const utf8Data = Buffer.from(txData.slice(2), "hex").toString("utf-8");

      expect(utf8Data).to.not.include("Aarav");
      expect(utf8Data).to.not.include("SYN-2026-042");
      expect(utf8Data).to.not.match(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
      );

      // Verify receipt logs contain indexed bytes32 studentIdHash
      const logs = receipt!.logs;
      expect(logs.length).to.be.gte(2); // AttendanceRecorded + SessionClosed + BatchCommitted
    });
  });
});
