import { NextResponse } from "next/server";
import { z } from "zod";
import { getMemoryDb } from "@/lib/db/client";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import type { UserRole } from "@/types";

const demoLoginSchema = z.object({
  role: z.enum(["ADMIN", "TEACHER", "STUDENT"]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = demoLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_ROLE",
            message: "Must specify a valid role: ADMIN, TEACHER, or STUDENT.",
          },
        },
        { status: 400 }
      );
    }

    const { role } = parsed.data;
    const db = getMemoryDb();

    // Map role to seeded demo account
    let targetAddress = "";
    if (role === "ADMIN") {
      targetAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    } else if (role === "TEACHER") {
      targetAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    } else {
      targetAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    }

    const userProfile = db.users.get(targetAddress.toLowerCase());
    if (!userProfile) {
      return NextResponse.json(
        {
          error: {
            code: "USER_NOT_FOUND",
            message: `Pre-seeded ${role} profile not found in memory database.`,
          },
        },
        { status: 404 }
      );
    }

    // Create session token with role and identity
    const token = await createSessionToken({
      sub: userProfile.walletAddress,
      walletAddress: userProfile.walletAddress,
      role: userProfile.role as UserRole,
      displayName: userProfile.displayName,
      department: userProfile.department,
      studentIdHash: userProfile.studentIdHash,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        walletAddress: userProfile.walletAddress,
        role: userProfile.role,
        displayName: userProfile.displayName,
        department: userProfile.department,
        studentIdHash: userProfile.studentIdHash,
      },
    });

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
          message: err instanceof Error ? err.message : "Demo login failed",
        },
      },
      { status: 500 }
    );
  }
}
