# 02_TRD.md — Technical Requirements Document

- **Purpose:** Specify the complete technical stack, verified dependency versions, environment configurations, smart contract compilation/deployment workflows, gas optimization strategy, indexing architecture, performance budgets, testing strategy, and repository structure for AttendChain.
- **Status:** Draft v1
- **Last updated:** 2026-10-13
- **Depends on:** `/docs/01_PRD.md`

---

## 1. Approved Technology Stack & Verified Versions

All package versions listed below were verified against the authoritative npm registry (`registry.npmjs.org`) and local system environment on `2026-10-13`. This table defines the baseline stack that will be enforced identically in `/docs/07_RULES.md`.

| Layer | Selected Technology | Verified Version | Purpose | Alternatives Considered | Rejection Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Runtime** | Node.js (LTS) | `22.23.1` (`>=22.0.0`) | JavaScript/TypeScript execution runtime for Next.js and Hardhat | Node.js 18 / Bun | Node 18 is EOL; Hardhat 2.29+ and OpenZeppelin tooling guarantee first-class support on Node 22 LTS. |
| **Package Manager** | npm | `10.9.8` (`>=10.0.0`) | Deterministic dependency installation via `package-lock.json` | pnpm, Yarn Berry | Single-package-lock monorepo/unified workspace with zero extra binary bootstrapping on student machines. |
| **Frontend & API Framework** | Next.js (App Router) | `15.5.27` | React SSR/CSR UI, App Router pages, and server-side API route handlers (`/api/*`) | Next.js 16.4.0, Vite + Express | Next.js `15.5.27` LTS provides mature App Router stability and eliminates maintaining a separate Express server process. |
| **UI Library** | React / React DOM | `19.3.0` | Component rendering and stateful interactive dashboards | Vue 3, SvelteKit | Required by Next.js 15; rich ecosystem for accessible academic dashboards. |
| **Language** | TypeScript | `5.9.3` | Static type safety across frontend, API routes, and Hardhat scripts (`strict: true`) | TypeScript 7.0.2, JavaScript | TypeScript `5.9.3` is fully compatible with `@typechain/hardhat` and Next.js ESLint parsers without bleeding-edge compiler breaking changes. |
| **Styling** | Tailwind CSS | `4.3.3` | Utility-first CSS framework mapped to AttendChain design tokens | Styled Components, MUI | Zero runtime JS overhead, strict design token alignment, and responsive layout ergonomics. |
| **Icons** | `lucide-react` | `1.55.0` | Accessible SVG iconography for academic, status, and blockchain states | Heroicons, FontAwesome | Consistent stroke weights, tree-shakeable ESM imports, and built-in ARIA prop forwarding. |
| **QR Generation** | `qrcode.react` | `4.2.0` | Client-side SVG/Canvas rendering of rotating dynamic QR codes (`FR-018`) | `qrcode` (server PNG), `react-qr-code` | Renders crisp, scalable SVG QR codes directly in the browser with zero server image-buffering latency. |
| **Smart Contract Language** | Solidity (`solc`) | `0.8.28` | EVM smart contract implementation (`AttendChainRegistry.sol`) | Solidity `0.8.37`, Vyper | Solidity `0.8.28` is the battle-tested Cancun EVM target bundled with Hardhat `2.29.1` and OpenZeppelin `5.6.1`. |
| **Contract Security Library** | `@openzeppelin/contracts` | `5.6.1` | Audited `AccessControl`, `ECDSA`, `EIP712`, and `Pausable` primitives | Custom role modifiers, Solady | OpenZeppelin `5.6.1` provides industry-standard `AccessControl` and `EIP712` signature verification. |
| **Contract Framework** | Hardhat + Toolbox | `hardhat@2.29.1` + `@nomicfoundation/hardhat-toolbox@6.1.2` | Local EVM node (`31337`), compilation, TypeChain generation, gas reporting, and Sepolia verification | Foundry, Hardhat 3.19.0 | Hardhat `2.29.1` + Toolbox `6.1.2` gives unified TypeScript test runners, TypeChain `ethers-v6` bindings, and `solidity-coverage` out of the box. |
| **Blockchain SDK** | `ethers` | `6.17.0` | EIP-1193 browser signing, EIP-712 typed data, RPC querying, and ABI encoding/decoding | `viem` + `wagmi`, `web3.js` | Requested in project brief; native integration with `@nomicfoundation/hardhat-toolbox@6.1.2` and TypeChain v6. |
| **Database & Off-Chain Store** | Supabase (`@supabase/supabase-js`) | `2.117.3` | Managed PostgreSQL storing off-chain synthetic PII, `studentIdHash` mappings, QR nonces, and indexed contract events | Firebase, MongoDB, SQLite | Relational integrity (`FOREIGN KEY` constraints), SQL views for attendance percentages, and zero-cost cloud tier for college MVP. |
| **Validation** | `zod` | `4.6.7` | Runtime schema validation for API payloads, environment variables, and RPC event decoding | Yup, Joi | First-class TypeScript type inference (`z.infer`) and strict input sanitization. |
| **Session Auth Signing** | `jose` | `6.2.12` | Edge/Node-compatible HMAC-SHA256 (`HS256`) JWT signing for `HttpOnly` SIWE session cookies and rotating QR tokens | `jsonwebtoken` | Zero native C++ dependencies; works identically in Next.js Middleware (Edge runtime) and Node API routes. |
| **Unit & Integration Testing** | `vitest` | `5.0.4` | Fast TypeScript unit and API route integration test runner with V8 coverage | Jest | Native ESM/TypeScript support without complex Babel transforms. |
| **E2E & Accessibility Testing** | `@playwright/test` + `@axe-core/playwright` | `1.64.0` + `4.13.0` | Cross-browser end-to-end user journey testing and automated WCAG 2.2 AA validation | Cypress | Supports multi-tab Teacher + Student QR simulation and mocked EIP-1193 wallet injection. |
| **Linter & Formatter** | ESLint + Prettier | `eslint@9.39.5` + `prettier@3.9.10` | Static code analysis and deterministic formatting | Biome | Standard Next.js + Solidity formatting integration. |

