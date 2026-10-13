import { NextResponse } from "next/server";
import { z } from "zod";
import { ethers } from "ethers";
import { getMemoryDb } from "@/lib/db/client";
import { buildSiweMessage, generateSiweNonce } from "@/lib/auth/siwe";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const nonceRequestSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid 0x-prefixed Ethereum address"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = nonceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_ADDRESS",
            message: "A valid 40-character 0x Ethereum address is required.",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const checksummedAddress = ethers.getAddress(parsed.data.walletAddress);

    // Rate limit: 20 nonce requests per 60 seconds per wallet address (05_SECURITY.md)
    const rateCheck = checkRateLimit(
      `nonce:${checksummedAddress.toLowerCase()}`,
      {
        maxRequests: 20,
        windowSeconds: 60,
      }
    );
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message:
              "Too many authentication requests. Please try again later.",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateCheck.resetSeconds.toString(),
          },
        }
      );
    }
    const nonce = generateSiweNonce();
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes TTL (TR-002)

    const db = getMemoryDb();
    db.nonces.set(nonce, {
      walletAddress: checksummedAddress.toLowerCase(),
      nonce,
      expiresAt,
      consumedAt: null,
    });

    const issuedAt = new Date(now).toISOString();
    const expirationTime = new Date(expiresAt).toISOString();
    const statement =
      "Sign in to AttendChain with your Ethereum account to establish a secure session.";

    const originHeader =
      request.headers.get("origin") || request.headers.get("host");
    const domain = originHeader
      ? originHeader.replace(/^https?:\/\//, "")
      : "attendchain.edu";
    const uri = originHeader?.startsWith("http")
      ? originHeader
      : `http://${domain}`;
    const targetChainId = Number(body?.chainId) || 31337;

    const message = buildSiweMessage({
      domain,
      address: checksummedAddress,
      statement,
      uri,
      version: "1",
      chainId: targetChainId,
      nonce,
      issuedAt,
      expirationTime,
    });

    return NextResponse.json({
      nonce,
      message,
      expiresAt: expirationTime,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error ? err.message : "Failed to generate nonce",
        },
      },
      { status: 500 }
    );
  }
}
