# 06_TICKETS.md — Implementation Backlog

- **Purpose:** Define the complete, dependency-ordered backlog of 20 independently testable implementation tickets (`T-001` through `T-020`) mapped to Phases 0–5 and traced to every `FR-*`, `NFR-*`, and `TR-*` requirement.
- **Status:** Draft v1
- **Last updated:** 2026-10-13
- **Depends on:** `/docs/01_PRD.md`, `/docs/02_TRD.md`, `/docs/03_UIUX.md`, `/docs/04_ARCHITECTURE.md`, `/docs/05_SECURITY.md`

---

## Phase 0 — Setup and Walking Skeleton

### `T-001`: Project Scaffolding, Approved Dependency Lock, and Environment Validation
- **Type:** `chore`
- **Phase:** Phase 0
- **Linked Requirements:** `NFR-001`, `NFR-005`
- **User Story:** As a developer, I want a clean Next.js 15 + Hardhat 2.29 workspace with locked dependency versions, strict secret isolation, and a redacted structured logger so that all subsequent tickets build on a verified foundation.
- **Description & Scope:** Initialize the repository structure defined in `02_TRD.md` Section 11, install the exact verified dependencies from `02_TRD.md` Section 1, create `.gitignore` and `.env.example` (names only), implement `src/lib/validation/env.ts` using `zod`, and implement `src/lib/logger.ts` with automatic PII/secret redaction.
- **Acceptance Criteria:**
  - **Given** a fresh clone of the repository, **When** `npm ci` is executed, **Then** all approved dependencies install cleanly with zero manual lockfile edits.
  - **Given** `src/lib/logger.ts` is called with an object containing `privateKey`, `rollNumber`, or `studentName`, **When** the log entry is serialized, **Then** those fields are replaced with `"[REDACTED]"` (`NFR-001`).
  - **Given** a required server environment variable is missing or invalid, **When** `validateServerEnv()` runs, **Then** it throws a typed `EnvConfigurationError` listing the missing variable names without printing secret values.
- **Dependencies:** None
- **Explicit Out-of-Scope:** Smart contract logic, database tables, wallet connection UI.
- **Likely Files / Modules:** `package.json`, `.gitignore`, `.env.example`, `tsconfig.json`, `next.config.ts`, `hardhat.config.ts`, `src/lib/validation/env.ts`, `src/lib/logger.ts`, `tests/unit/env-logger.test.ts`
- **Test Plan:** Run `npx vitest run tests/unit/env-logger.test.ts` verifying environment validation and PII/secret redaction.
- **Size:** `M`
- **Status:** `DONE`

---

### `T-002`: ESLint, Prettier, TypeScript Strict Mode, Vitest, Playwright, and CI Pipeline
- **Type:** `chore`
- **Phase:** Phase 0
- **Linked Requirements:** `NFR-006`, `NFR-008`
- **User Story:** As a QA lead, I want automated linting, formatting, strict type-checking, coverage-gated test runners, and a GitHub Actions CI workflow so that no defective code can pass a ticket checkpoint.
- **Description & Scope:** Configure `eslint@9.39.5`, `prettier@3.9.10`, `tsconfig.json` (`"strict": true`, `"noUncheckedIndexedAccess": true`), `vitest.config.ts` with V8 coverage thresholds, `playwright.config.ts` with `@axe-core/playwright`, and `.github/workflows/ci.yml`.
- **Acceptance Criteria:**
  - **Given** the repository scripts, **When** `npm run lint`, `npm run format:check`, `npm run typecheck`, and `npm run test:unit` are run, **Then** all four commands exit with code `0`.
  - **Given** `.github/workflows/ci.yml`, **When** inspected, **Then** it defines stages for `lint-and-typecheck`, `contract-tests-and-gas`, `unit-and-integration-tests`, and `e2e-and-a11y`.
- **Dependencies:** `T-001`
- **Explicit Out-of-Scope:** Application business logic or smart contract implementation.
- **Likely Files / Modules:** `eslint.config.mjs`, `.prettierrc`, `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`
- **Test Plan:** Execute `npm run lint && npm run format:check && npm run typecheck && npm run test:unit`.
- **Size:** `S`
- **Status:** `DONE`

---

### `T-003`: Supabase PostgreSQL Schema Migration, Synthetic Seed Script, and Salted `studentIdHash` Utility
- **Type:** `feature`
- **Phase:** Phase 0
- **Linked Requirements:** `FR-005`, `NFR-001`, `NFR-007`, `TR-004`
- **User Story:** As an Architect, I want the complete PostgreSQL schema, synthetic-only roll number constraints, and deterministic salted `studentIdHash` utility so that student PII never touches the blockchain.
- **Description & Scope:** Create `supabase/migrations/0001_initial_schema.sql` implementing all tables, foreign keys, `UNIQUE` constraints, and `CHECK (synthetic_roll_no ~ '^SYN-[A-Z0-9-]+$')` from `04_ARCHITECTURE.md` Section 3. Implement `src/lib/attendance/identity.ts` (`computeStudentIdHash`, `computeCourseIdHash`, `computeReasonHash`) and `src/lib/db/client.ts` with synthetic seed fixtures (`supabase/seed.sql`).
- **Acceptance Criteria:**
  - **Given** `INSTITUTION_HASH_SALT` and roll number `"SYN-2026-042"`, **When** `computeStudentIdHash` is called repeatedly, **Then** it returns the identical 66-character `0x`-prefixed `bytes32` keccak256 hash and rejects any roll number not matching `^SYN-[A-Z0-9-]+$` with `NonSyntheticIdentityError`.
  - **Given** `0001_initial_schema.sql`, **When** applied to PostgreSQL, **Then** all tables (`users`, `auth_nonces`, `role_assignments`, `students`, `courses`, `course_enrollments`, `lecture_sessions`, `qr_challenges`, `attendance_records`, `attendance_corrections`, `blockchain_transactions`, `indexed_contract_events`) and indexes are created without error.
