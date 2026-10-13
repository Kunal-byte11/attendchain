# 01_PRD.md — Product Requirements Document

- **Purpose:** Define the product vision, problem statement, user personas, end-to-end journeys, functional and non-functional requirements, attendance calculation rules, and MVP boundaries for AttendChain.
- **Status:** Draft v1
- **Last updated:** 2026-10-13
- **Depends on:** None (Root requirements document)

---

## 1. Product Vision & Problem Statement

### 1.1 Product Vision
**AttendChain** is a decentralized student attendance management platform designed to transition academic institutions from manual pen-and-paper registers and opaque centralized spreadsheets to a cryptographically verifiable Web3 workflow. By combining a fast, accessible Next.js and Supabase academic portal with an immutable smart contract audit layer on Ethereum Sepolia (and local Hardhat networks), AttendChain enables colleges to record, verify, and audit classroom attendance without exposing student Personally Identifiable Information (PII) on a public blockchain.

### 1.2 Problem Statement
Traditional college attendance systems suffer from four structural weaknesses:
1. **Single Point of Manipulation:** Paper attendance sheets and centralized SQL databases allow unilateral, retroactive modification of historical attendance records by administrators, faculty, or database operators without an immutable, tamper-evident audit trail.
2. **Lack of Independent Verification:** Students have no independent mechanism to verify when their attendance for a specific lecture was recorded or whether a subsequent alteration occurred; disputes rely on word-of-mouth or unverified screenshots.
3. **High Administrative Friction:** Manual roll calls and paper-to-spreadsheet transcription consume 5–10 minutes of every 50-minute lecture and introduce transcription errors.
4. **Late Dispute Escalation:** Attendance shortages are frequently discovered only at the end of a semester when examination eligibility lists are published, leaving no verifiable history of incremental edits or correction approvals.

### 1.3 Current Workflow vs. AttendChain Workflow

| Dimension | Current Pen-and-Paper / Centralized Workflow | AttendChain Web3 Workflow |
| :--- | :--- | :--- |
| **Roll Call Capture** | Teacher calls out names on paper sheet or clicks checkboxes in an unaudited web form. | Teacher opens a lecture session and captures attendance via **Teacher Batch Marking** or **Dynamic Rotating QR Check-In** (both supported). |
| **Finality & Commit** | Saved to a mutable database table (`UPDATE attendance SET status = ...`) or kept in physical folders. | Committed on-chain in a single gas-efficient batch transaction (`recordBatchAttendance`) or verified student check-in (`checkInWithTicket`) emitting immutable EVM events. |
| **Student Identity** | Names and university roll numbers exposed on shared sheets. | Off-chain PII stays in encrypted PostgreSQL (Supabase); on-chain records use only a salted `bytes32` **pseudonymous student ID (`studentIdHash`)**. |
| **Corrections** | Old values are overwritten in-place; previous state is lost. | Original on-chain record remains visible in event history; corrections require an explicit `correctAttendance` transaction with a mandatory reason code and hash, preserving both original and amended states. |
| **Verification** | Student must trust the portal screenshot. | Student, teacher, or auditor can verify the exact transaction hash (`txHash`), block number, timestamp, and contract event directly against an Ethereum Sepolia RPC node or block explorer. |

---

## 2. Evidentiary Boundaries: Recorded Attendance vs. Verified History vs. Physical Presence

To uphold engineering and academic integrity, AttendChain enforces a strict conceptual distinction across all user interfaces and documentation:

1. **Off-Chain Draft / Recorded Attendance:** Attendance statuses staged in the application database (for example, when a student scans a dynamic QR code and signs an off-chain challenge or a teacher toggles checkboxes prior to clicking "Commit to Blockchain"). Draft records are **mutable and unverified** until confirmed in an on-chain block.
2. **Independently Verified On-Chain Transaction History:** Attendance records committed to the `AttendChainRegistry` smart contract on Hardhat or Ethereum Sepolia. Once confirmed, this proves **cryptographic provenance and temporal integrity**: *which authorized wallet submitted a specific attendance status for a specific `studentIdHash` and `sessionId`, at what block timestamp, and whether any subsequent correction transaction was executed.*
3. **Proof of Physical Presence (Explicit Limitation):** **Blockchain does not and cannot prove physical presence in a classroom.** A confirmed transaction proves that the smart contract's authorization and session-window rules were satisfied by the signing wallet(s). While dynamic rotating QR codes (30-second TTL) combined with teacher roster review reduce remote proxy check-ins, a teacher who intentionally marks an absent student present—or a student inside the room who photographs a QR code for a peer within the 30-second window—cannot be prevented by blockchain consensus alone.

---

## 3. Product Goals & Measurable Success Metrics

| Goal ID | Product Goal | Success Metric | Target | Measurement Method |
| :--- | :--- | :--- | :--- | :--- |
| **G-01** | Eliminate silent retroactive attendance tampering | Percentage of committed attendance state changes that emit an immutable on-chain event with signer address, timestamp, and reason metadata | **100%** of finalized and corrected attendance records | Automated smart contract unit/integration test suite verifying event emission on every state-mutating function |
| **G-02** | Preserve student privacy on public testnets | Number of PII fields (student name, roll number, email, phone) stored in contract storage, transaction calldata, or contract events | **0 PII fields** on-chain | Static inspection of Solidity ABI/events and automated test scanning transaction calldata against synthetic PII fixtures |
| **G-03** | Replace manual pen-and-paper roll call within lecture time constraints | Time required for a teacher to create a lecture session, capture 30 students (via QR or batch selection), and submit the on-chain batch transaction | **$\le 90$ seconds** (excluding external Sepolia block confirmation wait) | End-to-end Playwright workflow timer and live demonstration stopwatch check |
| **G-04** | Enable independent cryptographic verification | Percentage of committed attendance records that can be independently verified by querying the blockchain RPC using the stored `txHash` and comparing the on-chain state to the UI state | **100%** match accuracy | Automated verification test in the Transaction Verification screen (`FR-014`) |
| **G-05** | Deliver a demonstrable MVP within the academic timeline | Completion of all `Must` functional requirements deployed to local Hardhat and Ethereum Sepolia | **100% of `Must` requirements** within the 12-day target | Phase 5 Exit Gate verification checklist in `08_PHASES.md` |

---

## 4. Explicit Non-Goals

