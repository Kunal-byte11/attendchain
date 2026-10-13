# 05_SECURITY.md — Security and Privacy Specification

- **Purpose:** Define the product-specific threat model (STRIDE), authentication/authorization controls, smart contract vulnerability mitigations, QR anti-fraud mechanisms, privacy and India DPDP Act considerations, OWASP mappings, prototype-vs-production security boundaries, and phase-by-phase security gates for AttendChain.
- **Status:** Draft v1
- **Last updated:** 2026-10-13
- **Depends on:** `/docs/01_PRD.md`, `/docs/02_TRD.md`, `/docs/03_UIUX.md`, `/docs/04_ARCHITECTURE.md`

---

## 1. Security Scope & Evidentiary Honesty Statement

In accordance with Non-Negotiable Principles #3, #4, #11, and Section 2 of `01_PRD.md`, AttendChain's security architecture explicitly distinguishes between **cryptographic integrity** and **physical-world truth**:

1. **What AttendChain Guarantees:** Once an attendance transaction (`recordBatchAttendance`, `checkInWithTicket`, or `correctAttendance`) is confirmed on the blockchain, neither a student, teacher, administrator, nor database operator can silently alter or delete the historical transaction log. Every post-closure modification requires a new signed transaction (`correctAttendance`) that permanently records the previous status, new status, signer wallet, block timestamp, and `reasonHash`.
2. **What AttendChain Does Not Claim:** Neither a smart contract, wallet signature, nor dynamic QR code can autonomously prove a human body is sitting in a physical classroom. If a teacher intentionally marks an absent student `PRESENT`, or if a student inside the lecture hall relays a live 30-second QR code to a peer who signs within the 30-second window, the system records the cryptographically signed submission. AttendChain mitigates this operational risk through 30-second QR rotation, live headcount comparison on the teacher's roster, and teacher final review before batch commit.

---

## 2. Assets, Actors, Trust Boundaries, and Threat Assumptions

### 2.1 Critical Assets

| Asset ID | Asset Name | Classification | Storage Location | Impact if Compromised |
| :--- | :--- | :--- | :--- | :--- |
| **AST-01** | On-Chain Attendance & Audit State | Integrity-Critical Public Ledger | `AttendChainRegistry` (Sepolia / Hardhat) | Unauthorized attendance credit or falsified academic eligibility. |
| **AST-02** | Off-Chain Student Identity Mapping (`students` table) | Confidential (Synthetic PII in MVP; Regulated PII in real deployment) | Supabase PostgreSQL | De-anonymization of on-chain `studentIdHash` commitments. |
| **AST-03** | `INSTITUTION_HASH_SALT` | Critical Server Secret | Server Environment Variable | Allows dictionary/rainbow-table reversal of predictable roll numbers (`SYN-2026-*`) against on-chain `studentIdHash` values. |
| **AST-04** | `AUTH_JWT_SECRET` & `QR_TICKET_SIGNER_PRIVATE_KEY` | Critical Server Secrets | Server Environment Variables | Forgery of authenticated API sessions or EIP-712 `checkInWithTicket` vouchers. |
| **AST-05** | Admin & Teacher Wallet Private Keys | Critical User-Controlled Secrets | User's MetaMask Extension | Unauthorized role grants, rogue session creation, or fraudulent attendance commits. |
| **AST-06** | `SUPABASE_SERVICE_ROLE_KEY` | Critical Server Secret | Server Environment Variable | Direct off-chain database tampering (detectable via `/verify` RPC diff, but disruptive to operations). |

### 2.2 Threat Actors & Assumptions
- **Curious or Dishonest Student:** Attempts to mark themselves `PRESENT` without attending (QR screenshot sharing, replaying expired QR tokens, spoofing another wallet address in HTTP requests, or calling smart contract functions directly).
- **Compromised or Colluding Faculty/Admin Account:** Attempts to retroactively change an `ABSENT` record to `PRESENT` at semester-end without leaving an audit trail, or mark attendance for courses they do not teach.
- **External Network / Web Attacker:** Attempts SQL injection, XSS, CSRF, SIWE nonce replay, RPC response spoofing, or scraping Etherscan to harvest student PII.

---

## 3. STRIDE Threat Analysis & Mitigations

