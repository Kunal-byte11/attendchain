export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";

export type AttendanceStatus =
  "NONE" | "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export const ATTENDANCE_STATUS_CODE: Record<AttendanceStatus, number> = {
  NONE: 0,
  PRESENT: 1,
  ABSENT: 2,
  LATE: 3,
  EXCUSED: 4,
};

export const CODE_TO_ATTENDANCE_STATUS: Record<number, AttendanceStatus> = {
  0: "NONE",
  1: "PRESENT",
  2: "ABSENT",
  3: "LATE",
  4: "EXCUSED",
};

export type SessionStatus = "OPEN" | "CLOSED" | "CANCELLED";

export const SESSION_STATUS_CODE: Record<SessionStatus, number> = {
  OPEN: 1,
  CLOSED: 2,
  CANCELLED: 3,
};

export type CheckInMethod =
  "NONE" | "QR_VERIFIED" | "TEACHER_MANUAL" | "CORRECTION";

export interface RoleAssignment {
  id: string;
  walletAddress: string;
  roleName: "TEACHER_ROLE" | "DEFAULT_ADMIN_ROLE";
  displayName: string;
  department: string;
  action: "GRANTED" | "REVOKED";
  txHash: string;
  assignedAt: string;
}

export interface UserProfile {
  id: string;
  walletAddress: string;
  role: UserRole;
  displayName: string;
  department: string;
  isActive: boolean;
  studentIdHash?: string;
  createdAt: string;
}

export interface StudentProfile {
  id: string;
  syntheticRollNo: string;
  syntheticName: string;
  studentIdHash: string;
  walletAddress: string | null;
  claimCode: string;
  semester: number;
  department: string;
  createdAt: string;
}

export interface Course {
  id: string;
  courseCode: string;
  courseIdHash: string;
  title: string;
  semester: number;
  teacherWallet: string;
  txHash: string | null;
  isActive: boolean;
  enrolledStudentHashes: string[];
  createdAt: string;
}

export interface LectureSession {
  id: string;
  onChainSessionId: number;
  courseId: string;
  courseCode: string;
  courseIdHash: string;
  teacherWallet: string;
  topic: string;
  metadataHash: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  qrEnabled: boolean;
  lateCutoffMinutes: number;
  openTxHash: string | null;
  closeTxHash: string | null;
  createdAt: string;
}

export interface AttendanceRecordView {
  id: string;
  sessionId: string;
  onChainSessionId: number;
  courseCode: string;
  courseIdHash: string;
  sessionTopic: string;
  sessionStartTime: string;
  sessionStatus: SessionStatus;
  studentId: string;
  syntheticRollNo: string;
  syntheticName: string;
  studentIdHash: string;
  draftStatus: AttendanceStatus;
  onChainStatus: AttendanceStatus;
  effectiveStatus: AttendanceStatus;
  checkInMethod: CheckInMethod;
  amendmentCount: number;
  updatedByWallet: string | null;
  txHash: string | null;
  blockNumber: number | null;
  recordedAt: string | null;
  amendedAt: string | null;
}

export interface AttendanceCorrectionView {
  id: string;
  attendanceRecordId: string;
  onChainSessionId: number;
  courseCode: string;
  syntheticRollNo: string;
  studentIdHash: string;
  requestedByWallet: string;
  requestStatus: "PENDING_DISPUTE" | "APPROVED_ON_CHAIN" | "REJECTED";
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  reasonText: string;
  reasonHash: string;
  approvedByWallet: string | null;
  txHash: string | null;
  blockNumber: number | null;
  createdAt: string;
}

export type AttendanceShortageTier =
  "ELIGIBLE" | "WARNING_CONDONATION" | "CRITICAL_SHORTAGE";

export interface AttendancePercentageMetrics {
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  unrecordedClosedCount: number;
  totalPresentCredits: number; // Present + Late
  eligibleSessionsCount: number; // Denominator
  percentage: number; // 2-decimal rounded (e.g., 85.71)
  displayLabel: string; // e.g. "85.71%" or "N/A (No Eligible Sessions)"
  tier: AttendanceShortageTier;
  isShortage: boolean; // true if percentage < 75.00%
}

export interface AttendanceShortageItem {
  courseCode: string;
  syntheticRollNo: string;
  syntheticName: string;
  studentIdHash: string;
  presentCredits: number;
  eligibleSessions: number;
  percentage: number;
  displayPercentage: string;
  tier: AttendanceShortageTier;
  latestTxHash: string | null;
}