The following items are **strictly out of scope** for AttendChain:
1. **No Custom Token, Cryptocurrency, or Financial Incentives:** AttendChain will not issue ERC-20 utility tokens, NFTs for attendance, or monetary rewards.
2. **No Biometric or Hardware IoT Integration:** Fingerprint scanners, facial recognition cameras, Bluetooth beacons, and NFC hardware gates are excluded.
3. **No Mainnet Deployment:** AttendChain will only target local Hardhat (`chainId: 31337`) and Ethereum Sepolia testnet (`chainId: 11155111`).
4. **No Real Student PII in Development or Testnet Demos:** Only synthetic student datasets (e.g., `SYN-CSE-2026-001`) may be used.
5. **No Full ERP/LMS Replacement:** Grading, fee management, timetable scheduling algorithms, and assignment submissions are out of scope.
6. **No Autonomous Biometric Proof of Physical Presence:** As defined in Section 2, the platform does not claim hardware-level physical presence verification.

---

## 5. User Personas

### 5.1 Persona 1: College Administrator ("Dr. Rajesh Sharma — Academic Dean / ERP Admin")
- **Responsibilities:** Configures academic courses/subjects, assigns teachers to courses, registers student cohorts, maps pseudonymous student IDs (`studentIdHash`), manages role assignments (`ADMIN`, `TEACHER`), and audits institutional attendance compliance and correction logs.
- **Goals:** Ensure zero unauthorized grade/attendance tampering, maintain a clear audit trail of every post-lecture attendance correction, and onboard students even before every student has configured a personal Web3 wallet.
- **Pain Points:** Cannot tell whether a teacher modified attendance two months after a lecture; manual CSV consolidations at semester-end are error-prone and contested by students.

### 5.2 Persona 2: Faculty / Teacher ("Prof. Ananya Verma — Assistant Professor, Computer Science")
- **Responsibilities:** Opens lecture sessions for assigned courses, conducts roll call via live dynamic QR display or manual batch roster selection, commits session attendance to the blockchain, closes completed sessions, and submits justified attendance corrections when valid medical/academic excuses are approved.
- **Goals:** Complete classroom attendance in under 90 seconds without paying 60 separate gas fees for 60 students, and have cryptographic proof of what was recorded during class.
- **Pain Points:** Paper sheets get lost or damaged; individual blockchain transactions per student would be slow and costly; needs a seamless way to combine student QR check-ins with manual overrides for students whose phones are unavailable.

### 5.3 Persona 3: Enrolled Student ("Aarav Mehta — 7th Semester B.Tech Student")
- **Responsibilities:** Binds and authenticates a MetaMask wallet to their student profile, checks in during active lectures by scanning the teacher's dynamic QR code, monitors subject-wise attendance percentage against the college's 75% eligibility threshold, raises disputes if marked inaccurately, and verifies attendance transactions on-chain.
- **Goals:** Immediate transparency into subject-wise attendance percentage and independent proof that a "Present" mark was recorded on-chain and never silently flipped to "Absent."
- **Pain Points:** Doesn't always have testnet ETH in their wallet to pay gas for every lecture; discovers attendance discrepancies weeks too late; worries about their personal name and roll number being publicly visible on Etherscan.

---

## 6. End-to-End User Journeys

### Journey 1: Admin Institutional Onboarding & Privacy-Preserving Student Registration
1. **Authentication:** Admin connects MetaMask wallet on `/auth`, signs a Sign-In with Ethereum (EIP-4361 / SIWE) nonce challenge, and is routed to `/admin`.
2. **Teacher Role Grant:** Admin navigates to `/admin/roles`, enters Prof. Ananya's Ethereum wallet address and synthetic profile details, and clicks **"Grant Teacher Role"**. The Admin signs the `grantTeacherRole(teacherAddress)` contract transaction; once confirmed, the backend updates the role index.
3. **Course Creation & Assignment:** Admin navigates to `/admin/courses`, creates course `CS701 — Blockchain Architecture`, assigns Prof. Ananya as the course instructor, and commits `createCourse(courseIdHash, teacherAddress)` on-chain.
4. **Pseudonymous Student Registration:** Admin navigates to `/admin/students` and registers synthetic student `Aarav Mehta (Roll: SYN-2026-042)` into `CS701`. The backend computes `studentIdHash = keccak256(abi.encodePacked(INSTITUTION_HASH_SALT, "SYN-2026-042"))`, stores the PII mapping only in Supabase, and the Admin (or batch enrollment script) enrolls the `studentIdHash` on-chain via `enrollStudentsBatch(courseIdHash, [studentIdHash])`. Crucially, Aarav is now eligible for teacher-marked attendance immediately, even before linking a personal wallet.

### Journey 2: Teacher Lecture Creation, Dynamic QR Check-In, and Batch On-Chain Commit
1. **Session Creation:** Prof. Ananya authenticates with her wallet, navigates to `/teacher/lectures/new`, selects `CS701`, sets the session topic and duration, and clicks **"Open Lecture Session"**. This executes `openSession(courseIdHash, metadataHash, startTime, endTime)` on Sepolia and returns `sessionId`.
2. **Dynamic QR Check-In Mode:** On `/teacher/attendance/[sessionId]`, Prof. Ananya toggles **"Project Live Dynamic QR"**. The screen displays a high-contrast QR code that rotates its cryptographic challenge token every 30 seconds via the backend (`POST /api/sessions/[sessionId]/qr`).
3. **Student QR Scan (Gasless Queue or Direct On-Chain):** Aarav scans the QR code (or enters the 6-character rotating session PIN) on `/student`, signs the attendance challenge with his bound MetaMask wallet (`POST /api/attendance/qr-checkin`). The backend verifies the signature, enrollment, and 30-second QR token window, immediately marking Aarav as `PRESENT (QR Verified)` on Prof. Ananya's live roster screen (without requiring Aarav to spend Sepolia ETH, while also supporting direct on-chain `checkInWithTicket` if the student chooses).
4. **Manual Roster Review & Batch Commit:** For students without phones, Prof. Ananya manually sets their statuses (`PRESENT`, `LATE`, `ABSENT`, `EXCUSED`) on the same roster table. She clicks **"Commit Attendance & Close Session"**, which executes a single gas-efficient transaction `recordBatchAttendance(sessionId, studentIdHashes[], statuses[], closeAfter=true)`.
5. **Confirmation:** Once confirmed on Sepolia, every student's record stores the `txHash` and block number, and the session status transitions to `CLOSED`.