- **Dependencies:** `T-001`, `T-002`
- **Explicit Out-of-Scope:** Live smart contract calls or UI forms.
- **Likely Files / Modules:** `supabase/migrations/0001_initial_schema.sql`, `supabase/seed.sql`, `src/lib/attendance/identity.ts`, `src/lib/db/client.ts`, `tests/unit/identity.test.ts`
- **Test Plan:** Unit test `tests/unit/identity.test.ts` (`100%` branch coverage on hash derivation, normalization, and non-synthetic rejection).
- **Size:** `M`
- **Status:** `DONE`

---

### `T-004`: Design Tokens, Accessible UI Primitives, App Shell, and Landing Page (`Screen 1`)
- **Type:** `feature`
- **Phase:** Phase 0
- **Linked Requirements:** `FR-001`, `FR-014`, `NFR-006`
- **User Story:** As a user visiting AttendChain, I want an accessible, responsive Landing Page and navigation shell that clearly explains the platform's cryptographic provenance and privacy guarantees.
- **Description & Scope:** Configure Tailwind design tokens from `03_UIUX.md` Section 2, build core accessible UI primitives (`Button`, `Badge`, `Card`, `Modal`, `StatusBadge`), and implement `Screen 1: Landing Page` (`src/app/(public)/page.tsx`) with links to `/auth` and `/verify` and `prefers-reduced-motion` support.
- **Acceptance Criteria:**
  - **Given** a user visits `/`, **When** the page renders on mobile (`375px`) and desktop (`1280px`), **Then** it displays the AttendChain hero, evidentiary boundary notice, feature cards, and navigation links to `/auth` and `/verify` with `0` axe-core accessibility violations.
  - **Given** a keyboard user presses `Tab` across `/`, **Then** every interactive control shows a visible `2px` `#4F46E5` focus ring.
- **Dependencies:** `T-002`
- **Explicit Out-of-Scope:** MetaMask signing logic (implemented in Phase 2).
- **Likely Files / Modules:** `src/app/globals.css`, `src/components/ui/*`, `src/app/(public)/page.tsx`, `tests/e2e/landing.spec.ts`
- **Test Plan:** Build check (`npm run build`) + Playwright E2E and `@axe-core/playwright` scan on `/`.
- **Size:** `M`
- **Status:** `DONE`

---

## Phase 1 — Smart-Contract Foundation

### `T-005`: `AttendChainRegistry.sol` Core Contract — Roles, Courses, Batch Enrollment, and Session Lifecycle
- **Type:** `feature`
- **Phase:** Phase 1
- **Linked Requirements:** `FR-003`, `FR-004`, `FR-007`, `FR-008`, `FR-009`, `TR-003`, `TR-005`, `TR-006`
- **User Story:** As an Admin or Teacher, I want the smart contract to enforce role-based access control, course ownership, pseudonymous batch student enrollment, and lecture session state transitions (`OPEN`, `CLOSED`, `CANCELLED`).
- **Description & Scope:** Implement the first half of `blockchain/contracts/AttendChainRegistry.sol` (Solidity `0.8.28`, OpenZeppelin `AccessControl` & `EIP712` `v5.6.1`): role management (`grantTeacherRole`, `revokeTeacherRole`, `setQrTicketSigner`), course management (`createCourse`, `updateCourseTeacher`, `enrollStudentsBatch`), and session lifecycle (`openSession`, `closeSession`, `cancelSession`) with all custom errors and events from `04_ARCHITECTURE.md` Section 4.
- **Acceptance Criteria:**
  - **Given** a caller without `DEFAULT_ADMIN_ROLE`, **When** they call `grantTeacherRole`, `createCourse`, or `enrollStudentsBatch`, **Then** the transaction reverts with `AccessControlUnauthorizedAccount`.
  - **Given** a course assigned to `teacherA`, **When** `teacherB` (who holds `TEACHER_ROLE` but is not assigned to the course) calls `openSession`, **Then** the transaction reverts with `UnauthorizedCourseTeacher`.
  - **Given** an `OPEN` session, **When** the assigned teacher calls `closeSession` or `cancelSession`, **Then** the session status transitions accordingly and emits `SessionClosed` or `SessionCancelled`.
- **Dependencies:** `T-001`, `T-003`
- **Explicit Out-of-Scope:** Attendance recording functions (`recordBatchAttendance`, `checkInWithTicket`, `correctAttendance` — covered in `T-006`).
- **Likely Files / Modules:** `blockchain/contracts/AttendChainRegistry.sol`
- **Test Plan:** Compile contract (`npm run contracts:compile`) and verify zero compiler warnings and TypeChain generation.
- **Size:** `M`
- **Initial Status:** `DONE`

---

### `T-006`: `AttendChainRegistry.sol` Attendance Engine — Packed Batch Marking, EIP-712 QR Ticket Check-In, and Audited Corrections
- **Type:** `feature`
- **Phase:** Phase 1
- **Linked Requirements:** `FR-010`, `FR-011`, `FR-015`, `FR-016`, `FR-019`, `NFR-001`, `NFR-004`, `TR-007`, `TR-008`, `TR-009`
- **User Story:** As a Teacher or Student, I want to record attendance via gas-optimized batch transactions or EIP-712 QR tickets during `OPEN` sessions, prevent duplicates, and execute auditable corrections on `CLOSED` sessions.
- **Description & Scope:** Complete `blockchain/contracts/AttendChainRegistry.sol` by implementing the 32-byte single-slot packed `AttendanceRecord` struct (`DEC-03`), `recordBatchAttendance`, `checkInWithTicket` (EIP-712 `QrCheckInTicket` verification), `correctAttendance`, and view functions (`getAttendanceRecord`, `getSession`, `isStudentEnrolled`).
- **Acceptance Criteria:**
  - **Given** an `OPEN` session with 50 enrolled `studentIdHash` commitments, **When** the assigned teacher calls `recordBatchAttendance(sessionId, studentIdHashes, statuses, true)`, **Then** all 50 records are stored in single-slot structs, `AttendanceRecorded` and `SessionClosed` events are emitted, and gas used is $\le 1,500,000\text{ gas}$ (`NFR-004`).
  - **Given** a student whose attendance is already recorded for `sessionId`, **When** `recordBatchAttendance` or `checkInWithTicket` is called again for that `(sessionId, studentIdHash)`, **Then** it reverts with `AttendanceAlreadyRecorded`.
  - **Given** a `CLOSED` session where `studentIdHash` has status `ABSENT`, **When** the assigned teacher calls `correctAttendance(sessionId, studentIdHash, EXCUSED, reasonHash)`, **Then** `status` updates to `EXCUSED`, `amendmentCount` increments by `1`, and `AttendanceCorrected` is emitted with `previousStatus = ABSENT` and `newStatus = EXCUSED`.
