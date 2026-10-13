import { ethers } from "ethers";

export interface SiweMessageParams {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
}

/**
 * Generates an EIP-4361 compliant Sign-In with Ethereum challenge text (TR-002).
 */
export function buildSiweMessage(params: SiweMessageParams): string {
  const header = `${params.domain} wants you to sign in with your Ethereum account:\n${params.address}\n\n`;
  const body = `${params.statement}\n\n`;
  const fields = [
    `URI: ${params.uri}`,
    `Version: ${params.version}`,
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
  ];

  if (params.expirationTime) {
    fields.push(`Expiration Time: ${params.expirationTime}`);
  }

  return header + body + fields.join("\n");
}

/**
 * Extracts the nonce, address, and expiration from a raw EIP-4361 message string.
 */
export function parseSiweMessage(message: string): {
  address: string | null;
  nonce: string | null;
  issuedAt: string | null;
  expirationTime: string | null;
} {
  const addressMatch = message.match(
    /wants you to sign in with your Ethereum account:\n(0x[a-fA-F0-9]{40})/
  );
  const nonceMatch = message.match(/Nonce:\s*([a-zA-Z0-9_-]+)/);
  const issuedAtMatch = message.match(
    /Issued At:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z?)/
  );
  const expirationMatch = message.match(
    /Expiration Time:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z?)/
  );

  return {
    address: addressMatch?.[1] ? ethers.getAddress(addressMatch[1]) : null,
    nonce: nonceMatch?.[1] ?? null,
    issuedAt: issuedAtMatch?.[1] ?? null,
    expirationTime: expirationMatch?.[1] ?? null,
  };
}

/**
 * Generates an alphanumeric single-use nonce for SIWE.
 */
export function generateSiweNonce(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let nonce = "";
  const randomBytes = ethers.randomBytes(16);
  for (let i = 0; i < 16; i++) {
    nonce += chars[(randomBytes[i] ?? 0) % chars.length];
  }
  return nonce;
}

/**
 * Recovers the signing address from an ECDSA signature over the raw message text.
 */
export function verifySiweSignature(
  message: string,
  signature: string
): string {
  return ethers.verifyMessage(message, signature);
}
