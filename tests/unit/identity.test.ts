import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  computeCourseIdHash,
  computeMetadataHash,
  computeReasonHash,
  computeStudentIdHash,
  InvalidHashInputError,
  NonSyntheticIdentityError,
  normalizeSyntheticRollNo,
} from "../../src/lib/attendance/identity";

const VALID_SALT =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const SECOND_SALT =
  "0x2222222222222222222222222222222222222222222222222222222222222222";

describe("Pseudonymous Student Identity & Hashing (src/lib/attendance/identity.ts)", () => {
  it("computes deterministic 66-character bytes32 studentIdHash for SYN-2026-042", () => {
    const hash1 = computeStudentIdHash(VALID_SALT, "SYN-2026-042");
    const hash2 = computeStudentIdHash(VALID_SALT, "  syn-2026-042 ");

    expect(hash1).toMatch(/^0x[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2);

    const differentSaltHash = computeStudentIdHash(SECOND_SALT, "SYN-2026-042");
    expect(differentSaltHash).not.toBe(hash1);
  });

  it("rejects non-synthetic roll numbers with NonSyntheticIdentityError", () => {
    expect(() => normalizeSyntheticRollNo("21BCE1042")).toThrowError(
      NonSyntheticIdentityError
    );
    expect(() =>
      computeStudentIdHash(VALID_SALT, "REAL-2026-001")
    ).toThrowError(NonSyntheticIdentityError);
    expect(() =>
      computeStudentIdHash(VALID_SALT, "SYN_INVALID_CHAR")
    ).toThrowError(NonSyntheticIdentityError);
  });

  it("rejects malformed institution hash salt with InvalidHashInputError", () => {
    expect(() => computeStudentIdHash("0x1234", "SYN-2026-042")).toThrowError(
      InvalidHashInputError
    );
  });

  it("computes deterministic courseIdHash and validates course code bounds", () => {
    const cs701 = computeCourseIdHash("cs701");
    expect(cs701).toBe(computeCourseIdHash(" CS701 "));
    expect(cs701).toMatch(/^0x[a-f0-9]{64}$/);

    expect(() => computeCourseIdHash("A")).toThrowError(InvalidHashInputError);
    expect(() =>
      computeCourseIdHash("COURSE-CODE-WAY-TOO-LONG-OVER-24-CHARS")
    ).toThrowError(InvalidHashInputError);
  });

  it("computes deterministic session metadataHash and validates topic bounds", () => {
    const h = computeMetadataHash("Consensus Mechanisms & Finality");
    expect(h).toMatch(/^0x[a-f0-9]{64}$/);
    expect(() => computeMetadataHash("ab")).toThrowError(InvalidHashInputError);
  });

  it("computes deterministic correction reasonHash and enforces >=10 char minimum", () => {
    const r1 = computeReasonHash("Approved   Medical Certificate #MC-104");
    const r2 = computeReasonHash("Approved Medical Certificate #MC-104");
    expect(r1).toBe(r2);
    expect(r1).toMatch(/^0x[a-f0-9]{64}$/);

    expect(() => computeReasonHash("Too short")).toThrowError(
      InvalidHashInputError
    );
  });
});

describe("PostgreSQL Initial Schema Migration (0001_initial_schema.sql)", () => {
  it("defines all 12 required tables, synthetic roll CHECK constraint, and idempotency UNIQUE constraints", () => {
    const sqlPath = path.resolve(
      __dirname,
      "../../supabase/migrations/0001_initial_schema.sql"
    );
    const sql = fs.readFileSync(sqlPath, "utf8");

    const requiredTables = [
      "users",
      "auth_nonces",
      "role_assignments",
      "students",
      "courses",
      "course_enrollments",
      "blockchain_transactions",
      "lecture_sessions",
      "qr_challenges",
      "attendance_records",
      "attendance_corrections",
      "indexed_contract_events",
    ];

    for (const table of requiredTables) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    expect(sql).toContain("synthetic_roll_no ~ '^SYN-[A-Z0-9-]+$'");
    expect(sql).toContain("UNIQUE (on_chain_session_id, student_id_hash)");
    expect(sql).toContain("UNIQUE (chain_id, tx_hash, log_index)");
  });
});