---

## 2. Technical Requirements Mapped to Product Requirements

| TR ID | Technical Requirement Description | Linked `FR-*` | Linked `NFR-*` | Verification Method |
| :--- | :--- | :--- | :--- | :--- |
| **TR-001** | Implement an EIP-1193 Wallet Provider Adapter using `ethers.BrowserProvider` that listens to `accountsChanged`, `chainChanged`, and `disconnect` events without page crashes. | `FR-001`, `FR-021` | `NFR-003` | Unit tests with mocked `window.ethereum` + Playwright network-switch tests. |
| **TR-002** | Implement EIP-4361 (Sign-In with Ethereum) challenge generation (`POST /api/auth/nonce`) and signature recovery (`POST /api/auth/verify` via `ethers.verifyMessage`), issuing a signed `HttpOnly`, `SameSite=Lax` JWT cookie via `jose`. | `FR-002`, `FR-004` | `NFR-005` | Vitest security integration suite testing valid, expired, replayed, and tampered signatures. |
| **TR-003** | Implement `AttendChainRegistry.sol` inheriting OpenZeppelin `AccessControl` and `EIP712`, defining `DEFAULT_ADMIN_ROLE` and `TEACHER_ROLE` with custom errors for all unauthorized calls. | `FR-003`, `FR-004` | `NFR-008` | Hardhat contract access-control test suite (`100%` modifier branch coverage). |
| **TR-004** | Compute deterministic pseudonymous student commitments off-chain as `studentIdHash = ethers.solidityPackedKeccak256(["bytes32", "string"], [INSTITUTION_HASH_SALT, canonicalRollNumber])` so raw roll numbers never leave the server. | `FR-005`, `FR-006` | `NFR-001` | Unit test verifying hash determinism and contract test scanning calldata for raw PII. |
| **TR-005** | Store courses (`courseIdHash`), assigned teacher addresses, and student enrollments (`mapping(bytes32 => mapping(bytes32 => bool))`) on-chain, supporting batch student enrollment (`enrollStudentsBatch`). | `FR-007` | `NFR-004` | Hardhat unit tests for course creation, teacher reassignment, and enrollment validation. |
| **TR-006** | Implement lecture session state machine (`NONE -> OPEN -> CLOSED` or `OPEN -> CANCELLED`) in `AttendChainRegistry.sol` with `openSession`, `closeSession`, and `cancelSession`. | `FR-008`, `FR-009` | `NFR-008` | Hardhat state transition tests verifying invalid transitions revert. |
| **TR-007** | Implement gas-optimized `recordBatchAttendance(uint256 sessionId, bytes32[] calldata studentIdHashes, uint8[] calldata statuses, bool closeAfter)` using packed structs and maximum batch size limit (`MAX_BATCH_SIZE = 100`). | `FR-010`, `FR-011` | `NFR-004` | Hardhat gas reporter verifying 50-student batch $\le 1,500,000$ gas and duplicate checks. |
| **TR-008** | Implement hybrid Dynamic QR check-in: (a) Server-issued rotating 30s token (`POST /api/sessions/[id]/qr`), (b) Student wallet-signed check-in (`POST /api/attendance/qr-checkin`) staging verified presence in Supabase, and (c) EIP-712 server-signed voucher enabling optional direct on-chain `checkInWithTicket`. | `FR-018`, `FR-019` | `NFR-005`, `NFR-003` | Hardhat EIP-712 `checkInWithTicket` tests + Vitest QR token TTL and replay tests. |
| **TR-009** | Implement auditable `correctAttendance(uint256 sessionId, bytes32 studentIdHash, uint8 newStatus, bytes32 reasonHash)` restricted to `CLOSED` sessions, incrementing `amendmentCount` and emitting `AttendanceCorrected`. | `FR-015`, `FR-016`, `FR-017` | `NFR-008` | Hardhat correction audit tests verifying preservation of original `AttendanceRecorded` logs. |
| **TR-010** | Implement a shared, pure TypeScript module `calculateAttendanceMetrics(records, sessions)` used by both backend APIs and frontend views that enforces the exact formula in `01_PRD.md` Section 7. | `FR-012`, `FR-013`, `FR-020` | `NFR-002`, `NFR-008` | Vitest parameterized unit tests covering all status combinations, rounding, and zero-division edge cases. |
| **TR-011** | Implement an idempotent Blockchain Event Sync Service (`lib/blockchain/sync.ts`) that queries contract logs (`SessionOpened`, `AttendanceRecorded`, `AttendanceCorrected`, `SessionClosed`, `SessionCancelled`) and upserts into Supabase keyed by `(chain_id, tx_hash, log_index)`. | `FR-012`, `FR-015` | `NFR-002`, `NFR-007` | Integration test re-running event sync 3 times on identical block logs and asserting zero duplicates. |
| **TR-012** | Implement a direct RPC Verification Service (`lib/blockchain/verify.ts`) that fetches `eth_getTransactionReceipt` and `getAttendanceRecord(sessionId, studentIdHash)` directly from the RPC provider and diffs them against the Supabase row. | `FR-014` | `NFR-003` | Integration test simulating both a valid record match and a tampered database row (`MISMATCH`). |
| **TR-013** | Implement an RPC Provider Wrapper with primary and fallback JSON-RPC endpoints (`ethers.FallbackProvider` / sequential retry with exponential backoff) and local `sessionStorage` pending-transaction recovery. | `FR-021`, `FR-022` | `NFR-002`, `NFR-003` | Unit test mocking primary RPC `429`/`503` failure and verifying automatic failover to secondary RPC. |