- **Dependencies:** `T-005`
- **Explicit Out-of-Scope:** Frontend UI or API endpoints.
- **Likely Files / Modules:** `blockchain/contracts/AttendChainRegistry.sol`
- **Test Plan:** Verified in `T-007` contract test suite.
- **Size:** `M`
- **Initial Status:** `DONE`

---

### `T-007`: Comprehensive Smart Contract Unit, Security, Gas Budget, and Zero-PII Calldata Test Suite + Local Deployment Script
- **Type:** `test`
- **Phase:** Phase 1
- **Linked Requirements:** `FR-003`–`FR-011`, `FR-015`, `FR-016`, `FR-019`, `NFR-001`, `NFR-004`, `NFR-008`, `TR-003`–`TR-009`
- **User Story:** As a Security Engineer, I want an exhaustive Hardhat test suite verifying $\ge 90\%$ branch coverage, gas budgets, EIP-712 replay prevention, and zero PII in calldata, plus a deterministic local deployment script.
- **Description & Scope:** Write `blockchain/test/AttendChainRegistry.test.ts` covering all positive and negative paths, custom error reverts, 50-student batch gas assertions, EIP-712 signature expiry/forgery tests, and calldata PII inspection. Create `blockchain/ignition/modules/AttendChainRegistry.ts` and `blockchain/scripts/deploy-and-seed.ts`.
- **Acceptance Criteria:**
  - **Given** `AttendChainRegistry.test.ts`, **When** `npm run test:contracts` and `npm run test:contracts:coverage` run, **Then** 100% of tests pass with $\ge 95\%$ statement coverage and $\ge 90\%$ branch coverage (`NFR-008`).
  - **Given** the gas reporter output for a 50-student `recordBatchAttendance` call, **When** inspected, **Then** gas consumption is $\le 1,500,000\text{ gas}$ (`NFR-004`).
  - **Given** a running local Hardhat node, **When** `npm run contracts:deploy:local` executes, **Then** the contract deploys cleanly and exports ABI + deployment address to `src/lib/blockchain/`.
- **Dependencies:** `T-006`
- **Explicit Out-of-Scope:** Next.js UI screens.
- **Likely Files / Modules:** `blockchain/test/AttendChainRegistry.test.ts`, `blockchain/ignition/modules/AttendChainRegistry.ts`, `blockchain/scripts/deploy-and-seed.ts`, `src/lib/blockchain/deployments.json`
- **Test Plan:** Run `npx hardhat test` and `npx hardhat coverage`.
- **Size:** `M`
- **Initial Status:** `DONE`
- **Status:** `DONE`

---

## Phase 2 — Wallet, Authentication, and Blockchain Integration

### `T-008`: EIP-1193 Wallet Provider Adapter, Network Detection, One-Click Network Switcher, and RPC Failover Wrapper
- **Type:** `feature`
- **Phase:** Phase 2
- **Linked Requirements:** `FR-001`, `FR-021`, `FR-022`, `NFR-002`, `NFR-003`, `TR-001`, `TR-013`
- **User Story:** As a Web3 user, I want reliable wallet connection, automatic wrong-network detection with 1-click switching to Sepolia/Hardhat, and automatic RPC failover when a primary RPC node is rate-limited.
- **Description & Scope:** Implement `src/lib/blockchain/provider.ts` (primary + fallback RPC retry wrapper with latency tracking), `src/lib/blockchain/wallet.tsx` (React context managing EIP-1193 connection, `accountsChanged`, `chainChanged`, `wallet_switchEthereumChain` / `wallet_addEthereumChain`), and `src/components/web3/NetworkBanner.tsx` + `WalletStatusPill.tsx`.
- **Acceptance Criteria:**
  - **Given** the primary RPC endpoint returns HTTP `429` or `503`, **When** `executeWithFailover()` performs a contract read, **Then** it automatically retries on the fallback RPC URL and succeeds within budget (`TR-013`).
  - **Given** MetaMask is connected to Chain ID `1` (Mainnet), **When** `NetworkBanner` renders, **Then** it displays the unsupported network warning, disables write actions, and triggers `wallet_switchEthereumChain` when the user clicks "Switch Network" (`FR-021`).
- **Dependencies:** `T-004`, `T-007`
- **Explicit Out-of-Scope:** SIWE backend session cookies (implemented in `T-009`).
- **Likely Files / Modules:** `src/lib/blockchain/provider.ts`, `src/lib/blockchain/wallet.tsx`, `src/components/web3/NetworkBanner.tsx`, `src/components/web3/WalletStatusPill.tsx`, `tests/unit/rpc-failover.test.ts`
- **Test Plan:** Unit tests for RPC failover (`tests/unit/rpc-failover.test.ts`) and wallet state transitions.
- **Size:** `M`
- **Initial Status:** `DONE`
- **Status:** `DONE`

---

