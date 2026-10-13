# 07_RULES.md — AI Agent Constitution & Engineering Standards

- **Purpose:** Establish the binding engineering constitution, exact dependency stack lock, module boundaries, security/privacy guardrails, Git workflow, and Definition of Done for all AI coding agents working on AttendChain.
- **Status:** Draft v1
- **Last updated:** 2026-10-13
- **Depends on:** `/docs/01_PRD.md`, `/docs/02_TRD.md`, `/docs/03_UIUX.md`, `/docs/04_ARCHITECTURE.md`, `/docs/05_SECURITY.md`, `/docs/06_TICKETS.md`

---

## 1. Core Directives: ALWAYS vs. NEVER

### 1.1 ALWAYS
1. **Read the Documentation First:** Read `/docs/07_RULES.md` and `/docs/09_MASTER_PROMPT.md` before inspecting or modifying any file.
2. **Work Only on the Assigned Ticket:** Execute strictly the single next `TODO` ticket in `/docs/06_TICKETS.md` within the currently approved phase of `/docs/08_PHASES.md`, and stop immediately after completing that ticket.
3. **Follow Approved Architecture & Technology Decisions:** Adhere to the exact data models (`04_ARCHITECTURE.md`), calculation formula (`01_PRD.md` Section 7), and stack lock (Section 2 below).
4. **Use TypeScript Strict Mode Everywhere:** Maintain `"strict": true` and `"noUncheckedIndexedAccess": true` across all `.ts` and `.tsx` files; `any` and `@ts-ignore` are prohibited.
5. **Validate All Untrusted Inputs:** Parse every API request body, query string, environment variable, and external RPC response through a strict `zod` schema (`src/lib/validation/`).
6. **Enforce Authorization on Backend & Smart Contract:** Never rely on UI route hiding for security; enforce role and course-ownership checks inside Next.js API handlers (`src/lib/auth/`) and Solidity modifiers (`AttendChainRegistry.sol`).
7. **Keep Personal Information Strictly Off-Chain:** Represent students on-chain exclusively via salted `bytes32 studentIdHash` (`keccak256(INSTITUTION_HASH_SALT, canonicalRollNo)`) and correction notes via `bytes32 reasonHash`.
8. **Write Automated Tests with Every Feature:** Implement unit, integration, contract, or E2E tests alongside the ticket code before marking any ticket `DONE`.
9. **Report Assumptions, Blockers, Test Results, and Deviations:** Output the mandatory Ticket Completion Report (Section 6) with real terminal output at the end of every ticket.

### 1.2 NEVER
1. **Never Write Implementation Code Before Documentation Approval:** Do not create application source files until the documentation checkpoint is approved and a ticket is active.
2. **Never Invent Package Names, APIs, Environment Variables, or Blockchain Capabilities:** Use only the approved stack and environment variable names declared in `02_TRD.md`.
3. **Never Put Private Keys, Seed Phrases, Secrets, or Personal Data in Source Control or Logs:** Never commit `.env.local`, hardcode test private keys in production configs, or log unredacted student PII.
4. **Never Silently Change or Delete Attendance History:** Post-closure attendance changes must execute `correctAttendance` on-chain, preserving the original `AttendanceRecorded` event and emitting `AttendanceCorrected`.
5. **Never Assume a Connected Wallet Is Authenticated or Authorized:** `eth_requestAccounts` alone grants zero access; require a verified EIP-4361 SIWE signature and valid `HttpOnly` session cookie.
6. **Never Skip Tests or Disable Security Checks to Make a Build Pass:** Do not use `.skip`, lower coverage thresholds, disable ESLint rules globally, or bypass Zod validation.
7. **Never Perform Unrelated Refactors or Scope Expansion:** Touch only the files required by the current ticket.
8. **Never Claim Production Readiness Without Verification:** Clearly preserve the prototype-vs-production distinctions documented in `05_SECURITY.md` Section 11.

---

## 2. Stack Lock (Exact Parity with `02_TRD.md` Section 1)

### 2.1 Approved Dependencies Table