### Journey 3: Student Wallet Association, Percentage Tracking, and Independent Verification
1. **Wallet Binding:** Aarav enters his one-time synthetic student claim code on `/auth` (or Admin pre-maps his test wallet address on `/admin/students`), connects his MetaMask wallet, and signs a SIWE ownership message (`POST /api/auth/verify`) to bind his wallet to his pseudonymous `studentIdHash`.
2. **Attendance Dashboard & Percentage:** On `/student`, Aarav views his `CS701` attendance card showing `85.71%` (`12 Present / 14 Eligible Completed Sessions`), clearly marked as **Eligible ($\ge 75\%$)**.
3. **Independent Verification:** Aarav opens `/student/history`, clicks on Lecture #14 (`txHash: 0x8a3f...`), and opens the **Transaction Verification** view (`/verify?tx=0x8a3f...&session=14`). The app queries the Sepolia RPC directly from the browser, decodes the `AttendanceRecorded` event log for Aarav's `studentIdHash`, verifies that the on-chain status (`PRESENT`) and block timestamp match the database record, and provides a direct link to Sepolia Etherscan.

### Journey 4: Auditable Attendance Correction & Dispute Resolution
1. **Dispute / Correction Request:** A student (`SYN-2026-019`) was marked `ABSENT` during Lecture #12 while attending an approved university medical visit. The student submits a dispute request on `/corrections` (or presents documentation to Prof. Ananya).
2. **On-Chain Amendment:** Prof. Ananya opens `/corrections`, selects Lecture #12 (`CLOSED`) and student `SYN-2026-019`, changes status from `ABSENT` to `EXCUSED`, enters reason `"Approved Medical Certificate Ref #MC-104"`, and clicks **"Submit On-Chain Correction"**.
3. **Immutable Audit Trail:** The smart contract executes `correctAttendance(sessionId, studentIdHash, newStatus, reasonHash)`, verifying that the caller is the assigned course teacher (or Admin) and that the new status differs from the current status. It updates the active status mapping for percentage calculation while emitting `AttendanceCorrected(sessionId, studentIdHash, previousStatus, newStatus, reasonHash, correctedBy, timestamp)`.
4. **Audit Visibility:** Both the original `AttendanceRecorded` event (`ABSENT`) and the `AttendanceCorrected` event (`EXCUSED`) remain permanently visible in the **Correction & Dispute History** timeline (`/corrections`), preventing silent overwrites.

---

## 7. Attendance Percentage Calculation Rules

To prevent ambiguity between frontend displays, backend API aggregations, and test assertions, AttendChain enforces the following exact mathematical specification:

$$\text{Attendance Percentage} = \left( \frac{\text{Present Sessions}}{\text{Eligible Completed Sessions}} \right) \times 100$$

### 7.1 Status Definitions & Formula Impact

Every student-session pair in a course resolves to one effective on-chain status (the latest confirmed status from `AttendanceRecorded` or `AttendanceCorrected`):

| Attendance Status | Enum Value (Solidity `uint8`) | Effect on Numerator (`Present Sessions`) | Effect on Denominator (`Eligible Completed Sessions`) | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **`NONE` (Unrecorded)** | `0` | `+0` | `+0` if session is `OPEN` or `CANCELLED`; `+1` (treated as implicit `ABSENT`) if session is `CLOSED` for an enrolled student `[ASSUMPTION: A-01]` | Prevents inflated percentages if a student is left unmarked in a closed session. |
| **`PRESENT`** | `1` | **`+1`** | **`+1`** | Student attended within the standard session window. |
| **`ABSENT`** | `2` | **`+0`** | **`+1`** | Student did not attend an eligible completed session. |
| **`LATE`** | `3` | **`+1`** `[ASSUMPTION: A-02]` | **`+1`** | Student arrived after the punctuality threshold but within the lecture session; counts toward academic attendance credit while remaining filterable as `LATE` in reports. |
| **`EXCUSED`** | `4` | **`+0`** | **`+0` (Excluded from denominator)** `[ASSUMPTION: A-03]` | Approved medical/institutional leave removes the session from the student's eligible denominator so the student is not penalized, without falsifying that they were physically present. |

### 7.2 Session Lifecycle Impact on Calculation
- **`OPEN` Session:** Excluded from both numerator and denominator until the teacher commits attendance or closes the session (`CLOSED`).
- **`CLOSED` Session:** Included in calculations for all students enrolled in the course at the time of the session.
- **`CANCELLED` Session:** Excluded from both numerator and denominator for all students (`0` impact), regardless of any draft records created before cancellation.
- **Corrected Record (`AttendanceCorrected`):** The calculation always uses the **most recent confirmed on-chain status** for `(sessionId, studentIdHash)` while displaying an `"Amended"` badge linked to the historical event chain.

### 7.3 Precision, Edge Cases, and Eligibility Threshold
- **Rounding:** Rounded to **2 decimal places** using standard half-up rounding (e.g., `12 / 14 * 100 = 85.714...%` $\rightarrow$ `85.71%`).
- **Zero Eligible Sessions (`Denominator == 0`):** If a course has `0` closed sessions (or all closed sessions for a student are `EXCUSED` or `CANCELLED`), the numeric percentage returns `100.00%` with display label **`N/A (No Eligible Sessions)`** and status **`Eligible`** so new students are not flagged as in shortage.
- **Default Academic Shortage Threshold:** **`75.00%`** (`>= 75.00%` = `Regular / Eligible`; `65.00% – 74.99%` = `Warning / Condonation Zone`; `< 65.00%` = `Critical Shortage`) `[ASSUMPTION: A-04]`.

---

## 8. Functional Requirements Table

