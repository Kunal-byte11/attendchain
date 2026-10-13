// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title AttendChainRegistry
 * @notice Privacy-preserving, tamper-evident academic attendance registry.
 *         Stores only salted bytes32 pseudonymous student commitments (zero PII on-chain).
 */
contract AttendChainRegistry is AccessControl, EIP712 {
    bytes32 public constant TEACHER_ROLE = keccak256("TEACHER_ROLE");
    bytes32 public constant QR_TICKET_TYPEHASH =
        keccak256(
            "QrCheckInTicket(uint256 sessionId,bytes32 studentIdHash,uint8 status,uint256 deadline)"
        );
    uint256 public constant MAX_BATCH_SIZE = 100;

    uint8 public constant SESSION_NONE = 0;
    uint8 public constant SESSION_OPEN = 1;
    uint8 public constant SESSION_CLOSED = 2;
    uint8 public constant SESSION_CANCELLED = 3;

    uint8 public constant STATUS_NONE = 0;
    uint8 public constant STATUS_PRESENT = 1;
    uint8 public constant STATUS_ABSENT = 2;
    uint8 public constant STATUS_LATE = 3;
    uint8 public constant STATUS_EXCUSED = 4;

    struct Course {
        bytes32 courseIdHash;
        address assignedTeacher;
        bool exists;
        bool isActive;
    }

    struct Session {
        bytes32 courseIdHash;
        bytes32 metadataHash;
        address teacher;
        uint40 startTime;
        uint40 endTime;
        uint8 status;
    }

    /**
     * @dev Tightly packed into a single 32-byte storage slot (DEC-03):
     *      20B (updatedBy) + 5B (recordedAt) + 5B (amendedAt) + 1B (status) + 1B (amendmentCount) = 32B
     */
    struct AttendanceRecord {
        address updatedBy;
        uint40 recordedAt;
        uint40 amendedAt;
        uint8 status;
        uint8 amendmentCount;
    }

    address public qrTicketSigner;
    uint256 public sessionCount;

    mapping(bytes32 => Course) internal _courses;
    mapping(bytes32 => mapping(bytes32 => bool)) internal _courseEnrollments;
    mapping(uint256 => Session) internal _sessions;
    mapping(uint256 => mapping(bytes32 => AttendanceRecord))
        internal _attendanceRecords;

    // Custom Errors (04_ARCHITECTURE.md Section 4.3)
    error InvalidAddress();
    error InvalidTeacherRole(address candidate);
    error CourseAlreadyExists(bytes32 courseIdHash);
    error CourseNotFound(bytes32 courseIdHash);
    error UnauthorizedCourseTeacher(bytes32 courseIdHash, address caller);
    error ArrayLengthMismatch(uint256 studentsLength, uint256 statusesLength);
    error BatchSizeExceeded(uint256 provided, uint256 maxAllowed);
    error StudentNotEnrolled(bytes32 courseIdHash, bytes32 studentIdHash);
    error SessionNotOpen(uint256 sessionId, uint8 currentStatus);
    error SessionNotClosed(uint256 sessionId, uint8 currentStatus);
    error InvalidTimeWindow(uint40 startTime, uint40 endTime);
    error InvalidAttendanceStatus(uint8 status);
    error AttendanceAlreadyRecorded(uint256 sessionId, bytes32 studentIdHash);
    error AttendanceNotYetRecorded(uint256 sessionId, bytes32 studentIdHash);
    error IdenticalAttendanceStatus(uint8 currentStatus);
    error EmptyCorrectionReason();
    error ExpiredQrTicket(uint256 deadline, uint256 currentTimestamp);
    error InvalidQrTicketSignature();

    // Events (04_ARCHITECTURE.md Section 4.4)
    event TeacherRoleUpdated(
        address indexed teacher,
        bool indexed granted,
        address indexed admin,
        uint40 timestamp
    );
    event QrTicketSignerUpdated(
        address indexed previousSigner,
        address indexed newSigner,
        uint40 timestamp
    );
    event CourseCreated(
        bytes32 indexed courseIdHash,
        address indexed teacher,
        uint40 timestamp
    );
    event CourseTeacherUpdated(
        bytes32 indexed courseIdHash,
        address indexed previousTeacher,
        address indexed newTeacher,
        uint40 timestamp
    );
    event StudentsEnrolledBatch(
        bytes32 indexed courseIdHash,
        uint256 count,
        uint40 timestamp
    );
    event SessionOpened(
        uint256 indexed sessionId,
        bytes32 indexed courseIdHash,
        address indexed teacher,
        uint40 startTime,
        uint40 endTime,
        bytes32 metadataHash
    );
    event SessionClosed(
        uint256 indexed sessionId,
        address indexed closedBy,
        uint40 timestamp
    );
    event SessionCancelled(
        uint256 indexed sessionId,
        address indexed cancelledBy,
        bytes32 reasonHash,
        uint40 timestamp
    );
    event AttendanceRecorded(
        uint256 indexed sessionId,
        bytes32 indexed studentIdHash,
        uint8 status,
        address indexed recordedBy,
        uint40 timestamp
    );
    event AttendanceBatchCommitted(
        uint256 indexed sessionId,
        uint256 studentCount,
        address indexed committedBy,
        bool sessionClosed,
        uint40 timestamp
    );
    event AttendanceCorrected(
        uint256 indexed sessionId,
        bytes32 indexed studentIdHash,
        uint8 previousStatus,
        uint8 newStatus,
        bytes32 reasonHash,
        address indexed correctedBy,
        uint8 amendmentCount,
        uint40 timestamp
    );

    constructor(
        address initialAdmin,
        address initialQrSigner
    ) EIP712("AttendChainRegistry", "1") {
        if (initialAdmin == address(0) || initialQrSigner == address(0)) {
            revert InvalidAddress();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        qrTicketSigner = initialQrSigner;
        emit QrTicketSignerUpdated(
            address(0),
            initialQrSigner,
            uint40(block.timestamp)
        );
    }

    modifier onlyCourseTeacherOrAdmin(bytes32 courseIdHash) {
        Course storage course = _courses[courseIdHash];
        if (!course.exists) {
            revert CourseNotFound(courseIdHash);
        }
        if (
            course.assignedTeacher != msg.sender &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) {
            revert UnauthorizedCourseTeacher(courseIdHash, msg.sender);
        }
        _;
    }

    // -------------------------------------------------------------------------
    // 1. Role & Signer Management (FR-003, FR-004, TR-003)
    // -------------------------------------------------------------------------

    function grantTeacherRole(
        address teacher
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (teacher == address(0)) {
            revert InvalidAddress();
        }
        _grantRole(TEACHER_ROLE, teacher);
        emit TeacherRoleUpdated(
            teacher,
            true,
            msg.sender,
            uint40(block.timestamp)
        );
    }

    function revokeTeacherRole(
        address teacher
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!hasRole(TEACHER_ROLE, teacher)) {
            revert InvalidTeacherRole(teacher);
        }
        _revokeRole(TEACHER_ROLE, teacher);
        emit TeacherRoleUpdated(
            teacher,
            false,
            msg.sender,
            uint40(block.timestamp)
        );
    }

    function setQrTicketSigner(
        address newSigner
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newSigner == address(0)) {
            revert InvalidAddress();
        }
        address previous = qrTicketSigner;
        qrTicketSigner = newSigner;
        emit QrTicketSignerUpdated(
            previous,
            newSigner,
            uint40(block.timestamp)
        );
    }

    // -------------------------------------------------------------------------
    // 2. Course & Batch Student Enrollment Management (FR-007, TR-005)
    // -------------------------------------------------------------------------

    function createCourse(
        bytes32 courseIdHash,
        address teacher
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (courseIdHash == bytes32(0)) {
            revert CourseNotFound(courseIdHash);
        }
        if (_courses[courseIdHash].exists) {
            revert CourseAlreadyExists(courseIdHash);
        }
        if (!hasRole(TEACHER_ROLE, teacher)) {
            revert InvalidTeacherRole(teacher);
        }

        _courses[courseIdHash] = Course({
            courseIdHash: courseIdHash,
            assignedTeacher: teacher,
            exists: true,
            isActive: true
        });

        emit CourseCreated(courseIdHash, teacher, uint40(block.timestamp));
    }

    function updateCourseTeacher(
        bytes32 courseIdHash,
        address newTeacher
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Course storage course = _courses[courseIdHash];
        if (!course.exists) {
            revert CourseNotFound(courseIdHash);
        }
        if (!hasRole(TEACHER_ROLE, newTeacher)) {
            revert InvalidTeacherRole(newTeacher);
        }

        address previousTeacher = course.assignedTeacher;
        course.assignedTeacher = newTeacher;

        emit CourseTeacherUpdated(
            courseIdHash,
            previousTeacher,
            newTeacher,
            uint40(block.timestamp)
        );
    }

    function enrollStudentsBatch(
        bytes32 courseIdHash,
        bytes32[] calldata studentIdHashes
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!_courses[courseIdHash].exists) {
            revert CourseNotFound(courseIdHash);
        }
        uint256 len = studentIdHashes.length;
        if (len == 0 || len > MAX_BATCH_SIZE) {
            revert BatchSizeExceeded(len, MAX_BATCH_SIZE);
        }

        for (uint256 i = 0; i < len; ) {
            bytes32 studentHash = studentIdHashes[i];
            if (studentHash == bytes32(0)) {
                revert StudentNotEnrolled(courseIdHash, studentHash);
            }
            _courseEnrollments[courseIdHash][studentHash] = true;
            unchecked {
                ++i;
            }
        }

        emit StudentsEnrolledBatch(
            courseIdHash,
            len,
            uint40(block.timestamp)
        );
    }

    // -------------------------------------------------------------------------
    // 3. Lecture Session Lifecycle (FR-008, FR-009, TR-006)
    // -------------------------------------------------------------------------

    function openSession(
        bytes32 courseIdHash,
        bytes32 metadataHash,
        uint40 startTime,
        uint40 endTime
    )
        external
        onlyCourseTeacherOrAdmin(courseIdHash)
        returns (uint256 sessionId)
    {
        if (startTime == 0 || endTime <= startTime || metadataHash == bytes32(0)) {
            revert InvalidTimeWindow(startTime, endTime);
        }

        sessionId = ++sessionCount;
        _sessions[sessionId] = Session({
            courseIdHash: courseIdHash,
            metadataHash: metadataHash,
            teacher: msg.sender,
            startTime: startTime,
            endTime: endTime,
            status: SESSION_OPEN
        });

        emit SessionOpened(
            sessionId,
            courseIdHash,
            msg.sender,
            startTime,
            endTime,
            metadataHash
        );
    }

    function closeSession(uint256 sessionId) external {
        Session storage session = _sessions[sessionId];
        if (session.status != SESSION_OPEN) {
            revert SessionNotOpen(sessionId, session.status);
        }
        Course storage course = _courses[session.courseIdHash];
        if (
            course.assignedTeacher != msg.sender &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) {
            revert UnauthorizedCourseTeacher(session.courseIdHash, msg.sender);
        }

        session.status = SESSION_CLOSED;
        emit SessionClosed(sessionId, msg.sender, uint40(block.timestamp));
    }

    function cancelSession(uint256 sessionId, bytes32 reasonHash) external {
        Session storage session = _sessions[sessionId];
        if (session.status != SESSION_OPEN) {
            revert SessionNotOpen(sessionId, session.status);
        }
        if (reasonHash == bytes32(0)) {
            revert EmptyCorrectionReason();
        }
        Course storage course = _courses[session.courseIdHash];
        if (
            course.assignedTeacher != msg.sender &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) {
            revert UnauthorizedCourseTeacher(session.courseIdHash, msg.sender);
        }

        session.status = SESSION_CANCELLED;
        emit SessionCancelled(
            sessionId,
            msg.sender,
            reasonHash,
            uint40(block.timestamp)
        );
    }

    // -------------------------------------------------------------------------
    // 4. Attendance Recording, EIP-712 QR Check-In & Corrections (T-006)
    // -------------------------------------------------------------------------

    function recordBatchAttendance(
        uint256 sessionId,
        bytes32[] calldata studentIdHashes,
        uint8[] calldata statuses,
        bool closeAfter
    ) external {
        Session storage session = _sessions[sessionId];
        if (session.status != SESSION_OPEN) {
            revert SessionNotOpen(sessionId, session.status);
        }

        bytes32 courseIdHash = session.courseIdHash;
        if (
            _courses[courseIdHash].assignedTeacher != msg.sender &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) {
            revert UnauthorizedCourseTeacher(courseIdHash, msg.sender);
        }

        {
            uint256 len = studentIdHashes.length;
            if (len != statuses.length) {
                revert ArrayLengthMismatch(len, statuses.length);
            }
            if (len == 0 || len > MAX_BATCH_SIZE) {
                revert BatchSizeExceeded(len, MAX_BATCH_SIZE);
            }
        }

        uint40 now40 = uint40(block.timestamp);
        AttendanceRecord memory template = AttendanceRecord({
            updatedBy: msg.sender,
            recordedAt: now40,
            amendedAt: 0,
            status: 0,
            amendmentCount: 0
        });

        for (uint256 i = 0; i < studentIdHashes.length; ) {
            bytes32 studentIdHash = studentIdHashes[i];
            uint8 status = statuses[i];

            if (status < STATUS_PRESENT || status > STATUS_EXCUSED) {
                revert InvalidAttendanceStatus(status);
            }
            if (!_courseEnrollments[courseIdHash][studentIdHash]) {
                revert StudentNotEnrolled(courseIdHash, studentIdHash);
            }
            if (
                _attendanceRecords[sessionId][studentIdHash].status !=
                STATUS_NONE
            ) {
                revert AttendanceAlreadyRecorded(sessionId, studentIdHash);
            }

            template.status = status;
            _attendanceRecords[sessionId][studentIdHash] = template;

            emit AttendanceRecorded(
                sessionId,
                studentIdHash,
                status,
                msg.sender,
                now40
            );

            unchecked {
                ++i;
            }
        }

        if (closeAfter) {
            session.status = SESSION_CLOSED;
            emit SessionClosed(sessionId, msg.sender, now40);
        }

        emit AttendanceBatchCommitted(
            sessionId,
            studentIdHashes.length,
            msg.sender,
            closeAfter,
            now40
        );
    }

    function checkInWithTicket(
        uint256 sessionId,
        bytes32 studentIdHash,
        uint8 status,
        uint256 deadline,
        bytes calldata serverSignature
    ) external {
        Session storage session = _sessions[sessionId];
        if (session.status != SESSION_OPEN) {
            revert SessionNotOpen(sessionId, session.status);
        }
        if (block.timestamp > deadline) {
            revert ExpiredQrTicket(deadline, block.timestamp);
        }
        if (status != STATUS_PRESENT && status != STATUS_LATE) {
            revert InvalidAttendanceStatus(status);
        }
        if (!_courseEnrollments[session.courseIdHash][studentIdHash]) {
            revert StudentNotEnrolled(session.courseIdHash, studentIdHash);
        }
        if (_attendanceRecords[sessionId][studentIdHash].status != STATUS_NONE) {
            revert AttendanceAlreadyRecorded(sessionId, studentIdHash);
        }

        _verifyQrTicket(
            sessionId,
            studentIdHash,
            status,
            deadline,
            serverSignature
        );

        uint40 now40 = uint40(block.timestamp);
        _attendanceRecords[sessionId][studentIdHash] = AttendanceRecord({
            updatedBy: msg.sender,
            recordedAt: now40,
            amendedAt: 0,
            status: status,
            amendmentCount: 0
        });

        emit AttendanceRecorded(
            sessionId,
            studentIdHash,
            status,
            msg.sender,
            now40
        );
    }

    function _verifyQrTicket(
        uint256 sessionId,
        bytes32 studentIdHash,
        uint8 status,
        uint256 deadline,
        bytes calldata serverSignature
    ) internal view {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    QR_TICKET_TYPEHASH,
                    sessionId,
                    studentIdHash,
                    status,
                    deadline
                )
            )
        );
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(
            digest,
            serverSignature
        );
        if (err != ECDSA.RecoverError.NoError || recovered != qrTicketSigner) {
            revert InvalidQrTicketSignature();
        }
    }

    function correctAttendance(
        uint256 sessionId,
        bytes32 studentIdHash,
        uint8 newStatus,
        bytes32 reasonHash
    ) external {
        Session storage session = _sessions[sessionId];
        if (session.status != SESSION_CLOSED) {
            revert SessionNotClosed(sessionId, session.status);
        }

        bytes32 courseIdHash = session.courseIdHash;
        Course storage course = _courses[courseIdHash];
        if (
            course.assignedTeacher != msg.sender &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) {
            revert UnauthorizedCourseTeacher(courseIdHash, msg.sender);
        }

        if (reasonHash == bytes32(0)) {
            revert EmptyCorrectionReason();
        }
        if (newStatus < STATUS_PRESENT || newStatus > STATUS_EXCUSED) {
            revert InvalidAttendanceStatus(newStatus);
        }

        AttendanceRecord storage record = _attendanceRecords[sessionId][
            studentIdHash
        ];
        uint8 previousStatus = record.status;
        if (previousStatus == STATUS_NONE) {
            revert AttendanceNotYetRecorded(sessionId, studentIdHash);
        }
        if (newStatus == previousStatus) {
            revert IdenticalAttendanceStatus(previousStatus);
        }

        uint40 now40 = uint40(block.timestamp);
        record.status = newStatus;
        record.updatedBy = msg.sender;
        record.amendedAt = now40;
        if (record.amendmentCount < 255) {
            unchecked {
                ++record.amendmentCount;
            }
        }

        emit AttendanceCorrected(
            sessionId,
            studentIdHash,
            previousStatus,
            newStatus,
            reasonHash,
            msg.sender,
            record.amendmentCount,
            now40
        );
    }

    // -------------------------------------------------------------------------
    // 5. Read-Only View Helpers
    // -------------------------------------------------------------------------

    function getCourse(
        bytes32 courseIdHash
    ) external view returns (Course memory) {
        return _courses[courseIdHash];
    }

    function getSession(
        uint256 sessionId
    ) external view returns (Session memory) {
        return _sessions[sessionId];
    }

    function isStudentEnrolled(
        bytes32 courseIdHash,
        bytes32 studentIdHash
    ) external view returns (bool) {
        return _courseEnrollments[courseIdHash][studentIdHash];
    }

    function getAttendanceRecord(
        uint256 sessionId,
        bytes32 studentIdHash
    ) external view returns (AttendanceRecord memory) {
        return _attendanceRecords[sessionId][studentIdHash];
    }
}
