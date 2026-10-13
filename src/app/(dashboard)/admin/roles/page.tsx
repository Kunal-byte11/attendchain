"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  UserPlus,
  UserX,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useWallet } from "@/lib/blockchain/wallet";
import type { RoleAssignment } from "@/types";

export default function AdminRolesPage() {
  const { account } = useWallet();
  const [roles, setRoles] = useState<RoleAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form inputs
  const [walletAddress, setWalletAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [department, setDepartment] = useState(
    "Computer Science & Engineering"
  );
  const [roleName, setRoleName] = useState<
    "TEACHER_ROLE" | "DEFAULT_ADMIN_ROLE"
  >("TEACHER_ROLE");
  const [action, setAction] = useState<"GRANTED" | "REVOKED">("GRANTED");
  const [txHash, setTxHash] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadRoles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/roles");
      if (!res.ok) throw new Error("Failed to load role assignments");
      const data = await res.json();
      setRoles(data.roles || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading roles");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // If txHash is empty, provide a dummy simulation txHash for local environment
    const targetTxHash = txHash.trim() || "0x" + "b".repeat(64);

    startTransition(async () => {
      try {
        const res = await fetch("/api/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: walletAddress.trim(),
            displayName: displayName.trim(),
            department: department.trim(),
            roleName,
            action,
            txHash: targetTxHash,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error?.message || "Failed to update role assignment"
          );
        }

        setSuccessMsg(
          `Successfully recorded ${action} of ${roleName} for ${data.roleAssignment.displayName}`
        );
        setWalletAddress("");
        setDisplayName("");
        setTxHash("");
        await loadRoles();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Role operation failed");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="text-xs font-semibold uppercase tracking-wider text-indigo-600 hover:underline"
            >
              ← Admin Workspace
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-500">
              Screen 7
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Role & Access Management
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Grant and revoke faculty TEACHER roles and administrator privileges
            with on-chain EIP-1193 transactions.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={loadRoles}
          isLoading={isLoading}
          aria-label="Refresh roles list"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
      </header>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
          <p>{error}</p>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <p>{successMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form Card */}
        <div className="lg:col-span-2">
          <Card
            title="Assign or Revoke Role"
            subtitle="Record smart contract grantTeacherRole / revokeTeacherRole assignments (FR-003, TR-003)"
          >
            <form onSubmit={handleRoleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="walletAddress"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Faculty Wallet Address *
                  </label>
                  <input
                    id="walletAddress"
                    type="text"
                    required
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="displayName"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Faculty Full Name *
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Prof. Ananya Verma"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="department"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Department
                  </label>
                  <input
                    id="department"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="roleName"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Target Role
                  </label>
                  <select
                    id="roleName"
                    value={roleName}
                    onChange={(e) =>
                      setRoleName(
                        e.target.value as "TEACHER_ROLE" | "DEFAULT_ADMIN_ROLE"
                      )
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  >
                    <option value="TEACHER_ROLE">Faculty (TEACHER_ROLE)</option>
                    <option value="DEFAULT_ADMIN_ROLE">
                      Admin (DEFAULT_ADMIN_ROLE)
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="action"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Action
                  </label>
                  <select
                    id="action"
                    value={action}
                    onChange={(e) =>
                      setAction(e.target.value as "GRANTED" | "REVOKED")
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  >
                    <option value="GRANTED">Grant Role</option>
                    <option value="REVOKED">Revoke Role</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="txHash"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Transaction Hash (Optional - auto-generated if blank)
                </label>
                <input
                  id="txHash"
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="0x..."
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant={action === "GRANTED" ? "primary" : "danger"}
                  isLoading={isPending}
                  loadingText="Executing..."
                >
                  {action === "GRANTED" ? (
                    <UserPlus className="h-4 w-4" />
                  ) : (
                    <UserX className="h-4 w-4" />
                  )}
                  <span>
                    {action === "GRANTED"
                      ? "Grant Role Assignment"
                      : "Revoke Role Assignment"}
                  </span>
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Role Permissions Info */}
        <div>
          <Card
            title="OpenZeppelin AccessControl"
            subtitle="Contract privilege matrix"
          >
            <div className="space-y-4 text-xs text-slate-600">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="font-semibold text-slate-900">TEACHER_ROLE</div>
                <p className="mt-1 text-slate-600">
                  Can open lecture sessions, generate dynamic QR codes, record
                  batch attendance, and amend records with auditable reasons.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="font-semibold text-slate-900">
                  DEFAULT_ADMIN_ROLE
                </div>
                <p className="mt-1 text-slate-600">
                  Can create courses, enroll student cohorts, update assigned
                  teachers, and grant/revoke access.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Role Assignments Audit Log */}
      <Card
        title={`Active Role Assignments (${roles.length})`}
        subtitle="Chronological log of verified on-chain role state updates"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Faculty Name
                </th>
                <th scope="col" className="px-4 py-3">
                  Wallet Address
                </th>
                <th scope="col" className="px-4 py-3">
                  Department
                </th>
                <th scope="col" className="px-4 py-3">
                  Role
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  Transaction
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No role assignments found.
                  </td>
                </tr>
              ) : (
                roles.map((role) => (
                  <tr key={role.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {role.displayName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {role.walletAddress.slice(0, 8)}...
                      {role.walletAddress.slice(-6)}
                    </td>
                    <td className="px-4 py-3">{role.department}</td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          role.roleName === "DEFAULT_ADMIN_ROLE"
                            ? "brand"
                            : "web3"
                        }
                      >
                        {role.roleName}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={role.action === "GRANTED" ? "present" : "absent"}
                      >
                        {role.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-indigo-600">
                      <span title={role.txHash}>
                        {role.txHash.slice(0, 10)}...
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