| ID | Functional Area | Requirement Description | Priority | Persona | Acceptance Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FR-001** | 1. Wallet & Auth | Connect EVM wallet (MetaMask / EIP-1193) and detect active account and chain ID (`31337` or `11155111`). | **Must** | All | User can connect/disconnect wallet; UI displays truncated address and network badge. |
| **FR-002** | 1. Wallet & Auth | Verify wallet ownership via cryptographic signed-message challenge (EIP-4361 SIWE with single-use backend nonce) before granting authenticated session access. | **Must** | All | Connecting a wallet without signing the nonce challenge grants zero access to protected routes or APIs. |
| **FR-003** | 2. Role Management | Grant and revoke `TEACHER_ROLE` and `ADMIN_ROLE` on-chain (`AccessControl`) and synchronize role assignments with the off-chain database. | **Must** | Admin | Only an Admin can grant/revoke roles on-chain; revoked wallets immediately lose write permissions on contract and API. |
| **FR-004** | 2. Role Management | Enforce role-based access control (RBAC) across Next.js routes, API endpoints, and smart contract functions for `ADMIN`, `TEACHER`, and `STUDENT`. | **Must** | All | Unauthorized role calls revert on-chain with custom errors and return `403 Forbidden` on API routes. |
| **FR-005** | 3. Student Registration | Register synthetic student profiles (Name, Roll Number, Department, Semester) off-chain and generate a deterministic salted `bytes32` pseudonymous ID (`studentIdHash`) registered on-chain. | **Must** | Admin | Student PII is stored only in Supabase; only `studentIdHash` is transmitted to or stored in the smart contract. |
| **FR-006** | 3. Student Registration | Associate and verify a student's MetaMask wallet address with their `studentIdHash` via Admin assignment or Student signed-challenge binding. | **Must** | Admin, Student | Each `studentIdHash` maps to at most one active wallet address; teachers can still mark attendance for `studentIdHash` even if wallet binding is pending. |
| **FR-007** | 4. Course & Lecture Mgmt | Create and manage academic courses/subjects (Course Code, Title, Semester, Assigned Teacher, Enrolled Students) with on-chain `courseIdHash` registration. | **Must** | Admin | Admin can create courses, assign an authorized Teacher, and enroll `studentIdHash` cohorts on-chain and off-chain. |
| **FR-008** | 4. Course & Lecture Mgmt | Create and open lecture sessions (`openSession`) for an assigned course with date, start/end timestamps, and topic metadata hash. | **Must** | Teacher | Assigned teacher can open a lecture session on-chain; unassigned teachers revert with `UnauthorizedTeacher`. |
| **FR-009** | 4. Course & Lecture Mgmt | Close (`closeSession`) or cancel (`cancelSession`) an active lecture session on-chain, preventing further standard attendance submissions after closure. | **Must** | Teacher, Admin | Closed or cancelled sessions reject standard `recordBatchAttendance` and `checkInWithTicket` transactions. |
| **FR-010** | 5. Attendance Marking | Record attendance manually/in-batch (`recordBatchAttendance`) for enrolled students in an `OPEN` session with statuses `PRESENT`, `ABSENT`, `LATE`, or `EXCUSED`. | **Must** | Teacher | Teacher can submit up to 100 student attendance statuses in a single transaction; non-enrolled `studentIdHash` entries revert. |
| **FR-011** | 5. Attendance Marking | Prevent duplicate attendance submissions for the same `(sessionId, studentIdHash)` during standard session marking. | **Must** | Teacher, Student | Attempting to record standard attendance twice for the same student in the same session reverts on-chain with `AttendanceAlreadyRecorded`. |
| **FR-012** | 6. History & Percentage | Display filterable student attendance history across courses and lecture sessions with status badges, timestamps, and transaction references. | **Must** | Student, Teacher, Admin | Users can view chronological session history filtered by course, status, and date range. |
| **FR-013** | 6. History & Percentage | Calculate and display real-time subject-wise and overall attendance percentages using the exact formula in Section 7, highlighting 75% eligibility status. | **Must** | Student, Teacher, Admin | Percentage matches `(Present + Late) / (Closed Enrolled - Excused - Cancelled) * 100` to 2 decimal places across all views. |
| **FR-014** | 7. Verification & Audit | Verify any attendance record independently by querying the blockchain RPC for its `txHash` and contract state, comparing on-chain values against off-chain database records. | **Must** | All | Verification screen displays on-chain block number, timestamp, signer, decoded event payload, match status (`VERIFIED` or `MISMATCH`), and Sepolia Etherscan link. |
| **FR-015** | 7. Verification & Audit | Display a complete chronological audit trail of all contract events (`SessionOpened`, `AttendanceRecorded`, `AttendanceCorrected`, `SessionClosed`) for any session or student. | **Must** | All | Audit timeline shows both original and amended records with block numbers and transaction hashes. |
| **FR-016** | 8. Corrections & Disputes | Execute auditable on-chain attendance corrections (`correctAttendance`) on `CLOSED` sessions with mandatory reason text (off-chain) and `reasonHash` (on-chain), preserving original history. | **Must** | Teacher, Admin | Correction updates active status, emits `AttendanceCorrected` with old/new status and `reasonHash`, and never deletes the original `AttendanceRecorded` event. |
| **FR-017** | 8. Corrections & Disputes | Allow students to submit an off-chain attendance dispute/correction request for a specific session, which teachers/admins can review, approve (triggering `FR-016`), or reject with notes. | **Should** | Student, Teacher | Student can submit one dispute per session record; teacher approval triggers the on-chain `correctAttendance` flow. |
| **FR-018** | 9. Dynamic QR Check-In | Generate a live, rotating cryptographic QR code (30-second refresh interval) for an `OPEN` lecture session on the Teacher screen. | **Must** | Teacher | QR code rotates every 30 seconds; expired tokens (>35s including 5s grace window) are rejected by the server. |
| **FR-019** | 9. Dynamic QR Check-In | Validate student QR check-in via wallet signature and either stage the verified check-in for the teacher's batch commit or issue an EIP-712 ticket for direct student on-chain check-in (`checkInWithTicket`). | **Must** | Student, Teacher | Only enrolled students with a valid wallet signature and active QR token can check in; replay of used tokens is blocked. |
| **FR-020** | 10. Admin Reporting | Generate course-wise and shortage-student (<75%) summary reports with CSV export containing verification transaction hashes. | **Should** | Admin, Teacher | Admin/Teacher can view shortage alerts and export a CSV report of course attendance percentages. |
| **FR-021** | 11. Failure Handling | Detect wrong network (`chainId` mismatch), disconnected wallet, rejected signature, insufficient gas funds, and reverted transactions, displaying actionable recovery UI. | **Must** | All | Every failure state shows a human-readable banner/modal with a 1-click recovery action (e.g., "Switch to Sepolia", "Retry Signature"). |
| **FR-022** | 11. Failure Handling | Handle RPC rate limits or primary endpoint outages via automatic fallback RPC provider configuration and pending transaction state recovery across page reloads. | **Must** | All | If primary RPC fails, client/server falls back to secondary RPC; pending `txHash` stored in local/session state resumes tracking after page refresh. |