| Threat Category | Specific Threat Scenario in AttendChain | Affected Component | Mitigation Control | Linked Req / Ticket |
| :--- | :--- | :--- | :--- | :--- |
| **S — Spoofing** | A user intercepts or modifies a client request to pass a Teacher's wallet address without owning the private key. | `/api/*`, Client UI | Wallet connection (`eth_requestAccounts`) grants zero privileges. Users must sign an EIP-4361 SIWE message containing a single-use server-issued nonce (`POST /api/auth/verify`). All on-chain writes are verified by EVM `ecrecover` (`msg.sender`). | `FR-002`, `NFR-005`, `TR-002` |
| **T — Tampering** | A database administrator directly executes `UPDATE attendance_records SET on_chain_status = 'PRESENT'` in PostgreSQL without an on-chain transaction. | Supabase PostgreSQL | The `/verify` service (`TR-012`) queries `getAttendanceRecord(sessionId, studentIdHash)` and the transaction receipt directly from the blockchain RPC and flags any divergence as a red `DATA INTEGRITY MISMATCH`. | `FR-014`, `TR-012` |
| **R — Repudiation** | A teacher claims they never changed a student's attendance from `ABSENT` to `PRESENT` two weeks after the lecture. | `AttendChainRegistry.sol`, `/corrections` | Standard marking is locked once a session is `CLOSED`. Post-closure changes require `correctAttendance`, which increments `amendmentCount` and emits `AttendanceCorrected` signed by `msg.sender` with block timestamp and `reasonHash`. | `FR-015`, `FR-016`, `TR-009` |
| **I — Information Disclosure** | An external observer inspects Sepolia Etherscan transactions and logs to extract student names, roll numbers, or medical excuse notes. | `AttendChainRegistry.sol`, Sepolia Explorer | Zero PII on-chain (`NFR-001`). Students are represented solely by `studentIdHash = keccak256(INSTITUTION_HASH_SALT, rollNo)`. Correction reasons are represented on-chain only by `reasonHash = keccak256(reasonText)`. | `FR-005`, `NFR-001`, `TR-004` |
| **D — Denial of Service** | (a) A caller passes 5,000 student hashes to `recordBatchAttendance`, exhausting block gas; or (b) Primary Sepolia RPC returns `429 Too Many Requests`. | Smart Contract, RPC Layer | (a) Enforce `MAX_BATCH_SIZE = 100` in Solidity (`BatchSizeExceeded` custom error); (b) Automatic failover from primary RPC to fallback RPC (`TR-013`) plus rate limiting on `/api/auth/nonce` and `/api/attendance/qr-checkin`. | `FR-022`, `NFR-004`, `TR-007`, `TR-013` |
| **E — Elevation of Privilege** | A Student or unassigned Teacher calls `openSession`, `recordBatchAttendance`, or `grantTeacherRole` directly via an RPC script. | `AttendChainRegistry.sol`, `/api/*` | On-chain OpenZeppelin `AccessControl` (`onlyRole(DEFAULT_ADMIN_ROLE)`) and custom modifier `onlyCourseTeacherOrAdmin(courseIdHash)` revert unauthorized calls; API routes enforce JWT role checks before DB mutations. | `FR-003`, `FR-004`, `TR-003` |

---

## 4. Authentication, SIWE Nonce Handling & Replay Protection

### 4.1 Why Wallet Connection Alone Is Never Authentication
Calling `window.ethereum.request({ method: 'eth_requestAccounts' })` happens entirely in the untrusted browser environment. Any attacker can send `fetch('/api/courses', { body: JSON.stringify({ walletAddress: '0xAdminAddress...' }) })` using `curl`. Therefore, **AttendChain treats a connected wallet as an unverified public hint until the user completes the SIWE flow.**

### 4.2 EIP-4361 (SIWE) Verification & Session Lifecycle
1. **Nonce Issuance (`POST /api/auth/nonce`):**
   - Generates a cryptographically random 128-bit hex nonce (`crypto.randomBytes(16).toString('hex')`).
   - Stores `{ wallet_address, nonce, expires_at: now + 5 minutes, consumed_at: null }` in `auth_nonces`.
2. **Signed Payload Structure:**
   - Includes domain (`host`), checksummed wallet address, statement (`"Sign in to AttendChain Academic Portal"`), URI, version (`1`), `chainId` (`31337` or `11155111`), `nonce`, `issuedAt`, and `expirationTime`.
