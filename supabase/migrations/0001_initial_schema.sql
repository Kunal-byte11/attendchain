-- AttendChain Initial PostgreSQL Schema Migration (0001_initial_schema.sql)
-- Enforces synthetic-only student PII off-chain and idempotent blockchain event indexing.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users & Role Holders
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) NOT NULL UNIQUE CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
  role VARCHAR(16) NOT NULL CHECK (role IN ('ADMIN', 'TEACHER', 'STUDENT')),
  display_name VARCHAR(120) NOT NULL,
  department VARCHAR(80) NOT NULL DEFAULT 'Computer Science & Engineering',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Ephemeral SIWE Authentication Nonces (5-minute TTL, Single-Use)
CREATE TABLE IF NOT EXISTS auth_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) NOT NULL CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
  nonce VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_nonces_wallet ON auth_nonces (wallet_address, expires_at);

-- 3. On-Chain Role Assignment Audit History
CREATE TABLE IF NOT EXISTS role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  role_name VARCHAR(32) NOT NULL CHECK (role_name IN ('DEFAULT_ADMIN_ROLE', 'TEACHER_ROLE')),
  action VARCHAR(16) NOT NULL CHECK (action IN ('GRANTED', 'REVOKED')),
  granted_by_wallet VARCHAR(42) NOT NULL CHECK (granted_by_wallet ~ '^0x[a-fA-F0-9]{40}$'),
  tx_hash VARCHAR(66) NOT NULL CHECK (tx_hash ~ '^0x[a-fA-F0-9]{64}$'),
  block_number BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Synthetic Students (Off-Chain PII Mapped to Salted bytes32 studentIdHash)
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synthetic_roll_no VARCHAR(32) NOT NULL UNIQUE CHECK (synthetic_roll_no ~ '^SYN-[A-Z0-9-]+$'),
  synthetic_name VARCHAR(120) NOT NULL,
  student_id_hash VARCHAR(66) NOT NULL UNIQUE CHECK (student_id_hash ~ '^0x[a-fA-F0-9]{64}$'),
  wallet_address VARCHAR(42) NULL UNIQUE CHECK (wallet_address IS NULL OR wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
  claim_code VARCHAR(32) NOT NULL UNIQUE,
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 10),
  department VARCHAR(80) NOT NULL DEFAULT 'Computer Science & Engineering',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_hash ON students (student_id_hash);

-- 5. Academic Courses / Subjects
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code VARCHAR(24) NOT NULL UNIQUE,
  course_id_hash VARCHAR(66) NOT NULL UNIQUE CHECK (course_id_hash ~ '^0x[a-fA-F0-9]{64}$'),
  title VARCHAR(160) NOT NULL,
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 10),
  teacher_wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  tx_hash VARCHAR(66) NULL CHECK (tx_hash IS NULL OR tx_hash ~ '^0x[a-fA-F0-9]{64}$'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Course Cohort Enrollments
CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id_hash VARCHAR(66) NOT NULL,
  student_id_hash VARCHAR(66) NOT NULL,
  on_chain_enrolled BOOLEAN NOT NULL DEFAULT FALSE,
  tx_hash VARCHAR(66) NULL CHECK (tx_hash IS NULL OR tx_hash ~ '^0x[a-fA-F0-9]{64}$'),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, student_id),
  UNIQUE (course_id_hash, student_id_hash)
);

-- 7. Blockchain Transactions Ledger
CREATE TABLE IF NOT EXISTS blockchain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id INTEGER NOT NULL CHECK (chain_id IN (31337, 11155111)),
  tx_hash VARCHAR(66) NOT NULL UNIQUE CHECK (tx_hash ~ '^0x[a-fA-F0-9]{64}$'),
  function_name VARCHAR(64) NOT NULL,
  signer_wallet VARCHAR(42) NOT NULL CHECK (signer_wallet ~ '^0x[a-fA-F0-9]{40}$'),
  status VARCHAR(16) NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'REVERTED', 'REPLACED')),
  block_number BIGINT NULL,
  gas_used BIGINT NULL,
  confirmed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Lecture Sessions
