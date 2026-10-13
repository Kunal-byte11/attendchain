import { NextResponse } from "next/server";
import { z } from "zod";
import { ethers } from "ethers";
import { getMemoryDb } from "@/lib/db/client";
import { parseSiweMessage, verifySiweSignature } from "@/lib/auth/siwe";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import type { UserProfile } from "@/types";

const verifyRequestSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  message: z.string().min(20, "SIWE message is required"),
  signature: z
    .string()
    .regex(/^0x[a-fA-F0-9]{130}$/, "Invalid 65-byte ECDSA signature"),
  studentClaimCode: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = verifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid SIWE verification parameters.",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const { walletAddress, message, signature, studentClaimCode } = parsed.data;
    const checksummedAddress = ethers.getAddress(walletAddress);

    // 1. Recover signing address from ECDSA signature
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.getAddress(
        verifySiweSignature(message, signature)
      );
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_SIGNATURE",
            message: "Failed to recover signer from provided signature.",
          },
        },
        { status: 401 }
      );
    }

    if (recoveredAddress.toLowerCase() !== checksummedAddress.toLowerCase()) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_SIGNATURE",
            message: "Signature was not signed by the claiming wallet address.",
          },
        },
        { status: 401 }
      );
    }

    // 2. Validate SIWE nonce existence, single-use consumption, and 5-minute TTL
    const parsedSiwe = parseSiweMessage(message);
    if (!parsedSiwe.nonce) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_MESSAGE",
            message: "SIWE message lacks a valid Nonce field.",
          },
        },
        { status: 400 }
      );
    }

    const db = getMemoryDb();
    const nonceRecord = db.nonces.get(parsedSiwe.nonce);

    if (
      !nonceRecord ||
      nonceRecord.walletAddress !== checksummedAddress.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_NONCE",
            message: "Nonce not recognized or not issued for this wallet.",
          },
        },
        { status: 401 }
      );
    }

    const now = Date.now();
    if (nonceRecord.consumedAt !== null) {
      return NextResponse.json(
        {
          error: {
            code: "NONCE_ALREADY_USED",
            message:
              "The requested SIWE challenge nonce has already been consumed.",
          },
        },
        { status: 401 }
      );
    }

    if (now > nonceRecord.expiresAt) {
      return NextResponse.json(
        {
          error: {
            code: "NONCE_EXPIRED",
            message: "The SIWE challenge has expired (5-minute TTL exceeded).",
          },
        },
        { status: 401 }
      );
    }

    // Mark nonce consumed immediately to prevent replay
    nonceRecord.consumedAt = now;

    // 3. User Lookup & Optional Student Claim Code Binding
    let userProfile = db.users.get(checksummedAddress.toLowerCase());

    if (!userProfile && studentClaimCode) {
      // Find synthetic student profile matching claim code
      for (const student of db.students.values()) {
        if (student.claimCode === studentClaimCode.trim()) {
          // Bind wallet address to synthetic student profile
          student.walletAddress = checksummedAddress;
          const newProfile: UserProfile = {
            id: `usr-${student.id}`,
            walletAddress: checksummedAddress,
            role: "STUDENT",
            displayName: `${student.syntheticName} (${student.syntheticRollNo})`,
            department: student.department,
            studentIdHash: student.studentIdHash,
            isActive: true,
            createdAt: new Date().toISOString(),
          };
          db.users.set(checksummedAddress.toLowerCase(), newProfile);
          userProfile = newProfile;
          break;
        }
      }
    }

    if (!userProfile) {
      return NextResponse.json(
        {
          error: {
            code: "UNREGISTERED_WALLET",
            message:
              "This wallet is not registered as an Admin, Teacher, or Student in AttendChain.",
          },
        },
        { status: 404 }
      );
    }

    // 4. Create HttpOnly JWT Session Token
    const token = await createSessionToken({
      sub: checksummedAddress,
      walletAddress: checksummedAddress,
      role: userProfile.role,
      displayName: userProfile.displayName,
      department: userProfile.department,
      studentIdHash: userProfile.studentIdHash,
    });

    const response = NextResponse.json({
      user: {
        walletAddress: userProfile.walletAddress,
        role: userProfile.role,
        displayName: userProfile.displayName,
        department: userProfile.department,
        studentIdHash: userProfile.studentIdHash,
      },
    });

    // Set secure HttpOnly cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60, // 8 hours
      path: "/",
    });

    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : "Verification failed",
        },
      },
      { status: 500 }
    );
  }
}