---

## 9. Non-Functional Requirements Table

| ID | Category | Requirement Description | Target Metric | Verification Method |
| :--- | :--- | :--- | :--- | :--- |
| **NFR-001** | Privacy & Data Minimization | Zero student PII (names, roll numbers, emails, phone numbers) may be written to smart contract storage, transaction calldata, or emitted events. | **0 bytes of raw PII** on-chain | Automated test inspecting all contract ABI parameters and emitted logs against synthetic student PII strings. |
| **NFR-002** | Application Performance | Off-chain API endpoints and dashboard page loads (reading indexed Supabase records) must respond rapidly independent of blockchain block times. | API p95 latency **$\le 300\text{ ms}$**; Initial page LCP **$\le 2.0\text{ s}$** on local/broadband | Vitest API benchmark assertions and Lighthouse/Playwright performance checks. |
| **NFR-003** | Blockchain UX Feedback | When a user initiates an on-chain transaction, the UI must transition to an explicit `Awaiting Wallet Signature` state and, once signed, a `Pending Confirmation` state with `txHash` link before block inclusion. | State transition feedback **$\le 150\text{ ms}$** after user click / wallet broadcast | Playwright E2E transaction lifecycle test. |
| **NFR-004** | Smart Contract Gas Efficiency | Batch attendance recording (`recordBatchAttendance`) must optimize storage layout (packed structs/mappings) so a 50-student lecture fits well within standard block and wallet gas limits. | **$\le 1,500,000\text{ gas}$** for 50 students in a single batch (~30,000 gas/student) | Hardhat gas reporter assertion in contract test suite. |
| **NFR-005** | Security & Authentication | All state-mutating API routes must require a valid HTTP-only session cookie obtained via verified EIP-4361 (SIWE) signature with a single-use, expiring nonce ($\le 5$ minutes TTL). | **100%** of write API endpoints reject unsigned/expired requests with `401`/`403` | Integration security test suite attempting unauthenticated, replayed, and forged requests. |
| **NFR-006** | Accessibility | All core screens must conform to **WCAG 2.2 Level AA**, including keyboard navigation, visible focus rings, ARIA status announcements for transactions, and color contrast ratios. | Contrast **$\ge 4.5:1$** (normal text) / **$\ge 3.0:1$** (large text/UI); **0 critical/serious axe-core violations** | Automated `@axe-core/playwright` accessibility checks on core routes. |
| **NFR-007** | Reliability & Idempotency | Event synchronization between the blockchain and Supabase must be idempotent, keyed by `(chainId, txHash, logIndex)`, preventing duplicate database rows on retries or re-syncs. | **0 duplicate attendance records** after 3 repeated sync runs of the same block range | Integration test executing the event sync service multiple times over identical contract logs. |
| **NFR-008** | Test Coverage | Smart contracts and core business logic (attendance percentage calculator, QR token validator, auth verifier) must maintain high automated test coverage. | **$\ge 90\%$ line and branch coverage** on Solidity contracts and core calculation/auth modules | `solidity-coverage` and `vitest --coverage` reports in CI. |

---

## 10. User Stories & Testable Acceptance Criteria for All `Must` Requirements

### FR-001: Wallet Connection & Network Detection
- **User Story:** As a platform user, I want to connect my MetaMask wallet and see my current network status so that I can interact with AttendChain on the supported blockchain.
- **Acceptance Criteria:**
  - **Given** a user visits `/auth` with MetaMask installed, **When** they click "Connect Wallet" and approve account access, **Then** the UI displays their checksummed truncated address (e.g., `0x71C...89A`) and current network name (`Hardhat Local` or `Ethereum Sepolia`).
  - **Given** a user visits `/auth` without an EIP-1193 wallet extension installed, **When** the page loads, **Then** the UI displays a clear non-crashing fallback alert explaining how to install MetaMask or use the demo read-only verifier.

### FR-002: Signed-Message Wallet Ownership Verification (SIWE)
- **User Story:** As a security-conscious administrator, I want every user to prove ownership of their connected wallet via a cryptographic signature before accessing role-protected dashboards.
- **Acceptance Criteria:**
  - **Given** a user has connected their wallet in MetaMask, **When** they have not yet signed the server-generated nonce challenge, **Then** navigating to `/admin`, `/teacher`, or `/student` redirects to `/auth` and API calls return `401 Unauthorized`.
  - **Given** a user requests a challenge from `POST /api/auth/nonce`, **When** they sign the EIP-4361 message in MetaMask and submit it to `POST /api/auth/verify` within 5 minutes, **Then** the server verifies the recovered address, marks the nonce as consumed, sets an `HttpOnly` session cookie, and redirects the user to their role dashboard.
  - **Given** an attacker replays an already-used nonce signature to `POST /api/auth/verify`, **When** the server processes the request, **Then** it rejects the request with `401 Unauthorized` (`NONCE_ALREADY_USED`).

### FR-003: Role Assignment & Revocation
- **User Story:** As an Admin, I want to grant and revoke Teacher and Admin roles on the smart contract so that only authorized faculty can open lecture sessions and record attendance.
- **Acceptance Criteria:**
  - **Given** an authenticated Admin on `/admin/roles`, **When** they submit a valid Ethereum address to grant `TEACHER_ROLE` and confirm the transaction in MetaMask, **Then** `AttendChainRegistry.hasRole(TEACHER_ROLE, targetAddress)` returns `true` on-chain and the database reflects the active role.
  - **Given** an Admin revokes `TEACHER_ROLE` from a wallet address, **When** that revoked wallet subsequently attempts to call `openSession` or `recordBatchAttendance`, **Then** the smart contract reverts with `AccessControlUnauthorizedAccount`.

### FR-004: Role-Based Access Control (RBAC) Enforcement
- **User Story:** As an Admin, I want role permissions enforced across the UI, backend API, and smart contract so that students or unauthenticated users cannot tamper with courses or attendance.
- **Acceptance Criteria:**
  - **Given** a user authenticated with the `STUDENT` role, **When** they attempt to access `/admin/*` or `/teacher/*` or send a `POST` request to `/api/courses`, **Then** the route redirects / responds with `403 Forbidden`.
  - **Given** a wallet without `TEACHER_ROLE` or `ADMIN_ROLE`, **When** it calls any teacher/admin state-changing contract method directly via RPC, **Then** the transaction reverts on-chain.

