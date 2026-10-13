# 00_INDEX.md — AttendChain Documentation Index

- **Purpose:** Serve as the central navigation hub, glossary, ID convention guide, consolidated assumptions/open-questions registry, and checkpoint status tracker for the AttendChain pre-implementation specification pack.
- **Status:** Draft v1
- **Last updated:** 2026-10-13
- **Depends on:** `/docs/01_PRD.md`, `/docs/02_TRD.md`, `/docs/03_UIUX.md`, `/docs/04_ARCHITECTURE.md`, `/docs/05_SECURITY.md`, `/docs/06_TICKETS.md`, `/docs/07_RULES.md`, `/docs/08_PHASES.md`, `/docs/09_MASTER_PROMPT.md`

---

## 1. Document Inventory & One-Line Purpose

| File Path | Document Title | One-Line Purpose |
| :--- | :--- | :--- |
| [`/CLAUDE.md`](../CLAUDE.md) | Claude Agent Bootstrapper | Five-line directive instructing Claude coding agents to read `/docs/07_RULES.md` and `/docs/09_MASTER_PROMPT.md` and obey ticket/phase gates. |
| [`/AGENTS.md`](../AGENTS.md) | Universal Agent Bootstrapper | Five-line directive instructing all AI coding agents to read `/docs/07_RULES.md` and `/docs/09_MASTER_PROMPT.md` and obey ticket/phase gates. |
| [`/docs/00_INDEX.md`](./00_INDEX.md) | Documentation Index | Central catalog, reading order, ID conventions, Web3/academic glossary, and consolidated registry of all `[ASSUMPTION]` and `[OPEN QUESTION]` items. |
| [`/docs/01_PRD.md`](./01_PRD.md) | Product Requirements Document | Defines product vision, evidentiary boundaries, personas, 4 user journeys, attendance percentage formula, `FR-001`–`FR-022`, and `NFR-001`–`NFR-008`. |
| [`/docs/02_TRD.md`](./02_TRD.md) | Technical Requirements Document | Specifies the verified npm stack (`Next.js 15.5.27`, `Solidity 0.8.28`, `Hardhat 2.29.1`, `ethers 6.17.0`), `TR-001`–`TR-013`, gas budgets, performance targets, and repo layout. |
| [`/docs/03_UIUX.md`](./03_UIUX.md) | UI/UX Design Specification | Establishes WCAG 2.2 AA design tokens, component state matrix, Mermaid sitemaps, Web3 failure recovery UX, and specifications for all 14 routes. |
| [`/docs/04_ARCHITECTURE.md`](./04_ARCHITECTURE.md) | Architecture & Data Design | Documents system boundaries, on-chain vs. off-chain data classification, PostgreSQL ERD, `AttendChainRegistry.sol` ABI spec, REST API contracts, and sequence diagrams. |
| [`/docs/05_SECURITY.md`](./05_SECURITY.md) | Security & Privacy Specification | Provides the STRIDE threat model, SIWE auth rules, RBAC authorization matrix, smart contract vulnerability assessment, India DPDP Act mapping, and phase security gates. |
| [`/docs/06_TICKETS.md`](./06_TICKETS.md) | Implementation Backlog | Breaks the MVP into 20 atomic, Given/When/Then-tested tickets (`T-001`–`T-020`) across Phases 0–5 with a complete requirement traceability table. |
| [`/docs/07_RULES.md`](./07_RULES.md) | AI Agent Constitution | Enforces `ALWAYS`/`NEVER` engineering rules, the verified dependency stack lock, banned packages, protected files, and the Definition of Done. |
| [`/docs/08_PHASES.md`](./08_PHASES.md) | Development Roadmap | Defines the 12-day (`10.0 focused days` + `2.0 buffer days`) phased execution plan (`Phase 0`–`Phase 5`) with exit criteria and demo scripts. |
| [`/docs/09_MASTER_PROMPT.md`](./09_MASTER_PROMPT.md) | Coding Agent Session Prompt | Provides the paste-ready master prompt governing ticket-by-ticket implementation, status tracking, conflict escalation, and phase gate stops. |

