import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ethers } from "ethers";
import { getMemoryDb } from "@/lib/db/client";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import type { RoleAssignment, UserProfile } from "@/types";
import { logger } from "@/lib/logger";

const rolePostSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid 20-byte Ethereum address"),
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  department: z.string().min(2, "Department must be at least 2 characters"),
  roleName: z.enum(["TEACHER_ROLE", "DEFAULT_ADMIN_ROLE"]),
  action: z.enum(["GRANTED", "REVOKED"]),
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid 32-byte transaction hash"),
});

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    const token = sessionCookie?.value;
    if (!token) {
      return NextResponse.json(
        {
          error: { code: "UNAUTHORIZED", message: "Authentication required." },
        },
        { status: 401 }
      );
    }

    const session = await verifySessionToken(token);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Administrator role required to access role assignments.",
          },
        },
        { status: 403 }
      );
    }

    const db = getMemoryDb();
    const url = new URL(request.url);
    const roleFilter = url.searchParams.get("role");

    let assignments = db.roleAssignments;
    if (roleFilter) {
      assignments = assignments.filter((r) => r.roleName === roleFilter);
    }

    return NextResponse.json({ roles: assignments });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : "Failed to fetch roles",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    const token = sessionCookie?.value;
    if (!token) {
      return NextResponse.json(
        {
          error: { code: "UNAUTHORIZED", message: "Authentication required." },
        },
        { status: 401 }
      );
    }

    const session = await verifySessionToken(token);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Administrator role required to manage role assignments.",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = rolePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid role assignment parameters.",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const { walletAddress, displayName, department, roleName, action, txHash } =
      parsed.data;

    const checksummedAddress = ethers.getAddress(walletAddress);
    const db = getMemoryDb();

    const roleAssignment: RoleAssignment = {
      id: `role-assign-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      walletAddress: checksummedAddress,
      roleName,
      displayName,
      department,
      action,
      txHash,
      assignedAt: new Date().toISOString(),
    };

    db.roleAssignments.push(roleAssignment);

    // Update or create user profile in memory DB
    const key = checksummedAddress.toLowerCase();
    const existingUser = db.users.get(key);

    if (action === "GRANTED") {
      const assignedRole =
        roleName === "DEFAULT_ADMIN_ROLE" ? "ADMIN" : "TEACHER";
      const updatedUser: UserProfile = {
        id: existingUser?.id ?? `usr-${Date.now()}`,
        walletAddress: checksummedAddress,
        role: assignedRole,
        displayName: displayName.trim(),
        department: department.trim(),
        isActive: true,
        createdAt: existingUser?.createdAt ?? new Date().toISOString(),
      };
      db.users.set(key, updatedUser);
    } else if (action === "REVOKED" && existingUser) {
      existingUser.isActive = false;
    }

    logger.info("Admin role assignment updated successfully", {
      eventCode: "ROLE_ASSIGNMENT_UPDATED",
      walletAddress: checksummedAddress,
      roleName,
      action,
      txHash,
    });

    return NextResponse.json({ roleAssignment }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : "Failed to update role",
        },
      },
      { status: 500 }
    );
  }
}
