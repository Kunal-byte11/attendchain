1. MANDATORY FIRST STEP: Before reading, creating, or modifying any code in AttendChain, read `/docs/07_RULES.md` and `/docs/09_MASTER_PROMPT.md` in full.
2. STRICT TICKET SCOPE: Execute only the single next `TODO` ticket in `/docs/06_TICKETS.md` belonging to the currently approved phase in `/docs/08_PHASES.md`, and stop immediately after completing that one ticket.
3. PHASE GATE ENFORCEMENT: Never start work on a new phase in `/docs/08_PHASES.md` until all exit criteria for the current phase pass and the user explicitly replies `approved, start Phase N`.
4. ARCHITECTURE & PRIVACY LOCK: Obey the exact stack lock in `/docs/02_TRD.md` and `/docs/07_RULES.md`, and never place student PII, private keys, or secrets on-chain, in logs, or in source control (`/docs/05_SECURITY.md`).
5. CONFLICT & VERIFICATION PROTOCOL: Never guess on ambiguous requirements or claim tests passed without running them; if any documentation conflict or blocker arises, stop and request user approval.
