import { describe, expect, it } from "vitest";
import {
  EnvConfigurationError,
  validatePublicEnv,
  validateServerEnv,
} from "../../src/lib/validation/env";
import {
  logger,
  REDACTED_PLACEHOLDER,
  redactSensitiveData,
} from "../../src/lib/logger";

describe("Environment Validation (src/lib/validation/env.ts)", () => {
  const validPublicEnv = {
    NEXT_PUBLIC_DEFAULT_CHAIN_ID: "31337",
    NEXT_PUBLIC_HARDHAT_RPC_URL: "http://127.0.0.1:8545",
    NEXT_PUBLIC_SEPOLIA_RPC_PRIMARY_URL: "https://rpc.sepolia.org",
    NEXT_PUBLIC_SEPOLIA_RPC_FALLBACK_URL:
      "https://ethereum-sepolia-rpc.publicnode.com",
    NEXT_PUBLIC_CONTRACT_ADDRESS_LOCAL:
      "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA: "",
    NEXT_PUBLIC_SEPOLIA_EXPLORER_URL: "https://sepolia.etherscan.io",
    NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-public-key-1234567890",
  };

  const validServerEnv = {
    ...validPublicEnv,
    SUPABASE_SERVICE_ROLE_KEY: "service-role-secret-key-9876543210",
    AUTH_JWT_SECRET: "super-secret-jwt-signing-key-at-least-32-chars",
    INSTITUTION_HASH_SALT:
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    QR_TICKET_SIGNER_PRIVATE_KEY:
      "0x2222222222222222222222222222222222222222222222222222222222222222",
  };

  it("validates a complete public and server environment configuration", () => {
    const pub = validatePublicEnv(validPublicEnv);
    expect(pub.NEXT_PUBLIC_DEFAULT_CHAIN_ID).toBe(31337);

    const srv = validateServerEnv(validServerEnv);
    expect(srv.INSTITUTION_HASH_SALT).toHaveLength(66);
  });

  it("throws EnvConfigurationError when public environment variables are invalid", () => {
    expect(() =>
      validatePublicEnv({
        ...validPublicEnv,
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      })
    ).toThrowError(EnvConfigurationError);
  });

  it("throws EnvConfigurationError listing missing keys without leaking secret values", () => {
    const brokenSecret = "sensitive-secret-value-do-not-print";
    expect(() =>
      validateServerEnv({
        ...validServerEnv,
        INSTITUTION_HASH_SALT: "not-a-valid-hex-salt",
        AUTH_JWT_SECRET: "short",
        SUPABASE_SERVICE_ROLE_KEY: brokenSecret,
      })
    ).toThrowError(EnvConfigurationError);

    try {
      validateServerEnv({
        ...validServerEnv,
        INSTITUTION_HASH_SALT: "invalid",
        AUTH_JWT_SECRET: "short",
      });
    } catch (err) {
      expect(err).toBeInstanceOf(EnvConfigurationError);
      const envErr = err as EnvConfigurationError;
      expect(envErr.missingOrInvalidKeys).toContain("INSTITUTION_HASH_SALT");
      expect(envErr.missingOrInvalidKeys).toContain("AUTH_JWT_SECRET");
      expect(envErr.message).not.toContain(brokenSecret);
    }
  });

  it("rejects server secrets that are accidentally duplicated into NEXT_PUBLIC_* variables", () => {
    const duplicatedSecret = "shared-secret-value-at-least-32-characters-long";
    expect(() =>
      validateServerEnv({
        ...validServerEnv,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: duplicatedSecret,
        AUTH_JWT_SECRET: duplicatedSecret,
      })
    ).toThrowError(EnvConfigurationError);
  });
});

describe("Redacted Structured Logger (src/lib/logger.ts)", () => {
  it("redacts privateKey, rollNumber, studentName, email, and nested secrets", () => {
    const entry = logger.info("Student registration processed", {
      eventCode: "STUDENT_REGISTERED",
      chainId: 11155111,
      sessionId: 15,
      txHash: "0x8a3f91b2",
      correlationId: "corr-123",
      studentIdHash:
        "0x3e9bf0123e9bf0123e9bf0123e9bf0123e9bf0123e9bf0123e9bf0123e9bf012",
      privateKey: "0xdeadbeef",
      rollNumber: "SYN-2026-042",
      studentName: "Aarav Mehta",
      email: "aarav@example.edu",
      nested: {
        cookie: "attendchain_session=secret-jwt",
        safeCount: 30,
      },
    });

    expect(entry.eventCode).toBe("STUDENT_REGISTERED");
    expect(entry.chainId).toBe(11155111);
    expect(entry.sessionId).toBe(15);
    expect(entry.txHash).toBe("0x8a3f91b2");
    expect(entry.correlationId).toBe("corr-123");
    expect(entry.context?.studentIdHash).toBe(
      "0x3e9bf0123e9bf0123e9bf0123e9bf0123e9bf0123e9bf0123e9bf0123e9bf012"
    );
    expect(entry.context?.privateKey).toBe(REDACTED_PLACEHOLDER);
    expect(entry.context?.rollNumber).toBe(REDACTED_PLACEHOLDER);
    expect(entry.context?.studentName).toBe(REDACTED_PLACEHOLDER);
    expect(entry.context?.email).toBe(REDACTED_PLACEHOLDER);
    expect((entry.context?.nested as Record<string, unknown>)?.cookie).toBe(
      REDACTED_PLACEHOLDER
    );
    expect((entry.context?.nested as Record<string, unknown>)?.safeCount).toBe(
      30
    );
  });

  it("supports warn and error log levels and omits empty context", () => {
    const warnEntry = logger.warn("RPC latency elevated", {
      eventCode: "RPC_SLOW",
    });
    expect(warnEntry.level).toBe("warn");
    expect(warnEntry.context).toBeUndefined();

    const errorEntry = logger.error("RPC failover triggered", {
      eventCode: "RPC_FAILOVER_TRIGGERED",
      authorization: "Bearer secret-token",
    });
    expect(errorEntry.level).toBe("error");
    expect(errorEntry.context?.authorization).toBe(REDACTED_PLACEHOLDER);
  });

  it("handles arrays and primitive values in redactSensitiveData", () => {
    const redacted = redactSensitiveData([
      { roll_no: "SYN-2026-001", status: "PRESENT" },
      "plain-string",
      null,
      undefined,
    ]) as unknown[];

    expect((redacted[0] as Record<string, unknown>).roll_no).toBe(
      REDACTED_PLACEHOLDER
    );
    expect((redacted[0] as Record<string, unknown>).status).toBe("PRESENT");
    expect(redacted[1]).toBe("plain-string");
    expect(redacted[2]).toBeNull();
    expect(redacted[3]).toBeUndefined();
  });
});
