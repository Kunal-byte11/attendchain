import { z } from "zod";

export class EnvConfigurationError extends Error {
  public readonly code = "ENV_CONFIGURATION_ERROR";
  public readonly missingOrInvalidKeys: string[];

  constructor(missingOrInvalidKeys: string[]) {
    super(
      `Invalid or missing environment configuration for keys: ${missingOrInvalidKeys.join(", ")}`
    );
    this.name = "EnvConfigurationError";
    this.missingOrInvalidKeys = missingOrInvalidKeys;
  }
}

const ethereumAddressOrEmptySchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 0x Ethereum address")
  .optional()
  .or(z.literal(""));

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_DEFAULT_CHAIN_ID: z
    .enum(["31337", "11155111"])
    .default("31337")
    .transform((val) => Number(val) as 31337 | 11155111),
  NEXT_PUBLIC_HARDHAT_RPC_URL: z
    .string()
    .url()
    .default("http://127.0.0.1:8545"),
  NEXT_PUBLIC_SEPOLIA_RPC_PRIMARY_URL: z
    .string()
    .url()
    .default("https://rpc.sepolia.org"),
  NEXT_PUBLIC_SEPOLIA_RPC_FALLBACK_URL: z
    .string()
    .url()
    .default("https://ethereum-sepolia-rpc.publicnode.com"),
  NEXT_PUBLIC_CONTRACT_ADDRESS_LOCAL: ethereumAddressOrEmptySchema,
  NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA: ethereumAddressOrEmptySchema,
  NEXT_PUBLIC_SEPOLIA_EXPLORER_URL: z
    .string()
    .url()
    .default("https://sepolia.etherscan.io"),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(16, "NEXT_PUBLIC_SUPABASE_ANON_KEY must be at least 16 characters"),
});

export const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(16, "SUPABASE_SERVICE_ROLE_KEY must be at least 16 characters"),
  AUTH_JWT_SECRET: z
    .string()
    .min(32, "AUTH_JWT_SECRET must be at least 32 characters"),
  INSTITUTION_HASH_SALT: z
    .string()
    .regex(
      /^0x[a-fA-F0-9]{64}$/,
      "INSTITUTION_HASH_SALT must be a 32-byte 0x-prefixed hex string"
    ),
  QR_TICKET_SIGNER_PRIVATE_KEY: z
    .string()
    .regex(
      /^0x[a-fA-F0-9]{64}$/,
      "QR_TICKET_SIGNER_PRIVATE_KEY must be a 32-byte 0x-prefixed hex private key"
    ),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function validatePublicEnv(
  rawEnv: Record<string, string | undefined> = process.env
): PublicEnv {
  const parsed = publicEnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const keys = Array.from(
      new Set(parsed.error.issues.map((issue) => issue.path.join(".")))
    );
    throw new EnvConfigurationError(keys);
  }
  return parsed.data;
}

export function validateServerEnv(
  rawEnv: Record<string, string | undefined> = process.env
): ServerEnv {
  const parsed = serverEnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const keys = Array.from(
      new Set(parsed.error.issues.map((issue) => issue.path.join(".")))
    );
    throw new EnvConfigurationError(keys);
  }

  // Ensure server-only secrets are never accidentally duplicated into NEXT_PUBLIC_* variables
  const publicValues = [
    parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    parsed.data.NEXT_PUBLIC_HARDHAT_RPC_URL,
    parsed.data.NEXT_PUBLIC_SEPOLIA_RPC_PRIMARY_URL,
    parsed.data.NEXT_PUBLIC_SEPOLIA_RPC_FALLBACK_URL,
  ];
  const serverSecrets: Array<[string, string]> = [
    ["SUPABASE_SERVICE_ROLE_KEY", parsed.data.SUPABASE_SERVICE_ROLE_KEY],
    ["AUTH_JWT_SECRET", parsed.data.AUTH_JWT_SECRET],
    ["INSTITUTION_HASH_SALT", parsed.data.INSTITUTION_HASH_SALT],
    ["QR_TICKET_SIGNER_PRIVATE_KEY", parsed.data.QR_TICKET_SIGNER_PRIVATE_KEY],
  ];

  const leakedKeys: string[] = [];
  for (const [secretName, secretValue] of serverSecrets) {
    if (publicValues.includes(secretValue)) {
      leakedKeys.push(secretName);
    }
  }

  if (leakedKeys.length > 0) {
    throw new EnvConfigurationError(leakedKeys);
  }

  return parsed.data;
}