### `T-009`: EIP-4361 (SIWE) Nonce & Signature Verification API, `HttpOnly` JWT Session Middleware, and `/auth` Screen (`Screen 2`)
- **Type:** `security`
- **Phase:** Phase 2
- **Linked Requirements:** `FR-002`, `FR-004`, `FR-006`, `NFR-005`, `TR-002`
- **User Story:** As a user, I want to authenticate my connected wallet by signing a single-use SIWE challenge so that my role session is cryptographically verified and protected against address spoofing.
- **Description & Scope:** Implement `POST /api/auth/nonce`, `POST /api/auth/verify` (with optional `studentClaimCode` wallet binding), `POST /api/auth/logout`, JWT signing/verification via `jose` (`src/lib/auth/session.ts`), Next.js route protection (`src/middleware.ts`), and `Screen 2: Wallet Connection & Authentication` (`src/app/(public)/auth/page.tsx`).
- **Acceptance Criteria:**
  - **Given** an unauthenticated user or a user who has only connected MetaMask without signing SIWE, **When** they request `/admin`, `/teacher`, `/student`, or any protected `/api/*` endpoint, **Then** access is blocked (`401 Unauthorized` / redirect to `/auth`).
  - **Given** a valid nonce from `/api/auth/nonce`, **When** signed by the wallet and submitted to `/api/auth/verify`, **Then** the server verifies the ECDSA signature, marks the nonce consumed, sets the `HttpOnly` `attendchain_session` cookie, and routes the user to their role dashboard.
  - **Given** a replayed or expired (>5m) nonce signature, **When** submitted to `/api/auth/verify`, **Then** the server returns `401 Unauthorized` (`NONCE_ALREADY_USED` / `NONCE_EXPIRED`).
- **Dependencies:** `T-003`, `T-008`
- **Explicit Out-of-Scope:** Course or attendance creation forms.
- **Likely Files / Modules:** `src/lib/auth/session.ts`, `src/lib/auth/siwe.ts`, `src/app/api/auth/nonce/route.ts`, `src/app/api/auth/verify/route.ts`, `src/app/api/auth/logout/route.ts`, `src/middleware.ts`, `src/app/(public)/auth/page.tsx`, `tests/integration/auth-siwe.test.ts`
- **Test Plan:** Integration security tests in `tests/integration/auth-siwe.test.ts` covering valid login, student claim-code wallet binding, replay attack, expired nonce, and forged signature.
- **Size:** `M`
- **Initial Status:** `DONE`
- **Status:** `DONE`

---

### `T-010`: Transaction Lifecycle Manager and Settings/Network Diagnostics (`Screen 14`)
- **Type:** `feature`
- **Phase:** Phase 2
- **Linked Requirements:** `FR-021`, `FR-022`, `NFR-003`, `TR-001`, `TR-013`
- **User Story:** As a user submitting blockchain transactions, I want real-time progress feedback (`Awaiting Signature -> Pending -> Confirmed -> Reverted`), `sessionStorage` recovery across page reloads, decoded custom Solidity error messages, and a `/settings` diagnostics screen.
- **Description & Scope:** Implement `src/lib/blockchain/tx-manager.ts` (handling `ACTION_REJECTED`, `INSUFFICIENT_FUNDS`, `TRANSACTION_REPLACED`, custom error decoding via ABI, and `sessionStorage` pending tx persistence), `src/components/web3/TxLifecycleBanner.tsx`, and `Screen 14: Settings & Network Information` (`src/app/(dashboard)/settings/page.tsx`).
- **Acceptance Criteria:**
  - **Given** a transaction is broadcasted (`txHash` received) and the user refreshes the browser tab before block confirmation, **When** the page reloads, **Then** `TxLifecycleBanner` automatically resumes polling `txHash` from `sessionStorage` until confirmed (`FR-022`).
  - **Given** a contract call reverts with `AttendanceAlreadyRecorded(15, 0x3e9b...)`, **When** `decodeContractError` parses the revert data, **Then** it returns a human-readable message explaining that attendance was already recorded for that student in Session #15.
- **Dependencies:** `T-008`, `T-009`
- **Explicit Out-of-Scope:** Attendance batch UI (implemented in Phase 3).
- **Likely Files / Modules:** `src/lib/blockchain/tx-manager.ts`, `src/components/web3/TxLifecycleBanner.tsx`, `src/app/(dashboard)/settings/page.tsx`, `tests/unit/tx-manager.test.ts`
- **Test Plan:** Unit tests for error decoding, `TRANSACTION_REPLACED`, and `sessionStorage` persistence in `tests/unit/tx-manager.test.ts`.
- **Size:** `M`
- **Initial Status:** `DONE`
- **Status:** `DONE`

---

### `T-011`: Idempotent Blockchain Event Sync Service (`/api/sync`) and Receipt Indexer
- **Type:** `feature`
- **Phase:** Phase 2
- **Linked Requirements:** `FR-012`, `FR-015`, `NFR-002`, `NFR-007`, `TR-011`
- **User Story:** As a backend system, I want to synchronize `AttendChainRegistry` events into Supabase idempotently so that dashboards load in under 300ms without ever creating duplicate records.
- **Description & Scope:** Implement `src/lib/blockchain/sync.ts` and `POST /api/sync` supporting both targeted transaction receipt indexing (`txHash`) and bounded block-range log synchronization (`SessionOpened`, `SessionClosed`, `SessionCancelled`, `AttendanceRecorded`, `AttendanceCorrected`), deduplicated by `(chain_id, tx_hash, log_index)`.
- **Acceptance Criteria:**
  - **Given** a confirmed `recordBatchAttendance` or `correctAttendance` transaction on local Hardhat, **When** `POST /api/sync` is called 3 consecutive times with the same `txHash` or block range, **Then** Supabase contains the exact updated attendance records with `0` duplicate rows (`NFR-007`).
- **Dependencies:** `T-003`, `T-007`, `T-008`
- **Explicit Out-of-Scope:** Frontend attendance tables.
- **Likely Files / Modules:** `src/lib/blockchain/sync.ts`, `src/app/api/sync/route.ts`, `tests/integration/event-sync.test.ts`
- **Test Plan:** Integration test `tests/integration/event-sync.test.ts` verifying idempotent multi-run ingestion.
- **Size:** `M`
- **Initial Status:** `DONE`
- **Status:** `DONE`

---

## Phase 3 — Core Academic & Attendance Workflows