CREATE TABLE IF NOT EXISTS lecture_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  on_chain_session_id BIGINT NOT NULL UNIQUE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  course_id_hash VARCHAR(66) NOT NULL,
  teacher_wallet VARCHAR(42) NOT NULL,
  topic VARCHAR(200) NOT NULL,
  metadata_hash VARCHAR(66) NOT NULL CHECK (metadata_hash ~ '^0x[a-fA-F0-9]{64}$'),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
  qr_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  late_cutoff_minutes INTEGER NOT NULL DEFAULT 15,
  open_tx_hash VARCHAR(66) NULL,
  close_tx_hash VARCHAR(66) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_sessions_course ON lecture_sessions (course_id_hash, status);

-- 9. Rotating 30-Second Dynamic QR Challenges
CREATE TABLE IF NOT EXISTS qr_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES lecture_sessions(id) ON DELETE CASCADE,
  token_hash VARCHAR(66) NOT NULL UNIQUE,
  display_pin VARCHAR(12) NOT NULL,
  mark_as_late BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_challenges_session ON qr_challenges (session_id, expires_at DESC);

-- 10. Attendance Records (Draft + Confirmed On-Chain State)
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES lecture_sessions(id) ON DELETE CASCADE,
  on_chain_session_id BIGINT NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_id_hash VARCHAR(66) NOT NULL,
  draft_status VARCHAR(16) NOT NULL DEFAULT 'NONE' CHECK (draft_status IN ('NONE', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  on_chain_status VARCHAR(16) NOT NULL DEFAULT 'NONE' CHECK (on_chain_status IN ('NONE', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  check_in_method VARCHAR(24) NOT NULL DEFAULT 'NONE' CHECK (check_in_method IN ('NONE', 'QR_VERIFIED', 'TEACHER_MANUAL', 'CORRECTION')),
  qr_signature TEXT NULL,
  amendment_count INTEGER NOT NULL DEFAULT 0 CHECK (amendment_count >= 0),
  updated_by_wallet VARCHAR(42) NULL,
  tx_hash VARCHAR(66) NULL,
  block_number BIGINT NULL,
  log_index INTEGER NULL,
  recorded_at TIMESTAMPTZ NULL,
  amended_at TIMESTAMPTZ NULL,
  UNIQUE (on_chain_session_id, student_id_hash)
);

CREATE INDEX IF NOT EXISTS idx_attendance_student_course ON attendance_records (student_id_hash, on_chain_session_id);

-- 11. Attendance Corrections & Student Dispute Requests
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  on_chain_session_id BIGINT NOT NULL,
  student_id_hash VARCHAR(66) NOT NULL,
  requested_by_wallet VARCHAR(42) NOT NULL,
  request_status VARCHAR(24) NOT NULL CHECK (request_status IN ('PENDING_DISPUTE', 'APPROVED_ON_CHAIN', 'REJECTED')),
  previous_status VARCHAR(16) NOT NULL CHECK (previous_status IN ('NONE', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  new_status VARCHAR(16) NOT NULL CHECK (new_status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  reason_text TEXT NOT NULL CHECK (char_length(trim(reason_text)) >= 10),
  reason_hash VARCHAR(66) NOT NULL CHECK (reason_hash ~ '^0x[a-fA-F0-9]{64}$'),
  approved_by_wallet VARCHAR(42) NULL,
  tx_hash VARCHAR(66) NULL,
  block_number BIGINT NULL,
  log_index INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Idempotent Indexed Contract Events Ledger (NFR-007)
CREATE TABLE IF NOT EXISTS indexed_contract_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id INTEGER NOT NULL CHECK (chain_id IN (31337, 11155111)),
  tx_hash VARCHAR(66) NOT NULL CHECK (tx_hash ~ '^0x[a-fA-F0-9]{64}$'),
  log_index INTEGER NOT NULL CHECK (log_index >= 0),
  block_number BIGINT NOT NULL,
  event_name VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, tx_hash, log_index)
);