---

## 3. Why an Off-Chain Database & Indexer Are Required

A core architectural principle of AttendChain is **never using an EVM smart contract as a general-purpose relational database**. Supabase (PostgreSQL) and the Event Sync Service are required for four technical reasons:

1. **Privacy Mandate (`NFR-001`):** Student names, university roll numbers, email addresses, and full text correction reasons must never be written to a public blockchain. PostgreSQL stores the off-chain identity table (`students`) that maps a human-readable student profile to its on-chain `studentIdHash`.
2. **Prohibitive Cost & Latency of On-Chain Relational Queries:** Querying "all sessions across 5 courses for 60 students over a 40-lecture semester" directly from EVM storage or unindexed `eth_getLogs` across thousands of Sepolia blocks triggers RPC rate limits (`10,000` block range caps on free public RPCs) and takes 3–15 seconds per page load. Indexed PostgreSQL queries execute in $<50\text{ ms}$ (`NFR-002`).
3. **Ephemeral State Coordination:** SIWE authentication nonces, 30-second rotating QR tokens, staged QR check-ins awaiting a teacher's batch commit, and student-submitted dispute requests are ephemeral coordination states that do not belong on-chain prior to finalization.
4. **Trustless Verification Preserved:** Using PostgreSQL for fast read queries does **not** weaken decentralization or auditability because every finalized attendance row stores its `tx_hash`, `block_number`, and `log_index`, and the `/verify` page (`TR-012`) bypasses the database to verify records directly against the Ethereum Sepolia / Hardhat RPC node.

---

## 4. Environment Matrix & Blockchain Network Configurations

### 4.1 Environment Definitions

| Environment | Blockchain Network | Chain ID | Database Instance | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Development (`local`)** | Hardhat Local Node (`http://127.0.0.1:8545`) | `31337` (`0x7a69`) | Local Supabase CLI / Dev Supabase Project | Fast iterative development, instant auto-mined blocks (`<100ms`), pre-funded test accounts, synthetic seed data. |
| **Automated Test (`test`)** | Hardhat In-Memory EVM & Vitest Mocked RPC | `31337` | Ephemeral Test Schema / Mocked Supabase Client | Deterministic CI execution of contract tests, unit tests, and Playwright E2E flows. |
| **Staging / Demo (`sepolia`)** | Ethereum Sepolia Testnet | `11155111` (`0xaa36a7`) | Dedicated Staging Supabase Project (Synthetic Data Only) | Public testnet verification, Etherscan contract verification, and live academic evaluation demo. |
| **Production (`prod-mvp`)** | Ethereum Sepolia Testnet *(Mainnet explicitly out of scope)* | `11155111` (`0xaa36a7`) | Production-configured Supabase Project (RLS enabled, Synthetic Data Only) | Final hosted Vercel/Node MVP build connected to verified Sepolia contract. |

### 4.2 Blockchain Network & RPC Configuration

- **Local Hardhat Configuration (`hardhat.config.ts`):**
  - `chainId: 31337`
  - Mining mode: Automine enabled (`mining: { auto: true, interval: 0 }`) for development; configurable interval (`2000ms`) for testing pending-transaction UI states (`NFR-003`).
  - Deterministic accounts: 20 pre-funded test accounts (`10,000 ETH` each) mapped to Demo Admin (`Account #0`), Demo Teachers (`Accounts #1–#2`), and Demo Students (`Accounts #3–#10`).