### FR-005: Privacy-Preserving Student Registration
- **User Story:** As an Admin, I want to register students with their synthetic roll numbers off-chain while storing only a salted cryptographic hash (`studentIdHash`) on-chain so that student PII is never exposed on a public blockchain.
- **Acceptance Criteria:**
  - **Given** an Admin submits a student registration form (`Name: "Aarav Mehta"`, `Roll: "SYN-2026-042"`) on `/admin/students`, **When** the registration completes, **Then** the database stores the name and roll number alongside `studentIdHash = keccak256(abi.encodePacked(INSTITUTION_HASH_SALT, "SYN-2026-042"))`, and the on-chain contract receives only `studentIdHash`.
  - **Given** any transaction emitted by `AttendChainRegistry`, **When** its input calldata and event logs are inspected, **Then** neither `"Aarav Mehta"` nor `"SYN-2026-042"` appears in plaintext or unsalted encoding.

### FR-006: Student Wallet Association & Optional Pre-Wallet Attendance
- **User Story:** As an Admin or Student, I want to link a MetaMask wallet address to a registered `studentIdHash` while still allowing teachers to mark attendance for registered students who have not yet connected a wallet.
- **Acceptance Criteria:**
  - **Given** a registered student with `studentIdHash` and no bound wallet (`wallet_address = NULL`), **When** a Teacher records batch attendance for the course, **Then** the smart contract accepts `studentIdHash` and records the student's attendance on-chain.
  - **Given** an unlinked student enters their one-time `studentClaimCode` on `/auth` and signs a SIWE binding message with MetaMask, **When** `POST /api/auth/verify` verifies the signature and claim code, **Then** the student's wallet is bound to their `studentIdHash` and they can view their attendance history and perform QR check-ins using that wallet.

### FR-007: Course & Subject Management
- **User Story:** As an Admin, I want to create courses, assign an authorized teacher, and enroll student cohorts so that lecture sessions validate course membership on-chain.
- **Acceptance Criteria:**
  - **Given** an Admin on `/admin/courses`, **When** they create course `CS701`, assign a wallet holding `TEACHER_ROLE`, and enroll a list of `studentIdHash` values, **Then** the contract stores the course (`courseIdHash`), assigned teacher, and enrollment mapping (`isEnrolled[courseIdHash][studentIdHash] == true`).
  - **Given** an Admin attempts to assign a wallet that does not hold `TEACHER_ROLE` to a course, **When** the transaction is submitted, **Then** the contract reverts with `InvalidTeacherRole`.

### FR-008: Lecture Session Creation
- **User Story:** As a Teacher, I want to create and open a lecture session for my assigned course so that attendance can be recorded against a verifiable session ID and time window.
- **Acceptance Criteria:**
  - **Given** an authenticated Teacher assigned to `CS701`, **When** they submit the new lecture form on `/teacher/lectures/new` with a valid start/end time and confirm the transaction, **Then** the contract increments `sessionCount`, stores the session as `OPEN`, and emits `SessionOpened(sessionId, courseIdHash, teacher, startTime, endTime, metadataHash)`.
  - **Given** a Teacher who is *not* assigned to `CS701`, **When** they attempt to call `openSession` for `CS701`, **Then** the contract reverts with `UnauthorizedCourseTeacher`.

### FR-009: Lecture Session Closure & Cancellation
- **User Story:** As a Teacher, I want to close a completed lecture session or cancel a called-off lecture session on-chain so that closed sessions lock standard marking and cancelled sessions do not penalize student attendance percentages.
- **Acceptance Criteria:**
  - **Given** an `OPEN` lecture session, **When** the assigned Teacher calls `closeSession(sessionId)` (or commits batch attendance with `closeSession = true`), **Then** the session status becomes `CLOSED`, `SessionClosed` is emitted, and any subsequent call to `recordBatchAttendance` or `checkInWithTicket` for `sessionId` reverts with `SessionNotOpen`.
  - **Given** an `OPEN` lecture session, **When** the assigned Teacher or Admin calls `cancelSession(sessionId, reasonHash)`, **Then** the session status becomes `CANCELLED`, and the session is excluded from the denominator of all student attendance percentage calculations.