---

## 2. Recommended Reading Order

### 2.1 For AI Coding Agents (Strict Operational Order from `09_MASTER_PROMPT.md`)
1. [`/docs/07_RULES.md`](./07_RULES.md) — Understand stack locks, boundaries, and `ALWAYS`/`NEVER` rules first.
2. [`/docs/01_PRD.md`](./01_PRD.md) — Understand product requirements and attendance calculation rules.
3. [`/docs/02_TRD.md`](./02_TRD.md) — Understand technical requirements, gas budgets, and environment setup.
4. [`/docs/03_UIUX.md`](./03_UIUX.md) — Understand the 14 screens, design tokens, and Web3 failure recovery states.
5. [`/docs/04_ARCHITECTURE.md`](./04_ARCHITECTURE.md) — Understand the database schema, smart contract interface, and REST APIs.
6. [`/docs/05_SECURITY.md`](./05_SECURITY.md) — Understand threat mitigations, RBAC, and phase security checklists.
7. [`/docs/06_TICKETS.md`](./06_TICKETS.md) — Locate the next `TODO` ticket and its Given/When/Then acceptance criteria.
8. [`/docs/08_PHASES.md`](./08_PHASES.md) — Verify current phase scope and phase gate exit criteria.

### 2.2 For Human Stakeholders & Academic Evaluators
1. [`/docs/00_INDEX.md`](./00_INDEX.md) $\rightarrow$ [`/docs/01_PRD.md`](./01_PRD.md) $\rightarrow$ [`/docs/04_ARCHITECTURE.md`](./04_ARCHITECTURE.md) $\rightarrow$ [`/docs/05_SECURITY.md`](./05_SECURITY.md) $\rightarrow$ [`/docs/03_UIUX.md`](./03_UIUX.md) $\rightarrow$ [`/docs/02_TRD.md`](./02_TRD.md) $\rightarrow$ [`/docs/08_PHASES.md`](./08_PHASES.md) $\rightarrow$ [`/docs/06_TICKETS.md`](./06_TICKETS.md).

---

## 3. Identifier (`ID`) Conventions