- **Ethereum Sepolia Testnet Configuration:**
  - `chainId: 11155111` (`0xaa36a7`)
  - Block explorer: `https://sepolia.etherscan.io`
  - RPC Provider Requirements & Quotas:
    - Primary RPC: Alchemy or Infura Sepolia HTTPS endpoint (`NEXT_PUBLIC_SEPOLIA_RPC_PRIMARY_URL`). Typical free tier quota: `300M compute units/month`, `~25 req/sec`.
    - Fallback RPC: Secondary independent provider (e.g., QuickNode, Ankr, or PublicNode Sepolia HTTPS endpoint `NEXT_PUBLIC_SEPOLIA_RPC_FALLBACK_URL`).
  - Failover Behaviour (`TR-013`): Read operations wrap primary and fallback `JsonRpcProvider` instances. If the primary endpoint returns HTTP `429`, `5xx`, or times out after `4,000ms`, the client automatically retries once on the fallback RPC and logs a structured `RPC_FAILOVER_TRIGGERED` diagnostic event.

### 4.3 Wallet Compatibility & Network-Switching Behaviour

1. **Supported Wallets:** Any browser wallet implementing **EIP-1193** (`window.ethereum`) and **EIP-6963** provider discovery, with **MetaMask** (`v11+` / `v12+`) as the primary verified target.
2. **Automatic Network Detection:** On initial connection and on every `chainChanged` event, the frontend checks whether `chainId` matches the active environment target (`31337` or `11155111`).
3. **One-Click Network Switching:** If a mismatch is detected:
   - All write buttons (`Open Session`, `Commit Attendance`, `Submit Correction`) are disabled.
   - A high-visibility banner offers **"Switch to Ethereum Sepolia"** (or **"Switch to Hardhat Local"**).
   - Clicking invokes `window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetHexChainId }] })`.
   - If MetaMask returns error code `4902` (chain not added), the client automatically invokes `wallet_addEthereumChain` with the configured chain name, native currency (`SEP` / `ETH`), RPC URL, and block explorer URL.

---

## 5. Smart Contract Compilation, Deployment, and Verification Workflows

1. **Compilation & Type Generation:**
   - Command: `npm run contracts:compile` (`npx hardhat compile`)
   - Compiler settings: Solidity `0.8.28`, Optimizer enabled (`enabled: true, runs: 200`), `evmVersion: "cancun"`.
   - Output: Artifacts written to `blockchain/artifacts/` and strongly-typed Ethers v6 bindings generated in `blockchain/typechain-types/` and exported to `src/lib/blockchain/abi/`.
2. **Deployment Workflow (Hardhat Ignition / Scripted Deploy):**
   - Local deployment: `npm run contracts:deploy:local` deploys `AttendChainRegistry` to `127.0.0.1:8545`, seeds synthetic courses/roles (`npm run db:seed`), and writes the deployed address to `.env.local` deployment manifest.
   - Sepolia deployment: `npm run contracts:deploy:sepolia` deploys `AttendChainRegistry` using `DEPLOYER_PRIVATE_KEY` (loaded strictly from process environment, never committed), waits for **2 block confirmations**, and records the deployment metadata (`contractAddress`, `deployTxHash`, `blockNumber`, `chainId`) in `deployments/sepolia.json`.
3. **Etherscan Verification Workflow:**
   - Command: `npm run contracts:verify:sepolia` (`npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>`)
   - Uses `ETHERSCAN_API_KEY` to publish verified Solidity source code and ABI on `sepolia.etherscan.io` so any student or evaluator can inspect the contract and read storage directly on Etherscan.

---

## 6. Gas Efficiency & Smart Contract Optimization Strategy

Because classroom cohorts typically contain 30 to 100 students, naive smart contract design would make on-chain attendance prohibitively expensive and slow. `AttendChainRegistry.sol` enforces five specific gas optimizations:

1. **Single-Transaction Batch Attendance (`recordBatchAttendance`):**
   - Rather than submitting $N$ separate transactions per lecture ($N \times 21,000$ base gas overhead), the teacher submits one transaction containing `bytes32[] calldata studentIdHashes` and `uint8[] calldata statuses`.
   - Base transaction cost (`21,000 gas`) and session validation SLOADs are paid **once per lecture** instead of once per student.
2. **Single-Slot Struct Packing (`256 bits`):**
   - On-chain `AttendanceRecord` struct is tightly packed into a **single 32-byte EVM storage slot** (matching `04_ARCHITECTURE.md` Section 4.1):
     - `address updatedBy` (20 bytes: wallet address of the teacher, student, or admin who recorded/amended the entry)
     - `uint40 recordedAt` (5 bytes: initial Unix timestamp, valid until year 36,812)
     - `uint40 amendedAt` (5 bytes: Unix timestamp of the latest correction, or `0` if unamended)
     - `uint8 status` (1 byte: `0=NONE, 1=PRESENT, 2=ABSENT, 3=LATE, 4=EXCUSED`)
     - `uint8 amendmentCount` (1 byte: number of post-closure corrections, saturating at `255`)
   - Packing `20B + 5B + 5B + 1B + 1B = 32 bytes` ensures every student's attendance record requires **exactly 1 `SSTORE` (`20,000 gas` cold / `2,900 gas` warm)** instead of 3–4 separate storage slots (`60,000+ gas` per student).