### FR-010: Teacher Manual & Batch Attendance Marking
- **User Story:** As a Teacher, I want to mark attendance statuses (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`) for all students in my lecture and commit them in a single batch transaction so that roll call is fast and gas-efficient.
- **Acceptance Criteria:**
  - **Given** an `OPEN` session for `CS701` with 30 enrolled students, **When** the Teacher selects statuses (or imports staged QR check-ins) and clicks "Commit Batch Attendance", **Then** `recordBatchAttendance(sessionId, studentIdHashes[], statuses[], closeSession)` executes in a single transaction, stores each status on-chain, and emits `AttendanceBatchRecorded` / `AttendanceRecorded` events.
  - **Given** a batch array containing a `studentIdHash` not enrolled in `CS701` or mismatched array lengths, **When** `recordBatchAttendance` is called, **Then** the transaction reverts with `StudentNotEnrolled` or `ArrayLengthMismatch`.

### FR-011: Duplicate Attendance Prevention
- **User Story:** As a Teacher or Student, I want the smart contract and backend to prevent duplicate attendance submissions for the same student in the same lecture session.
- **Acceptance Criteria:**
  - **Given** `studentIdHash` already has a non-`NONE` recorded status (`PRESENT`, `ABSENT`, `LATE`, or `EXCUSED`) on-chain for `sessionId`, **When** `recordBatchAttendance` or `checkInWithTicket` is called again for that same `(sessionId, studentIdHash)`, **Then** the smart contract reverts with `AttendanceAlreadyRecorded(sessionId, studentIdHash)`.
  - **Given** a batch payload submitted by a user or API contains duplicate `studentIdHash` entries within the same array, **When** processed, **Then** the request is rejected before broadcast (and reverts on-chain if called directly).

### FR-012: Attendance History View
- **User Story:** As a Student, Teacher, or Admin, I want to view a filterable list of lecture sessions and attendance records with timestamps and transaction hashes.
- **Acceptance Criteria:**
  - **Given** an authenticated Student on `/student/history`, **When** they filter by course `CS701` and status `PRESENT`, **Then** only their `CS701` records with effective status `PRESENT` are displayed, showing session date, topic, status badge, whether the record was amended, and a clickable `txHash` verification link.

### FR-013: Exact Attendance Percentage Calculation
- **User Story:** As a Student, Teacher, or Admin, I want attendance percentages calculated consistently according to institutional rules so that exam eligibility is transparent and indisputable.
- **Acceptance Criteria:**
  - **Given** a student in `CS701` with 10 `CLOSED` sessions where their effective statuses are: 6 `PRESENT`, 1 `LATE`, 2 `ABSENT`, and 1 `EXCUSED`, plus 1 `OPEN` session and 1 `CANCELLED` session, **When** their attendance percentage is calculated, **Then** Numerator = `6 + 1 = 7`, Denominator = `10 - 1 (Excused) = 9`, and Attendance Percentage = `(7 / 9) * 100 = 77.78%` (`Eligible`).
  - **Given** a student in a newly created course with `0` eligible completed sessions, **When** their percentage is displayed, **Then** the UI shows `N/A (No Eligible Sessions)` with baseline `100.00%` and does not throw a `NaN` or division-by-zero error.

### FR-014: Independent Blockchain Transaction Verification
- **User Story:** As a Student or Auditor, I want to verify any attendance record directly against the blockchain RPC so that I do not have to blindly trust the application's database.
- **Acceptance Criteria:**
  - **Given** a user opens `/verify` with a valid `sessionId`, `studentIdHash` (or authenticated student context), and `txHash`, **When** they click "Verify On-Chain", **Then** the application fetches the transaction receipt and contract storage state (`getAttendanceRecord(sessionId, studentIdHash)`) directly from the configured RPC node, compares the on-chain status, timestamp, and signer with the off-chain database record, and renders a green `CRYPTOGRAPHICALLY VERIFIED` badge (or red `DATA INTEGRITY MISMATCH` alert if the database was tampered with).

### FR-015: Chronological Audit Trail
- **User Story:** As an Admin, Teacher, or Student, I want to inspect the full event history for a session or attendance record so that every state transition from session opening to post-closure corrections is visible.
- **Acceptance Criteria:**
  - **Given** an attendance record was originally committed as `ABSENT` in transaction `tx1` and later corrected to `PRESENT` in transaction `tx2`, **When** a user views the record's audit drawer or `/corrections`, **Then** both `tx1` (`AttendanceRecorded: ABSENT`) and `tx2` (`AttendanceCorrected: ABSENT -> PRESENT`, reason, signer, block timestamp) are displayed in chronological order.

### FR-016: Auditable On-Chain Attendance Corrections
- **User Story:** As a Teacher or Admin, I want to submit an auditable correction for a closed session with a mandatory reason so that legitimate attendance errors can be fixed without erasing historical evidence.
- **Acceptance Criteria:**
  - **Given** a `CLOSED` session where `studentIdHash` has a recorded status of `ABSENT`, **When** the assigned Teacher or Admin submits `correctAttendance(sessionId, studentIdHash, newStatus, reasonHash)` with a non-empty reason (minimum 10 characters off-chain, non-zero `bytes32 reasonHash` on-chain), **Then** the contract updates the current effective status to `newStatus`, increments the record's `amendmentCount`, and emits `AttendanceCorrected`.
  - **Given** a caller attempts to call `correctAttendance` with `reasonHash == bytes32(0)` or `newStatus == currentStatus`, **When** the transaction executes, **Then** the smart contract reverts with `EmptyCorrectionReason` or `IdenticalAttendanceStatus`.

### FR-018 & FR-019: Dynamic QR-Code Attendance & Validation
- **User Story:** As a Teacher and Student, we want to use a live rotating QR code during an active lecture so that students in class can check in quickly using their authenticated wallets while preventing screenshot reuse after the 30-second window.
- **Acceptance Criteria:**
  - **Given** an `OPEN` lecture session on `/teacher/attendance/[sessionId]`, **When** the Teacher activates QR mode, **Then** the backend issues a signed challenge token tied to `sessionId` and a 30-second time bucket, and the frontend refreshes the QR code automatically every 30 seconds with a visible countdown timer.
  - **Given** an enrolled Student with a bound, authenticated wallet scans the active QR code (or enters the 6-character rotating session pin shown alongside the QR for desktop demo accessibility) within the 30-second window (+5s grace), **When** they sign the check-in request, **Then** the backend validates enrollment, wallet ownership, and token freshness, marks the student as `PRESENT (QR Verified)` in the live session roster, and optionally issues an EIP-712 signature allowing direct on-chain `checkInWithTicket(sessionId, studentIdHash, deadline, serverSignature)`.
  - **Given** a Student submits a QR token that expired 40 seconds ago or belongs to a course they are not enrolled in, **When** `/api/attendance/qr-checkin` processes the request, **Then** it rejects the request with `400 Bad Request` (`QR_TOKEN_EXPIRED`) or `403 Forbidden` (`NOT_ENROLLED`).

### FR-021 & FR-022: Network, Wallet, and RPC Failure Handling
- **User Story:** As a user interacting with Web3, I want clear guidance and safe recovery when my wallet is on the wrong network, I reject a signature, my account lacks Sepolia ETH, or an RPC endpoint fails.
- **Acceptance Criteria:**
  - **Given** a user's MetaMask is connected to Ethereum Mainnet (`chainId: 1`), **When** they view any AttendChain screen, **Then** all transaction buttons are disabled and a persistent warning banner offers a "Switch to Sepolia / Hardhat" button invoking `wallet_switchEthereumChain`.
  - **Given** a user rejects a MetaMask signature or transaction prompt (`code: 4001 / ACTION_REJECTED`), **When** the error is caught, **Then** the UI clears the loading spinner, preserves all form inputs (such as selected attendance checkboxes), and displays a non-technical toast: `"Transaction signature was cancelled in your wallet. Your selections are saved."`
  - **Given** the primary Sepolia RPC returns a `429 Too Many Requests` or `503` timeout, **When** the provider wrapper executes a read call, **Then** it automatically retries against the configured fallback RPC URL before surfacing an `RPC Unavailable` status banner.

---

## 11. MVP Scope vs. Post-MVP Features

| Feature / Capability | MVP Scope (Target: Phases 0–5) | Post-MVP Backlog (Future Releases) |
| :--- | :--- | :--- |
| **Authentication** | MetaMask (EIP-1193) + EIP-4361 SIWE signed nonce authentication | WalletConnect v2 multi-wallet modal, institutional SSO (OAuth/SAML) linked to embedded/custodial wallets |
| **Role Management** | On-chain `AccessControl` (`DEFAULT_ADMIN_ROLE`, `TEACHER_ROLE`) + off-chain RBAC sync | Multi-signature (`Safe`) admin governance for role grants and contract upgrades |
| **Student Privacy** | Salted `bytes32` `studentIdHash` on-chain; synthetic PII stored only in Supabase | Zero-Knowledge Proof (zk-SNARK) anonymous credential check-in |
| **Attendance Capture** | Both **Teacher Manual/Batch Marking** (`recordBatchAttendance`) and **Dynamic Rotating QR Check-In** (staged + EIP-712 direct `checkInWithTicket`) | Geofenced mobile native app check-in with hardware attestation |
| **Corrections & Disputes** | On-chain `correctAttendance` with mandatory `reasonHash` + off-chain student dispute request workflow | Multi-party approval workflow (Teacher proposes correction $\rightarrow$ Head of Department co-signs on-chain) |
| **Indexing & Storage** | Supabase (PostgreSQL) storing off-chain profiles, QR nonces, and idempotent contract event sync | Dedicated Subgraph (The Graph) or Ponder indexer cluster |
| **Target Networks** | Local Hardhat (`31337`) and Ethereum Sepolia (`11155111`) | L2 deployment (Arbitrum Sepolia / Base Sepolia / Optimism) or permissioned institutional PoA chain |

---

## 12. Assumptions, Risks, Constraints, and Open Questions

### 12.1 Documented Assumptions (`[ASSUMPTION]`)
- **`[ASSUMPTION: A-01]` Unmarked Students in Closed Sessions:** When a lecture session is transitioned to `CLOSED`, any student enrolled in the course who was not explicitly marked `PRESENT`, `LATE`, or `EXCUSED` is treated as `ABSENT` (adds `+1` to denominator, `+0` to numerator). In the UI, the batch commit workflow pre-fills unmarked students as `ABSENT` so every enrolled student receives an explicit on-chain status in `recordBatchAttendance`.
- **`[ASSUMPTION: A-02]` Late Arrival Weighting:** A status of `LATE` counts as `+1` toward `Present sessions` in the attendance percentage numerator (representing physical attendance credit) while being tracked distinctly for punctuality reporting.
- **`[ASSUMPTION: A-03]` Excused Absence Weighting:** A status of `EXCUSED` is excluded from the denominator (`Eligible completed sessions`) rather than counted in the numerator, matching standard university academic regulations for approved medical/institutional leave.
- **`[ASSUMPTION: A-04]` Eligibility Threshold:** The default minimum attendance threshold for examination eligibility is `75.00%`, with a warning band between `65.00%` and `74.99%`.
- **`[ASSUMPTION: A-05]` Gasless-Friendly Hybrid QR Flow:** Because college students on Sepolia may not always hold testnet ETH during a live demo, scanning a dynamic QR code and signing a free off-chain message stages the student as `PRESENT (QR Verified)` for the teacher's single batch commit (`recordBatchAttendance`), while also providing an optional "Submit Directly On-Chain (`checkInWithTicket`)" button for students who do hold Sepolia ETH.
- **`[ASSUMPTION: A-06]` Desktop-Friendly QR Fallback Code:** Because a single developer demonstrating the MVP on a laptop may not always scan a screen with a second mobile device having MetaMask Mobile configured on Sepolia, the Dynamic QR display also renders a synchronized 6-character alphanumeric challenge token (and "Copy Check-In Link / Token" button) that a student tab can submit alongside their wallet signature.

### 12.2 Risks & Mitigations
1. **Risk R-01: Sepolia Testnet Congestion or Faucet Depletion During Live Demo.**
   - *Impact:* High — Slow block times or lack of Sepolia ETH could stall live demonstration of batch commits.
   - *Mitigation:* Maintain dual-network parity (`31337` Local Hardhat and `11155111` Sepolia) switchable via environment/network toggle, pre-fund dedicated demo Admin/Teacher/Student Sepolia wallets early in Phase 1, and use batch transactions (`recordBatchAttendance`) to minimize gas expenditure.
2. **Risk R-02: Off-Chain Database and On-Chain State Drift.**
   - *Impact:* Medium — If a user submits a transaction that confirms after they close their browser tab, Supabase might temporarily lag behind the contract state.
   - *Mitigation:* Implement an idempotent `/api/sync` indexer endpoint triggered on receipt confirmation and dashboard load (`queryFilter` from `last_synced_block`), and always query the contract directly on the `/verify` screen.
3. **Risk R-03: QR Code Relaying (Student inside classroom forwards QR to absent friend).**
   - *Impact:* Medium — Inherent limitation of non-biometric digital check-in.
   - *Mitigation:* Enforce 30-second QR rotation, single-use student check-in per session, live count display on the teacher's projector (e.g., `"24 checked in via QR vs. 22 heads in room"`), and one-click teacher override before final on-chain batch commit.

### 12.3 Constraints
- **C-01 (Timeline):** 12-day target for initial MVP completion by a single primary developer assisted by AI coding agents.
- **C-02 (Zero On-Chain PII):** Strict prohibition against placing real or synthetic student names, emails, or roll numbers on-chain.
- **C-03 (Synthetic Data Only):** All seed scripts, tests, and demo fixtures must use clearly labeled synthetic identities (`SYN-*`).

### 12.4 Open Questions (`[OPEN QUESTION]`)
- **`[OPEN QUESTION: OQ-01]` Institutional Late-Window Cutoff:** Should the Dynamic QR check-in automatically switch staged check-ins from `PRESENT` to `LATE` after the first 15 minutes of a lecture session, or remain configurable per lecture by the teacher? *(Defaulted to teacher-configurable toggle with 15-minute default until specified otherwise.)*
- **`[OPEN QUESTION: OQ-02]` Correction Time-Lock Window:** Should Teachers be restricted from calling `correctAttendance` more than 7 days after a session closes (requiring an Admin for older corrections), or can an assigned Teacher submit audited corrections throughout the active semester? *(Defaulted to assigned Teacher allowed throughout the active semester, with Admin able to correct at any time.)*