3. **Signature Recovery & Replay Prevention (`POST /api/auth/verify`):**
   - Verifies that `nonce` exists in `auth_nonces`, `consumed_at IS NULL`, and `expires_at > NOW()`.
   - Atomically marks `consumed_at = NOW()` (`UPDATE auth_nonces SET consumed_at = NOW() WHERE nonce = $1 AND consumed_at IS NULL RETURNING id`) so concurrent replay requests fail immediately.
   - Recovers signer via `ethers.verifyMessage(message, signature)` and asserts case-insensitive checksum match with `walletAddress`.
4. **Session Cookie Security:**
   - Issues an `HS256` JWT signed with `AUTH_JWT_SECRET` (via `jose`) containing `{ sub: walletAddress, role, studentIdHash?, chainId, iat, exp: +8h }`.
   - Stored in cookie `attendchain_session` with flags: `HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` (plus `Secure` when `NODE_ENV === 'production'`).

---

## 5. Role × Resource × Action Authorization Matrix

Every action is enforced at **both** the API layer (JWT + Supabase lookup) and the Smart Contract layer (`msg.sender` role and course assignment):

| Resource / Operation | `PUBLIC` (Unauthenticated) | `STUDENT` (Authenticated) | `TEACHER` (Authenticated) | `ADMIN` (Authenticated) | Enforcement Layer |
| :--- | :--- | :--- | :--- | :--- | :--- |
| View Landing (`/`) & Request Auth Nonce | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | Public Route |
| Verify Transaction Against RPC (`/verify`, `GET /api/verify`) | **ALLOW** (by `txHash`/`studentIdHash`) | **ALLOW** | **ALLOW** | **ALLOW** | Public Read-Only RPC |
| Grant / Revoke `TEACHER_ROLE` or `ADMIN_ROLE` | DENY | DENY | DENY | **ALLOW** | Contract `onlyRole(DEFAULT_ADMIN_ROLE)` + API |
| Register Synthetic Student & Generate `studentIdHash` | DENY | DENY | DENY | **ALLOW** | API `ADMIN` guard |
| Bind Own Wallet to `studentIdHash` via Claim Code | DENY | **ALLOW** (Own claim code) | DENY | **ALLOW** | API + SIWE signature check |
| Create Course & Batch Enroll `studentIdHash` | DENY | DENY | DENY | **ALLOW** | Contract `onlyRole(DEFAULT_ADMIN_ROLE)` + API |
| Open / Close / Cancel Lecture Session | DENY | DENY | **ALLOW (Assigned Courses Only)** | **ALLOW (All Courses)** | Contract `onlyCourseTeacherOrAdmin` + API |
| Generate Rotating 30s QR Challenge | DENY | DENY | **ALLOW (Assigned Open Session)** | **ALLOW** | API `TEACHER`/`ADMIN` guard |
| Submit QR Check-In / `checkInWithTicket` | DENY | **ALLOW (Enrolled Course Only, Own `studentIdHash`)** | DENY | DENY | API enrollment + EIP-712 / SIWE check |
| Commit Batch Attendance (`recordBatchAttendance`) | DENY | DENY | **ALLOW (Assigned Open Session)** | **ALLOW** | Contract `onlyCourseTeacherOrAdmin` |
| View Student Attendance History & Percentage | DENY | **ALLOW (Own Records Only)** | **ALLOW (Assigned Courses)** | **ALLOW (All Courses)** | API row-level filtering |
| Submit Off-Chain Attendance Dispute Request | DENY | **ALLOW (Own Closed Session Record)** | DENY | DENY | API `STUDENT` guard |
| Execute On-Chain Correction (`correctAttendance`) | DENY | DENY | **ALLOW (Assigned Closed Session)** | **ALLOW (All Closed Sessions)** | Contract `onlyCourseTeacherOrAdmin` |
| Delete or Silently Overwrite Confirmed Event History | **DENY** | **DENY** | **DENY** | **DENY** | **Impossible by EVM Immutability** |

---

## 6. Smart Contract Security & Vulnerability Assessment