### `T-012`: Admin Role Management (`/admin/roles`), Student Registration (`/admin/students`), and Course Management (`/admin/courses`) (`Screens 6, 7, 8`)
- **Type:** `feature`
- **Phase:** Phase 3
- **Linked Requirements:** `FR-003`, `FR-004`, `FR-005`, `FR-006`, `FR-007`, `NFR-001`, `TR-003`, `TR-004`, `TR-005`
- **User Story:** As an Admin, I want to grant/revoke Teacher roles, register synthetic students with salted `studentIdHash` commitments, create courses, and batch-enroll student cohorts on-chain.
- **Description & Scope:** Implement API routes `/api/roles`, `/api/students`, and `/api/courses` with `ADMIN` RBAC guards and Zod validation, plus `Screen 6 (/admin/students)`, `Screen 7 (/admin/roles)`, and `Screen 8 (/admin/courses)`.
- **Acceptance Criteria:**
  - **Given** an authenticated Admin on `/admin/students`, **When** they register `"SYN-2026-042"`, **Then** the UI previews the `bytes32 studentIdHash`, saves PII only in Supabase, and allows batch on-chain enrollment into `CS701` via `enrollStudentsBatch` (`FR-005`, `FR-007`).
  - **Given** an Admin enters a non-synthetic roll number (e.g., `"21BCE1042"` without `SYN-`), **When** submitted, **Then** both client validation and `POST /api/students` reject it with `400 NON_SYNTHETIC_ROLL_REJECTED`.
- **Dependencies:** `T-009`, `T-010`, `T-011`
- **Explicit Out-of-Scope:** Teacher session opening (covered in `T-014`).
- **Likely Files / Modules:** `src/app/api/roles/route.ts`, `src/app/api/students/route.ts`, `src/app/api/courses/route.ts`, `src/app/(dashboard)/admin/roles/page.tsx`, `src/app/(dashboard)/admin/students/page.tsx`, `src/app/(dashboard)/admin/courses/page.tsx`, `tests/integration/admin-apis.test.ts`
- **Test Plan:** Integration tests in `tests/integration/admin-apis.test.ts` testing RBAC (`403` for non-admin), synthetic roll enforcement, and role/course creation.
- **Size:** `L`
- **Initial Status:** `DONE`
- **Status:** `DONE`

---

### `T-013`: Pure Attendance Percentage Calculator, Admin Dashboard (`Screen 3`), and Shortage CSV Reporting
- **Type:** `feature`
- **Phase:** Phase 3
- **Linked Requirements:** `FR-013`, `FR-020`, `NFR-002`, `NFR-008`, `TR-010`
- **User Story:** As an Admin or Faculty member, I want attendance percentages calculated using the exact institutional formula and displayed on the Admin Dashboard with shortage (`<75%`) alerts and CSV export.
- **Description & Scope:** Implement the pure calculation engine `src/lib/attendance/calculator.ts` enforcing `01_PRD.md` Section 7 (`PRESENT`=+1/+1, `LATE`=+1/+1, `ABSENT`=+0/+1, `EXCUSED`=+0/+0, `NONE` in `CLOSED`=+0/+1, `OPEN`/`CANCELLED` excluded, 2-decimal half-up rounding, `0` denominator handling), and build `Screen 3: Admin Dashboard` (`src/app/(dashboard)/admin/page.tsx`) with KPI cards, Shortage Alert Table, and CSV export (`FR-020`).
- **Acceptance Criteria:**
  - **Given** any combination of `PRESENT`, `LATE`, `ABSENT`, `EXCUSED`, `NONE`, `OPEN`, and `CANCELLED` sessions, **When** `calculateAttendanceMetrics` executes, **Then** it matches the exact formula in `01_PRD.md` Section 7 to 2 decimal places (`100%` unit test coverage).
  - **Given** an Admin clicks "Export Shortage CSV" on `/admin`, **Then** a CSV file downloads containing course code, synthetic roll number, `studentIdHash`, present count, eligible count, percentage, and latest verification `txHash`.
- **Dependencies:** `T-012`
- **Explicit Out-of-Scope:** Student dispute submission UI.
- **Likely Files / Modules:** `src/lib/attendance/calculator.ts`, `src/components/attendance/PercentageGaugeCard.tsx`, `src/app/(dashboard)/admin/page.tsx`, `tests/unit/calculator.test.ts`
- **Test Plan:** Parameterized unit tests in `tests/unit/calculator.test.ts` covering all status permutations and edge cases.
- **Size:** `M`
- **Initial Status:** `DONE`
- **Status:** `DONE`

---

### `T-014`: Teacher Dashboard (`Screen 4`) and On-Chain Lecture Session Creation (`Screen 9`)
- **Type:** `feature`
- **Phase:** Phase 3
- **Linked Requirements:** `FR-008`, `FR-009`, `TR-006`
- **User Story:** As a Teacher, I want to view my assigned courses on `/teacher` and open a new lecture session on-chain via `/teacher/lectures/new` so that I can begin taking classroom attendance.
- **Description & Scope:** Implement `GET/POST /api/sessions`, `Screen 4: Teacher Dashboard` (`src/app/(dashboard)/teacher/page.tsx`), and `Screen 9: Lecture Creation` (`src/app/(dashboard)/teacher/lectures/new/page.tsx`) invoking `openSession(courseIdHash, metadataHash, startTime, endTime)`.
- **Acceptance Criteria:**
  - **Given** an authenticated Teacher assigned to `CS701`, **When** they submit the lecture creation form on `/teacher/lectures/new` and confirm the MetaMask transaction, **Then** `SessionOpened` is emitted on-chain, indexed in Supabase, and the browser navigates to `/teacher/attendance/[sessionId]`.
  - **Given** a Teacher not assigned to `CS702`, **When** they attempt to create a session for `CS702` via API or contract, **Then** the request is rejected (`403 NOT_COURSE_TEACHER` / `UnauthorizedCourseTeacher`).
- **Dependencies:** `T-012`, `T-013`
- **Explicit Out-of-Scope:** QR rotation and roster marking (covered in `T-015`).
- **Likely Files / Modules:** `src/app/api/sessions/route.ts`, `src/app/(dashboard)/teacher/page.tsx`, `src/app/(dashboard)/teacher/lectures/new/page.tsx`, `tests/integration/sessions-api.test.ts`
- **Test Plan:** Integration tests for `/api/sessions` and session creation state transitions.
- **Size:** `M`
- **Initial Status:** `DONE`
- **Status:** `DONE`