3. **`calldata` Parameters & Unchecked Loop Increments:**
   - All batch arrays use `calldata` instead of `memory` to avoid memory expansion and copy costs, and loop counters use `unchecked { ++i; }` after bounds checking.
4. **Custom Solidity Errors Instead of Revert Strings:**
   - Uses custom errors (e.g., `error SessionNotOpen(uint256 sessionId);`, `error AttendanceAlreadyRecorded(uint256 sessionId, bytes32 studentIdHash);`) to reduce deployment bytecode size and revert gas overhead.
5. **Hashes Instead of Dynamic Strings On-Chain:**
   - Course titles, lecture topics, and correction explanations are stored on-chain strictly as fixed 32-byte `bytes32` keccak256 hashes (`courseIdHash`, `metadataHash`, `reasonHash`), avoiding multi-slot dynamic `string` storage.

### Gas Budget Table

| Operation | Contract Function | Target Gas Limit | Measured By |
| :--- | :--- | :--- | :--- |
| Grant/Revoke Teacher Role | `grantTeacherRole` / `revokeTeacherRole` | $\le 65,000\text{ gas}$ | Hardhat Gas Reporter |
| Create Course | `createCourse` | $\le 95,000\text{ gas}$ | Hardhat Gas Reporter |
| Batch Enroll 50 Students | `enrollStudentsBatch` (50 hashes) | $\le 1,250,000\text{ gas}$ | Hardhat Gas Reporter |
| Open Lecture Session | `openSession` | $\le 110,000\text{ gas}$ | Hardhat Gas Reporter |
| **Batch Mark 50 Students + Close** | `recordBatchAttendance` (50 students) | **$\le 1,500,000\text{ gas}$** (`NFR-004`) | Hardhat Gas Reporter |
| Direct Student QR Check-In | `checkInWithTicket` (1 student, EIP-712) | $\le 85,000\text{ gas}$ | Hardhat Gas Reporter |
| Auditable Attendance Correction | `correctAttendance` (1 record) | $\le 55,000\text{ gas}$ | Hardhat Gas Reporter |

---

## 7. Performance Budgets (Application vs. Blockchain Separation)

Because public blockchain block inclusion times depend on network consensus and gas markets outside application control, AttendChain defines **strictly separated performance budgets**:

### 7.1 Off-Chain Application & API Performance Budgets (Guaranteed by Application)

| Metric | Target Budget | Measurement Condition |
| :--- | :--- | :--- |
| **Initial Dashboard Page Load (LCP)** | $\le 2.0\text{ seconds}$ | Broadband / local network, reading indexed data from Supabase |
| **Read API Latency (`GET /api/*`)** | $\text{p95} \le 300\text{ ms}$ | Fetching courses, session rosters, or student attendance percentages |
| **Write API Latency (Off-chain Auth / QR Validation)** | $\text{p95} \le 250\text{ ms}$ | `POST /api/auth/verify` and `POST /api/attendance/qr-checkin` |
| **UI State Transition on Wallet Action** | $\le 150\text{ ms}$ | Transitioning button/banner to `Awaiting Signature` or `Broadcasted (Pending)` |
| **QR Code Rotation Render Time** | $\le 100\text{ ms}$ | Generating and rendering new 30-second QR challenge SVG |

### 7.2 Blockchain Transaction Lifecycle Expectations (External Network Dependent)

| Network | Broadcast to `txHash` Receipt | Expected 1-Block Confirmation | UI Timeout / Stuck-Tx Escalation Threshold |
| :--- | :--- | :--- | :--- |
| **Local Hardhat (`31337`)** | $\le 100\text{ ms}$ | $\le 500\text{ ms}$ (Automine) | $5\text{ seconds}$ |
| **Ethereum Sepolia (`11155111`)** | $\le 1.5\text{ seconds}$ (RPC mempool accept) | $12\text{ to }36\text{ seconds}$ (1–3 blocks) | After **$45\text{ seconds}$** pending, UI displays `"Sepolia network is congested — View on Etherscan or Speed Up in MetaMask"` while continuing background polling. |

---

## 8. Testing Strategy & Coverage Targets

