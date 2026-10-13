import { ethers } from "ethers";

export const SYNTHETIC_ROLL_REGEX = /^SYN-[A-Z0-9-]+$/;
export const BYTES32_HEX_REGEX = /^0x[a-fA-F0-9]{64}$/;
export const MIN_CORRECTION_REASON_LENGTH = 10;

export class NonSyntheticIdentityError extends Error {
  public readonly code = "NON_SYNTHETIC_ROLL_REJECTED";

  constructor(providedRollNo: string) {
    super(
      `Roll number "${providedRollNo}" rejected: AttendChain strictly requires synthetic roll numbers matching ^SYN-[A-Z0-9-]+$ (e.g., SYN-2026-042).`
    );
    this.name = "NonSyntheticIdentityError";
  }
}

export class InvalidHashInputError extends Error {
  public readonly code = "INVALID_HASH_INPUT";

  constructor(message: string) {
    super(message);
    this.name = "InvalidHashInputError";
  }
}

export function normalizeSyntheticRollNo(rollNo: string): string {
  const normalized = rollNo.trim().toUpperCase();
  if (!SYNTHETIC_ROLL_REGEX.test(normalized)) {
    throw new NonSyntheticIdentityError(rollNo);
  }
  return normalized;
}

/**
 * Computes the deterministic salted pseudonymous student commitment (TR-004):
 * studentIdHash = keccak256(abi.encodePacked(INSTITUTION_HASH_SALT, canonicalRollNo))
 */
export function computeStudentIdHash(
  institutionSalt: string,
  rollNo: string
): string {
  const trimmedSalt = institutionSalt.trim();
  if (!BYTES32_HEX_REGEX.test(trimmedSalt)) {
    throw new InvalidHashInputError(
      "INSTITUTION_HASH_SALT must be a 32-byte 0x-prefixed hexadecimal string."
    );
  }

  const canonicalRollNo = normalizeSyntheticRollNo(rollNo);
  return ethers.solidityPackedKeccak256(
    ["bytes32", "string"],
    [trimmedSalt, canonicalRollNo]
  );
}

/**
 * Computes the deterministic bytes32 course identifier hash (TR-005).
 */
export function computeCourseIdHash(courseCode: string): string {
  const normalized = courseCode.trim().toUpperCase();
  if (normalized.length < 2 || normalized.length > 24) {
    throw new InvalidHashInputError(
      "Course code must be between 2 and 24 characters."
    );
  }
  return ethers.id(normalized);
}

/**
 * Computes the bytes32 lecture session metadata commitment hash.
 */
export function computeMetadataHash(topic: string): string {
  const normalized = topic.trim();
  if (normalized.length < 3 || normalized.length > 200) {
    throw new InvalidHashInputError(
      "Session topic must be between 3 and 200 characters."
    );
  }
  return ethers.id(normalized);
}

/**
 * Computes the bytes32 audit reason commitment hash for attendance corrections (TR-009).
 */
export function computeReasonHash(reasonText: string): string {
  const normalized = reasonText.trim().replace(/\s+/g, " ");
  if (normalized.length < MIN_CORRECTION_REASON_LENGTH) {
    throw new InvalidHashInputError(
      `Correction reason must be at least ${MIN_CORRECTION_REASON_LENGTH} characters.`
    );
  }
  return ethers.id(normalized);
}