---

### `T-015`: Teacher Attendance Marking Workspace, 30s Rotating Dynamic QR Projector, and Batch Commit (`Screen 10`)
- **Type:** `feature`
- **Phase:** Phase 3
- **Linked Requirements:** `FR-009`, `FR-010`, `FR-011`, `FR-018`, `FR-019`, `NFR-004`, `TR-007`, `TR-008`
- **User Story:** As a Teacher, I want to project a 30-second rotating QR code (and 6-character PIN), see live verified student check-ins on my roster, manually mark or override any student's status, and commit the entire session in a single batch transaction.
- **Description & Scope:** Implement `POST /api/sessions/[sessionId]/qr` (30s rotating challenge token + 6-char PIN), `POST /api/attendance/qr-checkin` (verifying student wallet signature, enrollment, and 35s TTL, plus issuing EIP-712 ticket), `GET/POST /api/attendance`, and `Screen 10: Attendance Marking` (`src/app/(dashboard)/teacher/attendance/[sessionId]/page.tsx`) with `DynamicQrProjector` and keyboard-accessible `AttendanceStatusSelector`.
- **Acceptance Criteria:**
  - **Given** an `OPEN` session on `/teacher/attendance/[sessionId]`, **When** the Teacher enables QR mode, **Then** a new cryptographic QR code and 6-character PIN are generated every 30 seconds (`FR-018`).
  - **Given** a Teacher clicks "Commit Batch Attendance & Close Session", **When** they confirm `recordBatchAttendance` in MetaMask, **Then** all enrolled students' statuses (pre-filling any remaining unmarked students as `ABSENT` per `[ASSUMPTION: A-01]`) are committed on-chain in 1 transaction and the session transitions to `CLOSED`.
- **Dependencies:** `T-014`
- **Explicit Out-of-Scope:** Post-closure corrections (covered in `T-017`).
- **Likely Files / Modules:** `src/lib/attendance/qr-token.ts`, `src/app/api/sessions/[sessionId]/qr/route.ts`, `src/app/api/attendance/qr-checkin/route.ts`, `src/app/api/attendance/route.ts`, `src/components/attendance/DynamicQrProjector.tsx`, `src/components/attendance/RosterTable.tsx`, `src/app/(dashboard)/teacher/attendance/[sessionId]/page.tsx`, `tests/unit/qr-token.test.ts`
- **Test Plan:** Unit and integration tests for 30s QR token generation, 35s expiry boundary, replay prevention, and batch attendance commit indexing.
- **Size:** `L`
- **Initial Status:** `TODO`
- **Status:** `DONE`

---

### `T-016`: Student Dashboard with Live QR/PIN Check-In (`Screen 5`) and Student Attendance History (`Screen 11`)
- **Type:** `feature`
- **Phase:** Phase 3
- **Linked Requirements:** `FR-012`, `FR-013`, `FR-018`, `FR-019`, `TR-008`, `TR-010`
- **User Story:** As a Student, I want to check in to an active lecture using the rotating QR code or 6-character PIN, monitor my subject-wise attendance percentage against the 75% threshold, and inspect my chronological session history with transaction hashes.
- **Description & Scope:** Implement `Screen 5: Student Dashboard` (`src/app/(dashboard)/student/page.tsx`) featuring the Live Lecture Check-In card (supporting both free gasless signed staging and optional EIP-712 direct `checkInWithTicket` on-chain submission), subject-wise `PercentageGaugeCard` grid, and `Screen 11: Student Attendance History` (`src/app/(dashboard)/student/history/page.tsx`) with course/status/amended filters and links to `/verify` and `/corrections`.
- **Acceptance Criteria:**
  - **Given** an enrolled Student on `/student` during an `OPEN` lecture with active QR mode, **When** they scan the QR or enter the 6-character PIN and sign the check-in message in MetaMask, **Then** their check-in is verified and staged as `PRESENT (QR Verified)` (and optionally executable on-chain via `checkInWithTicket`).
  - **Given** an authenticated Student on `/student/history`, **When** they filter by course and status, **Then** only their own `studentIdHash` records are returned and displayed with accurate percentage metrics and clickable `/verify` links.