| Vulnerability Class | Risk Assessment in `AttendChainRegistry.sol` | Mitigations Implemented |
| :--- | :--- | :--- |
| **1. Reentrancy (`SWC-107`)** | **Very Low:** The contract holds zero ETH (`payable` functions are prohibited) and makes zero external calls to untrusted contracts. | All functions strictly follow **Checks-Effects-Interactions (CEI)**; `receive()` and `fallback()` are omitted so accidental ETH transfers revert automatically. |
| **2. Broken Access Control (`SWC-105`)** | **High if misconfigured:** An unassigned teacher or student attempting to mark or amend attendance. | Uses OpenZeppelin `AccessControl` (`v5.6.1`) + explicit `onlyCourseTeacherOrAdmin(courseIdHash)` check verifying `courses[courseIdHash].assignedTeacher == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender)`. |
| **3. Signature Replay & Malleability (`SWC-117`, `SWC-121`)** | **High in `checkInWithTicket`:** Replaying a valid QR ticket across sessions, courses, or forks. | Uses OpenZeppelin `EIP712` (`v5.6.1`) and `ECDSA.recover` (which rejects malleable upper-range $s$ values). The typed struct `QrCheckInTicket(uint256 sessionId,bytes32 studentIdHash,uint8 status,uint256 deadline)` is bound to `chainId` and `address(this)`, and `attendanceRecords[sessionId][studentIdHash].status == NONE` prevents reuse once recorded. |
| **4. Unbounded Loop Gas DoS (`SWC-128`)** | **Medium in batch functions:** Passing huge arrays to `recordBatchAttendance` or `enrollStudentsBatch`. | Enforces `if (len == 0 || len > MAX_BATCH_SIZE) revert BatchSizeExceeded(len, MAX_BATCH_SIZE);` (`MAX_BATCH_SIZE = 100`) and uses ` mapping` lookups ($O(1)$ per item) rather than iterating over storage arrays. |
| **5. Timestamp Dependence (`SWC-116`)** | **Low:** Validators can skew `block.timestamp` by ~1–12 seconds. | On-chain session windows and EIP-712 ticket deadlines operate at minute granularity, while fine-grained 30-second QR rotation is enforced by the backend server clock before issuing the voucher/staging record. |
| **6. Integer Overflow / Underflow (`SWC-101`)** | **Negligible:** Solidity `0.8.28` has built-in checked arithmetic. | Only loop iterators bounded by `i < len` use `unchecked { ++i; }` for gas savings; `amendmentCount` (`uint8`) uses saturating addition (`if (record.amendmentCount < 255) { record.amendmentCount += 1; }`) so >255 amendments never revert. |

---

## 7. Attendance Manipulation, Correction Governance & QR Anti-Fraud Controls

### 7.1 How Corrections Preserve History Without Silent Overwrites
When an attendance record is initially committed (`recordBatchAttendance` or `checkInWithTicket`), `AttendChainRegistry` requires `existing.status == NONE` (reverts with `AttendanceAlreadyRecorded` if called again) and emits:
`AttendanceRecorded(sessionId, studentIdHash, initialStatus, recordedBy, timestamp)`

Once the session is `CLOSED`, standard marking functions are permanently locked for that `sessionId`. If a legitimate correction is required:
1. The assigned Teacher or Admin calls `correctAttendance(sessionId, studentIdHash, newStatus, reasonHash)`.
2. The contract asserts `session.status == CLOSED`, `existing.status != NONE`, `newStatus != existing.status`, and `reasonHash != bytes32(0)`.
3. The contract updates the current effective status in `attendanceRecords[sessionId][studentIdHash]`, sets `amendedAt = uint40(block.timestamp)`, increments `amendmentCount`, and emits:
   `AttendanceCorrected(sessionId, studentIdHash, previousStatus, newStatus, reasonHash, msg.sender, amendmentCount, timestamp)`
4. Because EVM event logs are append-only, **the original `AttendanceRecorded` log can never be deleted or hidden**, and any record with `amendmentCount > 0` displays an `"Amended (View Audit Trail)"` badge in the UI.

### 7.2 Dynamic QR Anti-Fraud Controls
1. **30-Second Cryptographic Rotation:** Every 30 seconds, the teacher's session view requests a fresh signed challenge token from `POST /api/sessions/[sessionId]/qr`. Tokens older than 35 seconds (30s window + 5s network grace) are rejected with `QR_TOKEN_EXPIRED`.
2. **Wallet Ownership + Enrollment Check:** A student cannot merely hit the check-in URL; they must sign the check-in payload with the wallet bound to their enrolled `studentIdHash`.
3. **One Check-In Per Student Per Session:** Both the database (`UNIQUE(on_chain_session_id, student_id_hash)`) and smart contract reject duplicate check-ins.
4. **Teacher Live Headcount Verification:** The teacher's screen displays a real-time counter (`"QR Verified: 22"` vs physical students in room) and allows the teacher to flip any fraudulent remote QR scan back to `ABSENT` prior to executing `recordBatchAttendance`.

---