| Layer | Package / Tool | Verified Version | Purpose | Usage Boundary |
| :--- | :--- | :--- | :--- | :--- |
| **Runtime** | Node.js (LTS) | `22.23.1` (`>=22.0.0`) | JS/TS runtime | Server, CLI, and Hardhat tasks |
| **Package Manager** | `npm` | `10.9.8` (`>=10.0.0`) | Dependency management | Root workspace (`package-lock.json`) |
| **Frontend & API** | `next` | `15.5.27` | App Router UI & API Route Handlers | `src/app/**`, `src/middleware.ts` |
| **UI Library** | `react` / `react-dom` | `19.3.0` | Component rendering | `src/app/**`, `src/components/**` |
| **Language** | `typescript` | `5.9.3` | Static type checking (`strict: true`) | Entire repository |
| **Styling** | `tailwindcss` | `4.3.3` | Utility CSS & design tokens | `src/app/**`, `src/components/**` |
| **Icons** | `lucide-react` | `1.55.0` | Accessible SVG icons | `src/components/**` |
| **QR Rendering** | `qrcode.react` | `4.2.0` | Client-side rotating SVG QR code | `src/components/attendance/DynamicQrProjector.tsx` |
| **Smart Contracts** | `solc` (via Hardhat) | `0.8.28` | Solidity compiler (`evmVersion: "cancun"`) | `blockchain/contracts/**` |
| **Contract Library** | `@openzeppelin/contracts` | `5.6.1` | `AccessControl`, `ECDSA`, `EIP712` | `blockchain/contracts/AttendChainRegistry.sol` |
| **Contract Tooling** | `hardhat` + `@nomicfoundation/hardhat-toolbox` | `2.29.1` + `6.1.2` | Local EVM node, compilation, TypeChain, tests, coverage | `blockchain/**`, `hardhat.config.ts` |
| **Blockchain SDK** | `ethers` | `6.17.0` | EIP-1193 wallet, EIP-712 signing, RPC calls, ABI decoding | `src/lib/blockchain/**`, `blockchain/**` |
| **Database Client** | `@supabase/supabase-js` | `2.117.3` | PostgreSQL off-chain storage & indexing | `src/lib/db/**`, `src/app/api/**` |
| **Validation** | `zod` | `4.6.7` | Runtime input, env, and event validation | `src/lib/validation/**`, `src/app/api/**` |
| **JWT & Token Signing** | `jose` | `6.2.12` | Edge/Node `HS256` SIWE session cookies & QR tokens | `src/lib/auth/**`, `src/lib/attendance/qr-token.ts` |
| **Unit/Integration Test** | `vitest` | `5.0.4` | Fast TS unit & API integration tests + V8 coverage | `tests/unit/**`, `tests/integration/**` |
| **E2E & A11y Test** | `@playwright/test` + `@axe-core/playwright` | `1.64.0` + `4.13.0` | Browser journey E2E & WCAG 2.2 AA scans | `tests/e2e/**` |
| **Lint & Format** | `eslint` + `prettier` | `9.39.5` + `3.9.10` | Code quality & formatting | Entire repository |

### 2.2 Banned Dependencies & Justification

| Banned Package / Category | Justification for Ban |
| :--- | :--- |
| `web3` (`web3.js`), `viem`, `wagmi` | `ethers@6.17.0` is the single approved EVM library (`02_TRD.md`); mixing multiple Web3 SDKs bloats bundle size and creates conflicting provider state. |
| `jsonwebtoken`, `bcrypt` (native C++) | Breaks Next.js Edge Middleware execution (`src/middleware.ts`); use `jose@6.2.12` and Web Crypto / Node `crypto` instead. |
| `prisma`, `typeorm`, `drizzle-orm` | Direct `@supabase/supabase-js` (`2.117.3`) + SQL migrations in `supabase/migrations/` avoids dual schema drift and binary engine compilation delays. |
| `moment` | Deprecated and heavy; use native `Intl.DateTimeFormat` and UTC ISO-8601 strings / Unix timestamps. |
| `axios` | Native `fetch` is built into Node 22 and Next.js 15. |

> **Stack Change Rule:** You must stop and ask for explicit user approval before running `npm install <pkg>` for any package not listed in Section 2.1.

---

## 3. Engineering Standards

### 3.1 Code Style, Naming, and Module Boundaries
- **Files & Directories:** `kebab-case.ts` for utilities/routes (`qr-token.ts`, `tx-manager.ts`); `PascalCase.tsx` for React components (`DynamicQrProjector.tsx`, `VerificationDiffCard.tsx`); `PascalCase.sol` for Solidity contracts (`AttendChainRegistry.sol`).
- **Solidity Conventions:** Custom errors in `PascalCase` (`error SessionNotOpen(...)`), events in past tense (`event AttendanceRecorded(...)`), constants in `UPPER_SNAKE_CASE` (`MAX_BATCH_SIZE = 100`), internal/private state variables prefixed with `_` (`_sessions`, `_attendance`).
- **Strict Layer Boundaries:**
  - `src/components/**` and client pages must **never** import `src/lib/db/admin.ts` or read server-only environment variables (`SUPABASE_SERVICE_ROLE_KEY`, `INSTITUTION_HASH_SALT`, `AUTH_JWT_SECRET`, `QR_TICKET_SIGNER_PRIVATE_KEY`).
  - All attendance percentage math must call `calculateAttendanceMetrics()` from `src/lib/attendance/calculator.ts` — never duplicate numerator/denominator math inline in components or SQL queries.

### 3.2 Typed Errors & Human-Readable Messages
- Define domain error classes (`AttendChainError`, `AuthVerificationError`, `ContractRevertError`, `RpcUnavailableError`) with `{ code: string, userMessage: string, technicalDetail?: string }`.
- Never render raw JSON-RPC stack traces or hex revert payloads in the UI; map every custom contract error in `src/lib/blockchain/tx-manager.ts` to the exact user-facing recovery copy in `03_UIUX.md` Section 6.

