"use client";

import React from "react";
import { Check, X, Clock, HelpCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type {
  AttendanceStatus,
  AttendanceRecordView,
  StudentProfile,
} from "@/types";

export interface RosterItem {
  studentProfile: StudentProfile;
  currentStatus: AttendanceStatus;
  checkInMethod: string;
  isStaged: boolean;
}

export interface RosterTableProps {
  roster: RosterItem[];
  onStatusChange: (studentIdHash: string, newStatus: AttendanceStatus) => void;
  disabled?: boolean;
}

export function RosterTable({
  roster,
  onStatusChange,
  disabled = false,
}: RosterTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-slate-600">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-3">
              Roll Number
            </th>
            <th scope="col" className="px-4 py-3">
              Student Name
            </th>
            <th scope="col" className="px-4 py-3">
              Check-In Method
            </th>
            <th scope="col" className="px-4 py-3">
              Mark Status (Keyboard Accessible)
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {roster.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                No enrolled students found for this lecture session.
              </td>
            </tr>
          ) : (
            roster.map((item) => {
              const { studentProfile, currentStatus, checkInMethod, isStaged } =
                item;
              const hash = studentProfile.studentIdHash;

              return (
                <tr key={studentProfile.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {studentProfile.syntheticRollNo}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {studentProfile.syntheticName}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        checkInMethod === "QR_VERIFIED"
                          ? "present"
                          : currentStatus === "NONE"
                            ? "neutral"
                            : "web3"
                      }
                    >
                      {checkInMethod === "QR_VERIFIED"
                        ? "QR Verified"
                        : currentStatus === "NONE"
                          ? "Pending Marking"
                          : "Manual / Overridden"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div
                      role="radiogroup"
                      aria-label={`Attendance status for ${studentProfile.syntheticRollNo}`}
                      className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-2xs"
                    >
                      {(
                        [
                          "PRESENT",
                          "LATE",
                          "ABSENT",
                          "EXCUSED",
                        ] as AttendanceStatus[]
                      ).map((status) => {
                        const isSelected = currentStatus === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            disabled={disabled}
                            onClick={() => onStatusChange(hash, status)}
                            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50 ${
                              isSelected
                                ? status === "PRESENT"
                                  ? "bg-emerald-600 text-white"
                                  : status === "LATE"
                                    ? "bg-amber-600 text-white"
                                    : status === "ABSENT"
                                      ? "bg-rose-600 text-white"
                                      : "bg-sky-600 text-white"
                                : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {status}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
