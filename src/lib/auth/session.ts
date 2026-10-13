import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { UserRole } from "@/types";

export const SESSION_COOKIE_NAME = "attendchain_session";
export const DEFAULT_JWT_SECRET =
  "attendchain-super-secret-development-jwt-key-min-32-chars-long";

export function getJwtSecretKey(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET || DEFAULT_JWT_SECRET;
  return new TextEncoder().encode(secret);
}

export interface AttendChainSessionPayload extends JWTPayload {
  sub: string; // checksummed wallet address
  walletAddress: string;
  role: UserRole;
  displayName: string;
  studentIdHash?: string;
  department?: string;
}

/**
 * Signs a standard HttpOnly HS256 JWT session token with an 8-hour expiry (TR-002).
 */
export async function createSessionToken(
  payload: Omit<AttendChainSessionPayload, "iat" | "exp">
): Promise<string> {
  const secret = getJwtSecretKey();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
}

/**
 * Verifies and decodes the HttpOnly session token.
 */
export async function verifySessionToken(
  token: string
): Promise<AttendChainSessionPayload | null> {
  try {
    const secret = getJwtSecretKey();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return payload as AttendChainSessionPayload;
  } catch {
    return null;
  }
}