### 3.3 Safe Logging & Transaction Diagnostics
- Use `logger.info` / `logger.warn` / `logger.error` from `src/lib/logger.ts`.
- Automatically redact keys matching `/private|secret|mnemonic|cookie|authorization|roll|student_name|email/i`.

### 3.4 Smart-Contract Patterns & Testing Expectations
- Target Solidity `0.8.28` with optimizer enabled (`runs: 200`).
- Pack `AttendanceRecord` into a single 32-byte slot (`DEC-03`).
- Every state-changing function must emit an indexed event and validate caller authorization (`onlyRole` or `onlyCourseTeacherOrAdmin`).
- Contract tests (`blockchain/test/AttendChainRegistry.test.ts`) must assert exact custom error names via `.to.be.revertedWithCustomError(contract, "ErrorName")`.

### 3.5 Database Migration Discipline
- All schema changes live in numbered SQL files under `supabase/migrations/` (`0001_initial_schema.sql`, etc.).
- **Never edit an already-applied migration file** without an approved migration strategy; additive changes require a new numbered migration and explicit user approval.

### 3.6 Accessibility & Responsive Design Standards
- Every screen must meet WCAG 2.2 AA (`NFR-006`): minimum `4.5:1` text contrast, keyboard navigation (`Tab`, `Enter`, `Escape`, arrow keys on `AttendanceStatusSelector`), `aria-live="polite"` transaction status updates, and `@media (prefers-reduced-motion: reduce)` support.

---

## 4. Git, Branching, and Lockfile Discipline

1. **Branch-Per-Ticket Workflow:** Work on feature branches named `ticket/T-XXX-short-slug` (e.g., `ticket/T-005-registry-core-contract`) or commit atomically per ticket using Conventional Commits:
   - `feat(T-006): implement packed batch attendance and EIP-712 QR check-in`
   - `test(T-007): add 95% coverage and gas budget suite for AttendChainRegistry`
   - `sec(T-009): enforce SIWE single-use nonce and HttpOnly session cookie`
2. **Never Force-Push:** `git push --force` and `git reset --hard` on shared history are strictly forbidden.
3. **Never Edit Lockfiles Manually:** `package-lock.json` may only be updated by `npm install` (during `T-001` setup) and verified via `npm ci`.

---

## 5. Protected Files & Actions Requiring Explicit User Approval

### 5.1 Protected Files (Do Not Modify Without User Approval)
- `/CLAUDE.md` and `/AGENTS.md`
- `/docs/01_PRD.md`, `/docs/02_TRD.md`, `/docs/03_UIUX.md`, `/docs/04_ARCHITECTURE.md`, `/docs/05_SECURITY.md`, `/docs/07_RULES.md`, `/docs/08_PHASES.md`, `/docs/09_MASTER_PROMPT.md`
  *(Note: Updating ticket statuses in `/docs/06_TICKETS.md`, `/docs/00_INDEX.md`, and the `STATUS` block in `/docs/09_MASTER_PROMPT.md` after completing a ticket is permitted and required.)*

### 5.2 Actions Requiring Prior User Approval
1. Adding, removing, or upgrading any npm dependency.
2. Modifying the PostgreSQL schema after `0001_initial_schema.sql` is applied.
3. Changing any smart contract function signature, custom error, or event in `AttendChainRegistry.sol` from `04_ARCHITECTURE.md` Section 4.
4. Changing any REST API route path or request/response contract from `04_ARCHITECTURE.md` Section 5.
5. Executing any destructive file or database operation (`DROP TABLE`, `TRUNCATE`, `rm -rf`).

---

## 6. Definition of Done (DoD) & Mandatory Ticket Progress Report

A ticket (`T-XXX`) may be marked `DONE` in `/docs/06_TICKETS.md` **only** when all 6 criteria below are satisfied:
1. All acceptance criteria (`Given/When/Then`) for `T-XXX` are implemented in full.
2. Automated tests for `T-XXX` are written and passing (`0` failing tests).
3. `npm run lint`, `npm run format:check`, and `npm run typecheck` pass with `0` errors.
4. No secrets, private keys, or non-synthetic PII exist in code, fixtures, or logs.
5. Ticket status is updated from `TODO` to `DONE` in `/docs/06_TICKETS.md` and `/docs/09_MASTER_PROMPT.md`.
6. The agent outputs the following **Mandatory Progress Report**:

```markdown
### Ticket Progress Report — T-XXX: <Title>
- **Status:** DONE
- **Files Created / Modified:** <list with file links>
- **Architectural / Implementation Decisions:** <concise summary>
- **Verification & Test Commands Executed:**
  - `npm run lint` -> PASS / FAIL
  - `npm run typecheck` -> PASS / FAIL
  - `<test command>` -> PASS (<N> passed, coverage: <X>%)
- **Risks / Open Issues:** <None or specific details>
- **Next Eligible Ticket:** T-YYY (<Title>)
```