- **Dependencies:** `T-013`, `T-015`
- **Explicit Out-of-Scope:** Teacher correction execution (covered in `T-017`).
- **Likely Files / Modules:** `src/app/(dashboard)/student/page.tsx`, `src/app/(dashboard)/student/history/page.tsx`, `tests/integration/student-checkin.test.ts`
- **Test Plan:** Integration tests verifying student check-in, row-level isolation (Student A cannot read Student B's records), and history filtering.
- **Size:** `M`
- **Initial Status:** `TODO`
- **Status:** `DONE`

---

## Phase 4 — Audit, Corrections, Verification, and Security Hardening

### `T-017`: Auditable Attendance Corrections (`correctAttendance`) and Student Dispute Workflow (`Screen 13`)
- **Type:** `feature`
- **Phase:** Phase 4
- **Linked Requirements:** `FR-015`, `FR-016`, `FR-017`, `TR-009`
- **User Story:** As a Student, Teacher, or Admin, I want students to be able to submit dispute requests for closed sessions and Teachers/Admins to execute auditable on-chain `correctAttendance` transactions with a mandatory reason and `reasonHash` while preserving original event history.
- **Description & Scope:** Implement `GET/POST /api/attendance/corrections` and `Screen 13: Correction & Dispute History` (`src/app/(dashboard)/corrections/page.tsx`) with the Student dispute submission modal, Teacher/Admin pending dispute approval queue, direct `correctAttendance(sessionId, studentIdHash, newStatus, reasonHash)` execution panel, and chronological before/after audit log table.
- **Acceptance Criteria:**
  - **Given** a `CLOSED` session where a student was marked `ABSENT`, **When** the assigned Teacher submits a correction to `EXCUSED` with reason `"Approved Medical Certificate #MC-104"` ($\ge 10$ chars), **Then** `correctAttendance` executes on-chain with `reasonHash = keccak256(reasonText)`, updates the student's attendance percentage denominator, and displays both the original `ABSENT` event and the `EXCUSED` amendment in `/corrections`.
  - **Given** a Teacher attempts to submit a correction with $<10$ characters or an identical status, **When** validated, **Then** both the form and contract reject the submission.
- **Dependencies:** `T-015`, `T-016`
- **Explicit Out-of-Scope:** Deletion of historical events (prohibited).
- **Likely Files / Modules:** `src/app/api/attendance/corrections/route.ts`, `src/app/(dashboard)/corrections/page.tsx`, `tests/integration/corrections.test.ts`
- **Test Plan:** Integration tests in `tests/integration/corrections.test.ts` verifying student dispute creation, teacher on-chain correction indexing, and percentage recalculation after correction.
- **Size:** `M`
- **Initial Status:** `TODO`
- **Status:** `DONE`

---

### `T-018`: Independent Blockchain Transaction Verification Service & UI (`Screen 12`)
- **Type:** `feature`
- **Phase:** Phase 4
- **Linked Requirements:** `FR-014`, `FR-015`, `TR-012`
- **User Story:** As a Student or external Evaluator, I want to independently verify any attendance record on `/verify` by querying the blockchain RPC directly and comparing on-chain storage and event logs against the off-chain database.
- **Description & Scope:** Implement `src/lib/blockchain/verify.ts`, `GET /api/verify`, and `Screen 12: Transaction Verification` (`src/app/(public)/verify/page.tsx`) with `VerificationDiffCard` showing side-by-side comparison (`Off-Chain DB` vs `Live Blockchain RPC`), decoded `AttendanceRecorded` / `AttendanceCorrected` event timeline, and Sepolia Etherscan deep links.
- **Acceptance Criteria:**
  - **Given** a valid `sessionId`, `studentIdHash`, and `txHash`, **When** `/verify` queries the RPC and Supabase, **Then** it renders `CRYPTOGRAPHICALLY VERIFIED` when the on-chain status, timestamp, and amendment count match the database.
  - **Given** a simulated tampering attack where an off-chain database row's `on_chain_status` is manually altered in PostgreSQL without an on-chain transaction, **When** `/verify` is queried for that record, **Then** it returns `matchStatus: "MISMATCH"` and renders a high-visibility red `DATA INTEGRITY MISMATCH DETECTED` alert (`FR-014`, `TR-012`).
- **Dependencies:** `T-011`, `T-017`
- **Explicit Out-of-Scope:** Modifying contract state from `/verify` (strictly read-only).
- **Likely Files / Modules:** `src/lib/blockchain/verify.ts`, `src/app/api/verify/route.ts`, `src/components/attendance/VerificationDiffCard.tsx`, `src/app/(public)/verify/page.tsx`, `tests/integration/verify-tamper.test.ts`
- **Test Plan:** Integration test `tests/integration/verify-tamper.test.ts` testing both clean verification and simulated database tampering detection.
- **Size:** `M`
- **Initial Status:** `TODO`
- **Status:** `DONE`

---

### `T-019`: Security Hardening, Rate Limiting, CSP Headers, and Automated WCAG 2.2 AA Accessibility Audit
- **Type:** `security`
- **Phase:** Phase 4
- **Linked Requirements:** `FR-004`, `NFR-001`, `NFR-005`, `NFR-006`, `NFR-008`
- **User Story:** As a Security & QA Lead, I want rate limiting, strict HTTP security headers, RBAC penetration tests across all API routes, and automated WCAG 2.2 AA accessibility scans across all 14 screens.
- **Description & Scope:** Implement sliding-window rate limiting (`src/lib/auth/rate-limit.ts`) on auth and QR endpoints, configure CSP and security headers in `next.config.ts`, write API authorization matrix tests (`tests/integration/security-rbac.test.ts`), and run `@axe-core/playwright` accessibility checks across all 14 routes (`tests/e2e/accessibility.spec.ts`).
- **Acceptance Criteria:**
  - **Given** all write API endpoints (`/api/roles`, `/api/students`, `/api/courses`, `/api/sessions`, `/api/attendance`, `/api/attendance/corrections`), **When** called without a session cookie or with an unauthorized role cookie, **Then** 100% return `401` or `403` (`NFR-005`).
  - **Given** all 14 screens in `03_UIUX.md`, **When** scanned with `@axe-core/playwright`, **Then** `0` critical or serious WCAG 2.2 AA violations are reported (`NFR-006`).
- **Dependencies:** `T-017`, `T-018`
- **Explicit Out-of-Scope:** New product features.
- **Likely Files / Modules:** `src/lib/auth/rate-limit.ts`, `next.config.ts`, `tests/integration/security-rbac.test.ts`, `tests/e2e/accessibility.spec.ts`
- **Test Plan:** Run `npx vitest run tests/integration/security-rbac.test.ts` and `npx playwright test tests/e2e/accessibility.spec.ts`.
- **Size:** `M`
- **Initial Status:** `TODO`
- **Status:** `DONE`

---

## Phase 5 — Final MVP, Sepolia Deployment, and Demonstration

### `T-020`: End-to-End Playwright Journey Suite, Ethereum Sepolia Deployment & Verification Workflow, and Final Demo Runbook
- **Type:** `test`
- **Phase:** Phase 5
- **Linked Requirements:** `FR-001`–`FR-022`, `NFR-001`–`NFR-008`, `TR-001`–`TR-013`
- **User Story:** As the Product Owner presenting AttendChain for academic evaluation, I want full end-to-end automated tests for all 4 user journeys, verified Sepolia deployment scripts, and a step-by-step live demonstration runbook.
- **Description & Scope:** Write `tests/e2e/journeys.spec.ts` automating Journeys 1–4 against the local Hardhat node, finalize `blockchain/scripts/verify-sepolia.ts` for Ethereum Sepolia (`11155111`) deployment and Etherscan verification, verify all coverage thresholds ($\ge 90\%$), and document the live evaluation demo guide and known limitations in `README.md`.
- **Acceptance Criteria:**
  - **Given** the complete test suite (`npm run lint`, `npm run typecheck`, `npm run test:contracts:coverage`, `npm run test:coverage`, `npm run test:e2e`), **When** executed in sequence, **Then** every suite passes and meets coverage targets (`NFR-008`).
  - **Given** valid Sepolia credentials in `.env.local`, **When** `npm run contracts:deploy:sepolia` and `npm run contracts:verify:sepolia` are run, **Then** `AttendChainRegistry` deploys to Sepolia (`11155111`) and links cleanly to Sepolia Etherscan.
- **Dependencies:** `T-019`
- **Explicit Out-of-Scope:** Mainnet deployment or non-MVP backlog features.
- **Likely Files / Modules:** `tests/e2e/journeys.spec.ts`, `blockchain/scripts/verify-sepolia.ts`, `README.md`
- **Test Plan:** Full CI verification pipeline execution.
- **Size:** `M`
- **Initial Status:** `TODO`
- **Status:** `DONE`

---

## Complete Requirement-to-Ticket Traceability Matrix

| Requirement ID | Requirement Summary | Priority | Mapped Ticket IDs |
| :--- | :--- | :--- | :--- |
| **`FR-001`** | Connect EVM wallet (MetaMask) and detect account & chain ID (`31337` / `11155111`) | Must | `T-004`, `T-008`, `T-020` |
| **`FR-002`** | Cryptographic signed-message authentication (EIP-4361 SIWE with single-use nonce) | Must | `T-009`, `T-019`, `T-020` |
| **`FR-003`** | Grant and revoke `TEACHER_ROLE` and `ADMIN_ROLE` on-chain and off-chain | Must | `T-005`, `T-007`, `T-012`, `T-020` |
| **`FR-004`** | Enforce RBAC across UI routes, API endpoints, and smart contract modifiers | Must | `T-005`, `T-007`, `T-009`, `T-012`, `T-019` |
| **`FR-005`** | Privacy-preserving student registration with salted `bytes32 studentIdHash` | Must | `T-003`, `T-007`, `T-012`, `T-020` |
| **`FR-006`** | Student wallet association (SIWE claim code / Admin mapping) + pre-wallet attendance | Must | `T-009`, `T-012`, `T-016` |
| **`FR-007`** | Course and subject creation, teacher assignment, and batch student enrollment | Must | `T-005`, `T-007`, `T-012`, `T-020` |
| **`FR-008`** | Open lecture session (`openSession`) with time window and `metadataHash` | Must | `T-005`, `T-007`, `T-014`, `T-020` |
| **`FR-009`** | Close (`closeSession`) or cancel (`cancelSession`) lecture sessions on-chain | Must | `T-005`, `T-007`, `T-014`, `T-015` |
| **`FR-010`** | Teacher manual/batch attendance marking (`recordBatchAttendance`) | Must | `T-006`, `T-007`, `T-015`, `T-020` |
| **`FR-011`** | Duplicate attendance prevention per `(sessionId, studentIdHash)` | Must | `T-006`, `T-007`, `T-015` |
| **`FR-012`** | Filterable student attendance history with status badges and tx links | Must | `T-011`, `T-016`, `T-020` |
| **`FR-013`** | Exact attendance percentage calculation (`Present / Eligible Completed * 100`) | Must | `T-013`, `T-016`, `T-020` |
| **`FR-014`** | Independent transaction & contract storage verification against RPC (`/verify`) | Must | `T-004`, `T-018`, `T-020` |
| **`FR-015`** | Chronological audit trail of all session, attendance, and correction events | Must | `T-006`, `T-007`, `T-011`, `T-017`, `T-018` |
| **`FR-016`** | Auditable on-chain attendance corrections (`correctAttendance`) with `reasonHash` | Must | `T-006`, `T-007`, `T-017`, `T-020` |
| **`FR-017`** | Student off-chain attendance dispute request & teacher review workflow | Should | `T-017`, `T-020` |
| **`FR-018`** | Live 30-second rotating dynamic QR challenge projector for open sessions | Must | `T-015`, `T-016`, `T-020` |
| **`FR-019`** | Wallet-signed student QR check-in validation + EIP-712 `checkInWithTicket` | Must | `T-006`, `T-007`, `T-015`, `T-016`, `T-020` |
| **`FR-020`** | Administrative course summary and `<75%` shortage alerts with CSV export | Should | `T-013`, `T-020` |
| **`FR-021`** | Wrong network, disconnected wallet, rejected signature, and revert recovery UX | Must | `T-008`, `T-010`, `T-020` |
| **`FR-022`** | Primary/fallback RPC failover and `sessionStorage` pending tx recovery | Must | `T-008`, `T-010`, `T-020` |
| **`NFR-001`** | Zero student PII on-chain or in logs | Must | `T-001`, `T-003`, `T-006`, `T-007`, `T-012`, `T-019` |
| **`NFR-002`** | API p95 latency $\le 300\text{ ms}$; dashboard LCP $\le 2.0\text{ s}$ | Must | `T-008`, `T-011`, `T-013` |
| **`NFR-003`** | Immediate wallet/tx state transition feedback ($\le 150\text{ ms}$) | Must | `T-008`, `T-010` |
| **`NFR-004`** | Batch attendance gas efficiency ($\le 1.5\text{M gas}$ for 50 students) | Must | `T-006`, `T-007`, `T-015` |
| **`NFR-005`** | 100% of write APIs protected by SIWE JWT + single-use 5m nonces | Must | `T-001`, `T-009`, `T-019` |
| **`NFR-006`** | WCAG 2.2 Level AA compliance (`0` critical/serious axe violations) | Must | `T-002`, `T-004`, `T-019` |
| **`NFR-007`** | Idempotent event sync keyed by `(chainId, txHash, logIndex)` | Must | `T-003`, `T-011` |
| **`NFR-008`** | $\ge 90\%$ automated test coverage on contracts and core logic | Must | `T-002`, `T-007`, `T-013`, `T-019`, `T-020` |
| **`TR-001`–`TR-013`** | All Technical Requirements from `02_TRD.md` Section 2 | Must | `T-003`, `T-005`–`T-018`, `T-020` |