| Prefix | Meaning | Range in Pack | Defined In |
| :--- | :--- | :--- | :--- |
| **`FR-XXX`** | Functional Requirement | `FR-001` – `FR-022` | [`01_PRD.md` Section 8](./01_PRD.md#8-functional-requirements-table) |
| **`NFR-XXX`** | Non-Functional Requirement | `NFR-001` – `NFR-008` | [`01_PRD.md` Section 9](./01_PRD.md#9-non-functional-requirements-table) |
| **`TR-XXX`** | Technical Requirement | `TR-001` – `TR-013` | [`02_TRD.md` Section 2](./02_TRD.md#2-technical-requirements-mapped-to-product-requirements) |
| **`T-XXX`** | Implementation Ticket | `T-001` – `T-020` | [`06_TICKETS.md`](./06_TICKETS.md) |
| **`G-XX`** | Product Goal | `G-01` – `G-05` | [`01_PRD.md` Section 3](./01_PRD.md#3-product-goals--measurable-success-metrics) |
| **`DEC-XX`** | Architectural Decision | `DEC-01` – `DEC-05` | [`02_TRD.md` Section 14](./02_TRD.md#14-architecture--technical-decision-log) |
| **`A-XX`** | Documented Product/Tech Assumption | `A-01` – `A-06` | [`01_PRD.md` Section 12.1](./01_PRD.md#121-documented-assumptions-assumption) |
| **`OQ-XX`** | Open Question | `OQ-01` – `OQ-02` | [`01_PRD.md` Section 12.4](./01_PRD.md#124-open-questions-open-question) |

---

## 4. Glossary of Domain & Web3 Terms

| Term | Definition in AttendChain |
| :--- | :--- |
| **Blockchain** | An append-only, cryptographically linked ledger replicated across nodes (Local Hardhat `chainId: 31337` and Ethereum Sepolia `chainId: 11155111`) used by AttendChain as an immutable timestamped audit log for classroom attendance. |
| **Smart Contract** | Self-executing program deployed on the EVM (`AttendChainRegistry.sol`, compiled with Solidity `0.8.28`) that enforces role permissions, course enrollments, session windows, duplicate prevention, and auditable attendance corrections. |
| **Wallet** | An EIP-1193 compatible browser extension (primarily MetaMask) that manages a user's cryptographic keypair and signs EIP-4361 authentication challenges, EIP-712 QR vouchers, and blockchain transactions. |
| **Transaction (`txHash`)** | A signed state-changing message broadcast to the EVM network (e.g., `recordBatchAttendance` or `correctAttendance`), uniquely identified by a 32-byte keccak256 hash (`0x...`). |
| **Event (EVM Event Log)** | Structured, indexed log entry (`SessionOpened`, `AttendanceRecorded`, `AttendanceCorrected`, `SessionClosed`) emitted during transaction execution and stored permanently in transaction receipts for indexing and audit verification. |
| **RPC (Remote Procedure Call)** | JSON-RPC HTTPS interface (Alchemy/Infura/QuickNode for Sepolia; `127.0.0.1:8545` for Hardhat) through which the frontend and backend read contract state and broadcast signed transactions. |
| **Gas** | Computational unit measuring the EVM execution and storage cost of a transaction; optimized in AttendChain via 32-byte single-slot struct packing (`DEC-03`) and batch commits (`recordBatchAttendance`). |
| **EVM (Ethereum Virtual Machine)** | The deterministic runtime environment that executes `AttendChainRegistry` bytecode on both Hardhat Local and Ethereum Sepolia. |
| **Attendance Session (`LectureSession`)** | A time-bounded academic lecture instance for a specific course with an on-chain lifecycle (`OPEN -> CLOSED` or `OPEN -> CANCELLED`) against which student attendance is recorded. |
| **Audit Trail** | The chronological, immutable sequence of `AttendanceRecorded` and `AttendanceCorrected` events showing the initial attendance status, every subsequent amendment, the signing wallet, block timestamp, and `reasonHash`. |
| **Pseudonymous Student ID (`studentIdHash`)** | A salted 32-byte cryptographic commitment (`keccak256(abi.encodePacked(INSTITUTION_HASH_SALT, canonicalRollNo))`) used on-chain so student PII never touches the public blockchain (`NFR-001`). |

---

## 5. Consolidated Registry of `[ASSUMPTION]` and `[OPEN QUESTION]` Items

### 5.1 Consolidated `[ASSUMPTION]` Registry

| ID | Summary of Assumption | Source Document & Section | Impact if Changed |
| :--- | :--- | :--- | :--- |
| **`[ASSUMPTION: A-01]`** | **Unmarked Students in Closed Sessions:** Enrolled students left unmarked when a session transitions to `CLOSED` default to `ABSENT` (`+1` denominator, `+0` numerator), and the UI pre-fills unmarked students as `ABSENT` on batch commit. | [`01_PRD.md` §7.1](./01_PRD.md#71-status-definitions--formula-impact) & [`§12.1`](./01_PRD.md#121-documented-assumptions-assumption) | Affects `calculateAttendanceMetrics` (`TR-010`) and batch commit pre-fill in `T-015`. |
| **`[ASSUMPTION: A-02]`** | **Late Arrival Weighting:** `LATE` status counts as `+1` in the `Present sessions` numerator and `+1` in the `Eligible completed sessions` denominator while remaining filterable for punctuality reports. | [`01_PRD.md` §7.1](./01_PRD.md#71-status-definitions--formula-impact) & [`§12.1`](./01_PRD.md#121-documented-assumptions-assumption) | Affects numerator rule in `src/lib/attendance/calculator.ts` (`T-013`). |
| **`[ASSUMPTION: A-03]`** | **Excused Absence Weighting:** `EXCUSED` status is excluded (`+0`) from the `Eligible completed sessions` denominator so approved medical/institutional leave does not penalize the student's attendance percentage. | [`01_PRD.md` §7.1](./01_PRD.md#71-status-definitions--formula-impact) & [`§12.1`](./01_PRD.md#121-documented-assumptions-assumption) | Affects denominator rule in `src/lib/attendance/calculator.ts` (`T-013`). |
| **`[ASSUMPTION: A-04]`** | **Eligibility Threshold Bands:** Default exam eligibility threshold is `>= 75.00%` (`Regular`), `65.00%–74.99%` (`Warning / Condonation Zone`), and `< 65.00%` (`Critical Shortage`). | [`01_PRD.md` §7.3](./01_PRD.md#73-precision-edge-cases-and-eligibility-threshold) & [`§12.1`](./01_PRD.md#121-documented-assumptions-assumption) | Affects badge colors and shortage filter thresholds in `T-013` and `T-016`. |
| **`[ASSUMPTION: A-05]`** | **Gasless-Friendly Hybrid QR Check-In Flow:** Scanning a rotating QR code and signing with MetaMask stages the student as `PRESENT (QR Verified)` off-chain (0 gas for student) for the teacher's single batch commit, while also offering an optional EIP-712 `checkInWithTicket` direct on-chain button. | [`01_PRD.md` §12.1](./01_PRD.md#121-documented-assumptions-assumption) & [`02_TRD.md` DEC-02](./02_TRD.md#14-architecture--technical-decision-log) | Ensures live demos succeed even if student wallets have 0 Sepolia ETH. |
| **`[ASSUMPTION: A-06]`** | **Desktop-Friendly 6-Character Rotating QR PIN:** Alongside the visual SVG QR code, `/teacher/attendance/[sessionId]` displays a synchronized 6-character challenge PIN so a single developer demonstrating on one laptop can test QR check-in across browser tabs without a second mobile phone. | [`01_PRD.md` §12.1](./01_PRD.md#121-documented-assumptions-assumption) & [`03_UIUX.md` Screen 10](./03_UIUX.md#screen-10-attendance-marking--dynamic-qr-live-session) | Improves single-developer demo ergonomics (`T-015`, `T-016`). |

### 5.2 Consolidated `[OPEN QUESTION]` Registry

| ID | Open Question | Defaulted Behaviour in Spec | Source Document & Section |
| :--- | :--- | :--- | :--- |
| **`[OPEN QUESTION: OQ-01]`** | Should Dynamic QR check-in automatically transition incoming scans from `PRESENT` to `LATE` after 15 minutes, or be toggled by the teacher? | Teacher-controlled `"Mark QR scans as LATE"` toggle on `/teacher/attendance/[sessionId]` with a 15-minute reminder indicator. | [`01_PRD.md` §12.4](./01_PRD.md#124-open-questions-open-question) & [`03_UIUX.md` Screen 10](./03_UIUX.md#screen-10-attendance-marking--dynamic-qr-live-session) |
| **`[OPEN QUESTION: OQ-02]`** | Should Teachers have a time-lock (e.g., 7 days post-lecture) after which only an Admin can call `correctAttendance`? | Assigned course Teacher can submit audited `correctAttendance` transactions throughout the active semester; Admin can correct at any time. | [`01_PRD.md` §12.4](./01_PRD.md#124-open-questions-open-question) |
| **`[VERIFY WITH QUALIFIED LEGAL PROFESSIONAL]`** | Applicability of India's Digital Personal Data Protection Act, 2023 (DPDP Act) if transitioned from synthetic prototype to real student records. | Prototype strictly enforces `SYN-*` synthetic data only and salted `bytes32` pseudonymization. | [`05_SECURITY.md` §9](./05_SECURITY.md#9-privacy-compliance--india-dpdp-act-assessment) |

---

## 6. Checkpoint & Approval Status

- **Step 0 (Clarifications):** Completed (`2026-10-13`).
- **Checkpoint 1 (`01_PRD.md` & `02_TRD.md`):** Approved by user (`2026-10-13`).
- **Complete Documentation Pack (`CLAUDE.md`, `AGENTS.md`, `00_INDEX.md`–`09_MASTER_PROMPT.md`):** Completed and audited (`2026-10-13`).
- **Implementation Status:** Ready to start **Phase 0 (`T-001`)** using `/docs/09_MASTER_PROMPT.md`.