| Test Layer | Tooling | Scope | Coverage Target & Gate |
| :--- | :--- | :--- | :--- |
| **1. Smart Contract Unit & Security Tests** | Hardhat + Mocha/Chai + `@nomicfoundation/hardhat-network-helpers` + `solidity-coverage` | Role access control, course enrollment, session lifecycle (`OPEN`/`CLOSED`/`CANCELLED`), batch marking, duplicate prevention, EIP-712 `checkInWithTicket` replay/expiry, `correctAttendance` audit logs, gas limits, and zero-PII calldata verification. | **$\ge 95\%$ statement coverage, $\ge 90\%$ branch coverage** on `AttendChainRegistry.sol`. Mandatory CI gate. |
| **2. Core Logic & Utility Unit Tests** | `vitest` (`v5.0.4`) | Attendance percentage calculator (`TR-010`), `studentIdHash` salted hashing (`TR-004`), QR challenge token signing/TTL validation, Zod input validators, and RPC failover wrapper (`TR-013`). | **$\ge 90\%$ line & branch coverage** across `src/lib/**`. Mandatory CI gate. |
| **3. API Route & Security Integration Tests** | `vitest` | Next.js `/api/*` handlers: SIWE nonce/signature verification, replay rejection, RBAC (`401`/`403` enforcement), idempotent event sync (`TR-011`), and direct RPC verification diffing (`TR-012`). | **$\ge 85\%$ line coverage** across `src/app/api/**`; 100% of write endpoints tested for unauthorized access. |
| **4. End-to-End (E2E) & Accessibility Tests** | `@playwright/test` + `@axe-core/playwright` | All 4 core journeys from `01_PRD.md` against local Hardhat node + mocked EIP-1193 wallet provider, plus automated WCAG 2.2 AA accessibility scans on all 14 routes. | **100% pass rate** on core journeys; **0 critical or serious axe-core violations** (`NFR-006`). |

### How Coverage Is Measured
- **Smart Contracts:** Run `npm run test:contracts:coverage` (`npx hardhat coverage`), which outputs `coverage/coverage-summary.json` and enforces thresholds via script check.
- **Application Code:** Run `npm run test:coverage` (`npx vitest run --coverage`), configured with `@vitest/coverage-v8` enforcing thresholds `{ lines: 90, branches: 85, functions: 90, statements: 90 }` on `src/lib/**`.

---

## 9. Deployment Strategy & CI/CD Pipeline

### 9.1 CI Pipeline (`.github/workflows/ci.yml`)
Triggered on every pull request and push to `main`:
1. **`lint-and-typecheck`:** Runs `npm ci`, `npm run lint` (ESLint), `npm run format:check` (Prettier), and `npm run typecheck` (`tsc --noEmit`).
2. **`contract-tests-and-gas`:** Compiles Solidity contracts, runs Hardhat unit/security tests, verifies gas budgets (`REPORT_GAS=true`), and enforces `solidity-coverage` thresholds.
3. **`unit-and-integration-tests`:** Runs Vitest unit and API integration tests with coverage gates.
4. **`e2e-and-a11y`:** Starts a background Hardhat local node (`npx hardhat node`), deploys `AttendChainRegistry`, seeds synthetic test data, builds the Next.js production bundle (`npm run build`), and runs Playwright E2E + Axe accessibility tests.

### 9.2 Application Deployment Strategy
- **Smart Contract:** Deployed to Ethereum Sepolia (`11155111`) and verified on Sepolia Etherscan; contract address committed to `src/lib/blockchain/deployments.json`.
- **Web Application & API:** Deployed to **Vercel** (or self-hosted Docker/Node 22 server) connected to the Staging/Demo Supabase PostgreSQL instance and Sepolia RPC endpoints.

---

## 10. Logging, Monitoring, Metrics, and Transaction Diagnostics

1. **Structured JSON Logging (`src/lib/logger.ts`):**
   - All server and client diagnostic logs emit structured objects containing `{ timestamp, level, eventCode, chainId, sessionId?, txHash?, correlationId, message }`.
2. **Strict PII & Secret Redaction Rule:**
   - Logger automatically strips or blocks keys matching `privateKey`, `mnemonic`, `secret`, `cookie`, `authorization`, `studentName`, `rollNumber`, and `email`. Only pseudonymous `studentIdHash` and public `txHash` / wallet addresses may appear in logs.
3. **Transaction Diagnostics Panel:**
   - Every transaction modal and the `/settings` screen provides a collapsible **"Transaction Diagnostics"** drawer showing: `chainId`, `contractAddress`, `functionName`, `txHash`, `blockNumber`, `gasUsed`, `rpcEndpointStatus` (`Primary Healthy` / `Fallback Active`), and decoded custom revert reason if a transaction fails.

---

## 11. Proposed Repository Folder Structure