## 8. Application Security, Secrets Management & Supply Chain

1. **Secrets Isolation:**
   - Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `AUTH_JWT_SECRET`, `INSTITUTION_HASH_SALT`, `QR_TICKET_SIGNER_PRIVATE_KEY`, `DEPLOYER_PRIVATE_KEY`) never use the `NEXT_PUBLIC_` prefix and are imported exclusively inside `src/app/api/**`, `src/lib/server/**`, or `hardhat.config.ts`.
   - Startup validation (`src/lib/validation/env.ts`) verifies that all required secrets are present and prohibits importing server secret modules in client components (`import "server-only"`).
2. **Input Validation & Output Encoding:**
   - Every API route parses request bodies and query parameters through strict `zod` schemas (`src/lib/validation/schemas.ts`), rejecting unexpected fields (`.strict()`).
   - Free-text fields (`topic`, `reasonText`, `syntheticName`) are trimmed, length-bounded, and rendered exclusively via React JSX text nodes (`dangerouslySetInnerHTML` is strictly banned in `07_RULES.md`).
3. **HTTP Security Headers (`next.config.ts`):**
   - Enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a Content-Security-Policy restricting scripts and connect-src to self, Supabase, and approved Sepolia/Hardhat RPC hosts.
4. **Rate Limiting:**
   - In-memory/sliding-window rate limiter on `/api/auth/nonce` (`10 req/min/IP`), `/api/auth/verify` (`10 req/min/IP`), and `/api/attendance/qr-checkin` (`15 req/min/wallet`).
5. **Supply Chain & Dependency Pinning:**
   - All dependencies are locked in `package-lock.json` and installed via `npm ci`. Running `npm audit --audit-level=high` is a required CI check.

---

## 9. Privacy Compliance & India DPDP Act Assessment

> `[VERIFY WITH QUALIFIED LEGAL PROFESSIONAL]` — The following analysis maps technical privacy controls to India's **Digital Personal Data Protection Act, 2023 (DPDP Act)** and general academic data protection principles. If AttendChain is ever transitioned from a synthetic college prototype to an institutional deployment processing real student data, formal legal review by the institution's Data Protection Officer / legal counsel is required.

