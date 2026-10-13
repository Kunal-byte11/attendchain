# AttendChain — Decentralized, Privacy-Preserving Academic Attendance

AttendChain is an enterprise-grade academic attendance verification platform built on Ethereum smart contracts (`AttendChainRegistry.sol`), Next.js 15 (App Router), and Supabase. It eliminates attendance fraud and proxy marking using dynamic 30-second rotating cryptographic QR codes while guaranteeing **zero student personal information (PII) on-chain** through salted commitment hashes (`bytes32 studentIdHash`).

---

## 1. Quick Start & Local Run

### Prerequisites
- **Node.js:** `>= 22.0.0`
- **npm:** `>= 10.0.0`
- **MetaMask Browser Extension**

### Step-by-Step Launch Instructions

```bash
# 1. Install dependencies
npm install

# 2. Compile Solidity contracts & generate TypeChain bindings
npm run compile

# 3. Start local Hardhat EVM blockchain node (Terminal 1)
npm run node

# 4. In a new terminal, deploy contracts & seed synthetic cohorts (Terminal 2)
npm run contracts:deploy:local

# 5. Start the Next.js development server
npm run dev
```

Open **`http://localhost:3000`** in your browser to access AttendChain.

---

## 2. Complete User Journeys & Demo Runbook

### Journey 1: Administrator Onboarding & Course Setup
1. Open `http://localhost:3000/auth` and connect MetaMask with Account #0 (`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` — Default Admin).
2. Visit **`/admin`** to view institution-wide metrics and `<75%` attendance shortage alerts with CSV export.
3. Open **`/admin/students`** to register synthetic student cohorts (e.g. `SYN-2026-042`) and preview real-time `bytes32 studentIdHash` generation.
4. Open **`/admin/courses`** to create course `CS701` and assign teacher wallet `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`.

### Journey 2: Faculty Lecture Opening & 30s Dynamic QR Projector
1. Connect Account #1 (`0x7099...79C8` — Teacher) and visit **`/teacher`**.
2. Click **"Open New Lecture Session"** (`/teacher/lectures/new`) for `CS701`.
3. Open **`/teacher/attendance/[sessionId]`** to launch the live attendance marking workspace.
4. Click **"Open Dynamic QR Projector"** to start the 30-second rotating QR challenge projector with live countdown timer and 6-character accessible fallback PIN.

### Journey 3: Student Live Check-In & Subject Attendance Gauges
1. Connect Account #2 (Student) and visit **`/student`**.
2. Under **"Live Lecture Check-In"**, enter the 6-character classroom PIN projected on screen.
3. Click **"Sign & Submit Check-In"** to sign an EIP-191 personal message in MetaMask without paying gas.
4. Watch the student's status flip to `PRESENT (QR Verified)` on the Teacher's live roster.
5. Visit **`/student/history`** to inspect the chronological attendance log and visual gauge status against the mandatory 75% threshold.

### Journey 4: Independent Verification & Auditable Corrections
1. Visit **`/verify`** to cross-reference any transaction hash directly against Ethereum smart contract storage.
2. Visit **`/corrections`** to submit student attendance disputes or execute on-chain amendments (`correctAttendance`) with mandatory audit reason hashes (`reasonHash = keccak256(reasonText)`).

---

## 3. Architecture & Security Invariants

- **Zero Student PII On-Chain (`NFR-001`):** Roll numbers are mapped off-chain to `studentIdHash = keccak256(abi.encodePacked(INSTITUTION_HASH_SALT, rollNo))`.
- **EIP-712 & 35s QR TTL (`TR-008`):** QR challenge tokens rotate every 30 seconds with a strict 35s maximum expiration window to prevent photo forwarding and proxy check-ins.
- **Auditable Amendments (`FR-016`):** Closed attendance sessions cannot be deleted or overwritten; all corrections emit `AttendanceCorrected` events on Ethereum preserving the immutable audit trail.
- **Accessibility Compliance (`NFR-006`):** Meets WCAG 2.2 Level AA guidelines with zero serious/critical axe violations.

---

## 4. Test Suite Execution

```bash
# Linting & Formatting Check
npm run lint
npm run format:check
npm run typecheck

# Smart Contract Test Suite & Gas Report
npm run test:contracts

# Vitest Unit & Integration Suites
npm run test:unit
npm run test:integration

# Playwright End-to-End Journeys
npm run test:e2e

# Production Build
npm run build
```