```text
/
├── CLAUDE.md
├── AGENTS.md
├── docs/
│   ├── 00_INDEX.md
│   ├── 01_PRD.md
│   ├── 02_TRD.md
│   ├── 03_UIUX.md
│   ├── 04_ARCHITECTURE.md
│   ├── 05_SECURITY.md
│   ├── 06_TICKETS.md
│   ├── 07_RULES.md
│   ├── 08_PHASES.md
│   └── 09_MASTER_PROMPT.md
├── blockchain/
│   ├── contracts/
│   │   └── AttendChainRegistry.sol
│   ├── ignition/
│   │   └── modules/
│   │       └── AttendChainRegistry.ts
│   ├── scripts/
│   │   ├── deploy-and-seed.ts
│   │   └── verify-sepolia.ts
│   └── test/
│       └── AttendChainRegistry.test.ts
├── supabase/
│   ├── migrations/
│   │   └── 0001_initial_schema.sql
│   └── seed.sql
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx                     # 1. Landing Page
│   │   │   ├── auth/page.tsx                # 2. Wallet Connection & SIWE Auth
│   │   │   └── verify/page.tsx              # 12. Independent Transaction Verification
│   │   ├── (dashboard)/
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx                 # 3. Admin Dashboard
│   │   │   │   ├── students/page.tsx        # 6. Student Registration
│   │   │   │   ├── roles/page.tsx           # 7. Teacher & Role Management
│   │   │   │   └── courses/page.tsx         # 8. Course & Subject Management
│   │   │   ├── teacher/
│   │   │   │   ├── page.tsx                 # 4. Teacher Dashboard
│   │   │   │   ├── lectures/new/page.tsx    # 9. Lecture Creation
│   │   │   │   └── attendance/[sessionId]/page.tsx # 10. Attendance Marking & Live QR
│   │   │   ├── student/
│   │   │   │   ├── page.tsx                 # 5. Student Dashboard
│   │   │   │   └── history/page.tsx         # 11. Attendance History
│   │   │   ├── corrections/page.tsx         # 13. Correction & Dispute History
│   │   │   └── settings/page.tsx            # 14. Settings & Network Information
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── nonce/route.ts
│   │       │   ├── verify/route.ts
│   │       │   └── logout/route.ts
│   │       ├── students/route.ts
│   │       ├── roles/route.ts
│   │       ├── courses/route.ts
│   │       ├── sessions/
│   │       │   ├── route.ts
│   │       │   └── [sessionId]/qr/route.ts
│   │       ├── attendance/
│   │       │   ├── route.ts
│   │       │   ├── qr-checkin/route.ts
│   │       │   └── corrections/route.ts
│   │       ├── sync/route.ts
│   │       └── verify/route.ts
│   ├── components/
│   │   ├── ui/                              # Design system primitives
│   │   ├── web3/                            # Wallet, NetworkBanner, TxStatusModal
│   │   └── attendance/                      # RosterTable, DynamicQrModal, PercentageCard
│   ├── lib/
│   │   ├── auth/                            # SIWE verifier, JWT session helpers
│   │   ├── attendance/                      # Pure percentage calculator, QR token logic
│   │   ├── blockchain/                      # Ethers providers, ABI, sync, direct verifier
│   │   ├── db/                              # Supabase client & typed queries
│   │   ├── validation/                      # Zod schemas
│   │   └── logger.ts                        # Redacted structured logger
│   └── types/
│       └── index.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── hardhat.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

---

## 12. Approved Environment Variable Names (Names Only — Never Values)

No secret value, private key, mnemonic, or real API key may ever be committed to git or printed in logs. `.env.example` will declare only the following variable names:

| Variable Name | Visibility | Required In | Purpose |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_DEFAULT_CHAIN_ID` | Public (`NEXT_PUBLIC_*`) | All | Target chain ID (`31337` for local, `11155111` for Sepolia) |
| `NEXT_PUBLIC_HARDHAT_RPC_URL` | Public (`NEXT_PUBLIC_*`) | Local / Test | Local Hardhat JSON-RPC URL (`http://127.0.0.1:8545`) |
| `NEXT_PUBLIC_SEPOLIA_RPC_PRIMARY_URL` | Public (`NEXT_PUBLIC_*`) | Staging / Prod | Primary Ethereum Sepolia HTTPS JSON-RPC URL |
| `NEXT_PUBLIC_SEPOLIA_RPC_FALLBACK_URL` | Public (`NEXT_PUBLIC_*`) | Staging / Prod | Fallback Ethereum Sepolia HTTPS JSON-RPC URL |
| `NEXT_PUBLIC_CONTRACT_ADDRESS_LOCAL` | Public (`NEXT_PUBLIC_*`) | Local / Test | Deployed `AttendChainRegistry` address on Hardhat |
| `NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA` | Public (`NEXT_PUBLIC_*`) | Staging / Prod | Deployed `AttendChainRegistry` address on Sepolia |
| `NEXT_PUBLIC_SEPOLIA_EXPLORER_URL` | Public (`NEXT_PUBLIC_*`) | All | Block explorer base URL (`https://sepolia.etherscan.io`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Public (`NEXT_PUBLIC_*`) | All | Supabase project REST endpoint URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (`NEXT_PUBLIC_*`) | All | Supabase public anonymous key (restricted by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-Only Secret** | Server API | Supabase administrative key used strictly inside server API routes |
| `AUTH_JWT_SECRET` | **Server-Only Secret** | Server API | 256-bit secret for signing SIWE session cookies and rotating QR tokens |
| `INSTITUTION_HASH_SALT` | **Server-Only Secret** | Server API | 32-byte hex salt used to compute pseudonymous `studentIdHash` values |
| `QR_TICKET_SIGNER_PRIVATE_KEY` | **Server-Only Secret** | Server API | Dedicated non-funded server signing key for EIP-712 `checkInWithTicket` vouchers |
| `DEPLOYER_PRIVATE_KEY` | **CLI/CD Secret Only** | Hardhat CLI | Testnet deployer wallet key used only during `contracts:deploy:sepolia` |
| `ETHERSCAN_API_KEY` | **CLI/CD Secret Only** | Hardhat CLI | API key for verifying contract source code on Sepolia Etherscan |

---

## 13. Technical Risks & Mitigations

| Risk ID | Technical Risk | Severity | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **TR-RISK-01** | **Public Correlation of Student Wallet Addresses on Sepolia:** If a student calls `checkInWithTicket` directly from their personal wallet, an observer could link that wallet's transactions across sessions. | Medium | On-chain storage keys records strictly by salted `studentIdHash` (`bytes32`). In addition, the default QR check-in flow stages the student's verified signature off-chain and commits via the Teacher's single `recordBatchAttendance` transaction (`[ASSUMPTION: A-05]`), so student wallet addresses do not even need to submit on-chain transactions unless the student explicitly chooses direct submission. |
| **TR-RISK-02** | **Sepolia RPC Rate Limiting (`429`) During Batch Event Queries:** Querying thousands of blocks via `eth_getLogs` on free RPC tiers fails. | High | Store `last_synced_block` in Supabase, query logs in bounded chunks ($\le 2,000$ blocks), trigger targeted single-transaction receipt indexing (`eth_getTransactionReceipt(txHash)`) immediately after any UI transaction confirms, and automatically fail over to `NEXT_PUBLIC_SEPOLIA_RPC_FALLBACK_URL`. |
| **TR-RISK-03** | **Batch Size Exceeding Block Gas Limit:** Attempting to mark 1,000 students in a single transaction could hit wallet or block gas limits. | Low | Enforce `MAX_BATCH_SIZE = 100` in the smart contract (`100 students` $\approx 2.8\text{M gas}$, well below the $30\text{M}$ block limit) and automatically chunk larger cohorts in the frontend if a course ever exceeds 100 students. |
| **TR-RISK-04** | **Clock Skew Between Teacher Browser, Server, and EVM Block Timestamp:** Could cause premature QR token rejection. | Medium | Generate and validate 30-second QR challenge timestamps using a single authoritative clock (the Next.js backend server) with a $\pm 5\text{-second}$ grace window, and validate EIP-712 on-chain deadlines with a $10\text{-minute}$ buffer controlled by session state (`OPEN`). |

---

## 14. Architecture & Technical Decision Log

| Decision ID | Decision Topic | Alternatives Considered | Selected Option | Rationale | Consequences |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DEC-01** | **On-Chain Student Identifier Format** | (A) Raw `address studentWallet`, (B) Plaintext Roll Number string, (C) Salted `bytes32 studentIdHash` | **(C) Salted `bytes32 studentIdHash`** | Satisfies zero-PII on-chain (`NFR-001`), prevents public wallet-schedule correlation, and allows teachers to record on-chain attendance for all enrolled students immediately—even before every student has configured MetaMask. | Requires Supabase mapping table to resolve `studentIdHash` back to synthetic display names for authorized users. |
| **DEC-02** | **Attendance Submission & Gas Model** | (A) Every student sends an on-chain tx per class, (B) Teacher batch tx only, (C) Hybrid Teacher Batch (`recordBatchAttendance`) + Dynamic QR (Off-chain signed staging + optional EIP-712 `checkInWithTicket`) | **(C) Hybrid Teacher Batch + Dynamic QR** | Eliminates the requirement for 60 students to acquire Sepolia ETH before every lecture while supporting both live QR check-in and direct on-chain verification. | Contract implements both `recordBatchAttendance` and EIP-712 `checkInWithTicket`. |
| **DEC-03** | **On-Chain Storage Packing** | (A) Unpacked struct with strings and `uint256` timestamps, (B) Single-slot 32-byte packed `AttendanceRecord` struct + `bytes32` reason hashes in events | **(B) Single-slot 32-byte packed struct** | Reduces per-student storage write cost by ~65% (1 `SSTORE` per student instead of 3–4), comfortably meeting the $\le 1.5\text{M gas}$ target for 50 students (`NFR-004`). | Full human-readable correction reason text is stored in Supabase and verified against the on-chain `bytes32 reasonHash`. |
| **DEC-04** | **Off-Chain Backend & Indexer** | (A) Pure client-side RPC reads only, (B) The Graph custom subgraph, (C) Next.js App Router API + Supabase PostgreSQL + Idempotent Receipt/Event Sync | **(C) Next.js API + Supabase PostgreSQL** | Delivers $<300\text{ ms}$ dashboard queries (`NFR-002`), manages SIWE nonces and rotating QR challenges securely, and avoids external subgraph deployment delays during a 12-day timeline. | Requires idempotent sync logic (`TR-011`) and direct RPC verification (`TR-012`) to detect any DB-vs-chain discrepancy. |
| **DEC-05** | **Authentication Mechanism** | (A) Trust `eth_requestAccounts` address directly, (B) Supabase Email/Password only, (C) EIP-4361 (SIWE) signed nonce challenge + `HttpOnly` JWT cookie | **(C) EIP-4361 Signed Nonce + `HttpOnly` JWT** | Prevents trivial client-side wallet address spoofing (`FR-002`, `NFR-005`) while maintaining stateless, verifiable session security across API routes. | Users must sign a free off-chain message in MetaMask once per session login. |