| Privacy Principle (DPDP Act, 2023) | AttendChain Architectural Implementation | Prototype Status |
| :--- | :--- | :--- |
| **1. Zero Real PII in Prototype (Non-Negotiable #8 & #9)** | All development, testing, and Sepolia demonstrations exclusively use synthetic records (`SYN-2026-001`, `"Aarav Mehta"`). Input validation rejects roll numbers not prefixed with `SYN-`. | **Enforced in MVP Code & DB Constraints** |
| **2. Purpose Limitation & Data Minimization** | Only minimum academic fields (`synthetic_roll_no`, `synthetic_name`, `department`, `semester`, optional `wallet_address`) are stored off-chain; biometric, financial, or location data are never collected. | **Enforced** |
| **3. Blockchain Immutability vs. Right to Erasure (DPDP Section 12(3))** | Because public blockchain records cannot be deleted, **zero personal data is written to Ethereum Sepolia**. Only `studentIdHash = keccak256(INSTITUTION_HASH_SALT, rollNo)` and `reasonHash` are stored on-chain. Deleting the off-chain row in Supabase (or rotating `INSTITUTION_HASH_SALT`) permanently breaks linkability to the on-chain hash. | **Enforced via Salted Pseudonymization (`DEC-01`)** |
| **4. Reasonable Security Safeguards (DPDP Section 8(5))** | TLS 1.3 in transit, AES-256 encryption at rest in Supabase, SIWE authentication, RBAC row filtering, and automatic PII redaction in application logs. | **Enforced** |

---

## 10. OWASP Top 10 (Web & Smart Contract) Mapping

| Standard | Risk Item | AttendChain Control |
| :--- | :--- | :--- |
| **OWASP Web A01:2021** | Broken Access Control | Enforced at 3 layers: Next.js Middleware, API Route JWT role/course ownership checks, and Solidity `AccessControl` modifiers. |
| **OWASP Web A02:2021** | Cryptographic Failures | Salted `keccak256` commitments (`256-bit` secret salt), EIP-4361 SIWE, EIP-712 typed vouchers, `HS256` `HttpOnly` session cookies. |
| **OWASP Web A03:2021** | Injection (SQL / XSS) | Parameterized Supabase queries (zero raw SQL string concatenation), `zod` strict schemas, zero `dangerouslySetInnerHTML`. |
| **OWASP Web A07:2021** | Identification & Authentication Failures | Single-use expiring SIWE nonces (`5m` TTL), atomic nonce consumption, wallet signature recovery verification. |
| **OWASP SC01 / SC02** | Improper Access Control & Signature Replay | OpenZeppelin `AccessControl` + `EIP712` domain separator (`chainId`, `verifyingContract`) + single-record status guard (`status == NONE`). |
| **OWASP SC06** | Unchecked External Calls / Reentrancy | Zero external contract calls, zero ETH value handling, strict CEI pattern. |
| **OWASP SC09** | Gas Limit DoS | Single-slot 32-byte struct packing (`DEC-03`) and hard cap `MAX_BATCH_SIZE = 100`. |

---

## 11. Prototype Security vs. Production-Grade Institutional Security

Per Non-Negotiable Principle #11, the table below transparently distinguishes what is implemented in the 12-day MVP prototype versus what is required before a production university rollout:

| Security Control Area | 12-Day MVP Prototype Implementation | Production-Grade Institutional Requirement |
| :--- | :--- | :--- |
| **Admin Key Custody** | Single EOA (`DEFAULT_ADMIN_ROLE`) in MetaMask for Demo Admin | Multi-signature Gnosis `Safe` (e.g., 3-of-5 Dean + Registrar + IT Admin) with 48-hour timelock |
| **Student Data** | 100% Synthetic Student Profiles (`SYN-*`) | Real student records governed by institutional DPDP consent notices, KMS-managed per-student salts, and automated erasure workflows |
| **Smart Contract Audit** | Comprehensive automated unit/branch tests ($\ge 90\%$ coverage) + static security checklist | Independent third-party smart contract security audit and formal verification |
| **Rate Limiting & Session Store** | Process-level sliding-window rate limiter + PostgreSQL `auth_nonces` | Distributed Redis / Upstash rate limiter + WAF (Cloudflare) |
| **Blockchain Network** | Local Hardhat (`31337`) + Public Ethereum Sepolia (`11155111`) | Production L2 (e.g., Arbitrum/Base/Polygon) or permissioned university consortium EVM chain with sponsored account abstraction (ERC-4337 Paymaster) |

---

## 12. Phase-Specific Security Acceptance Checklists

No phase in `08_PHASES.md` may pass its Phase Gate until every security check for that phase is verified:

- **Phase 0 Security Gate:**
  - [ ] `.gitignore` blocks `.env`, `.env.local`, `.env.*.local`, `*.pem`, and `*.key`.
  - [ ] Environment validator (`src/lib/validation/env.ts`) fails fast if secrets are missing or leaked to `NEXT_PUBLIC_*`.
  - [ ] Redacted logger test proves `privateKey`, `rollNumber`, and `studentName` are stripped from log output.
- **Phase 1 Security Gate (Smart Contract):**
  - [ ] 100% of state-changing functions in `AttendChainRegistry.sol` revert when called by unauthorized wallets.
  - [ ] `recordBatchAttendance` reverts on duplicate `(sessionId, studentIdHash)`, non-enrolled student hash, or `batchSize > 100`.
  - [ ] `correctAttendance` reverts on `OPEN` sessions, empty `reasonHash`, or identical status, and preserves prior `AttendanceRecorded` events.
  - [ ] Calldata and event inspection test verifies zero plaintext PII fields exist in the ABI.
- **Phase 2 Security Gate (Auth & Wallet):**
  - [ ] Connecting MetaMask without signing SIWE challenge returns `401 Unauthorized` on all protected API endpoints.
  - [ ] Replaying a consumed or expired SIWE nonce returns `401 Unauthorized`.
  - [ ] Wrong-network state (`chainId` mismatch) disables all transaction write buttons.
- **Phase 3 Security Gate (Attendance & QR):**
  - [ ] `POST /api/students` rejects any roll number not matching `^SYN-[A-Z0-9-]+$`.
  - [ ] Expired (>35s), forged, or cross-session QR tokens are rejected with `400`/`403`.
  - [ ] A student wallet cannot query or check in for another student's `studentIdHash`.
- **Phase 4 & 5 Security Gate (Audit, Verification & Final MVP):**
  - [ ] Tampering with an attendance status directly in Supabase is immediately detected and flagged as `MISMATCH` by `/verify` (`TR-012`).
  - [ ] `npm audit --audit-level=high` reports 0 high/critical vulnerabilities.
