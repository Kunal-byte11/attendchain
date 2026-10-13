-- AttendChain Synthetic Demonstration Seed Data (SYN-* Only - Zero Real PII)
-- Uses deterministic Hardhat test accounts (#0 Admin, #1 Teacher, #2-#4 Students)

INSERT INTO users (wallet_address, role, display_name, department, is_active)
VALUES
  ('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 'ADMIN', 'Dr. Rajesh Sharma (Demo Admin)', 'Academic Administration', TRUE),
  ('0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 'TEACHER', 'Prof. Ananya Verma', 'Computer Science & Engineering', TRUE),
  ('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'STUDENT', 'Aarav Mehta (SYN-2026-042)', 'Computer Science & Engineering', TRUE),
  ('0x90F79bf6EB2c4f870365E785982E1f101E93b906', 'STUDENT', 'Diya Nair (SYN-2026-019)', 'Computer Science & Engineering', TRUE)
ON CONFLICT (wallet_address) DO NOTHING;

-- Synthetic student profiles with deterministic salted hashes (salt = 0x1111...1111)
INSERT INTO students (synthetic_roll_no, synthetic_name, student_id_hash, wallet_address, claim_code, semester, department)
VALUES
  (
    'SYN-2026-042',
    'Aarav Mehta',
    '0x72596763865384116224739a835a123025517546936222177886350693572149',
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    'CLAIM-SYN-042',
    7,
    'Computer Science & Engineering'
  ),
  (
    'SYN-2026-019',
    'Diya Nair',
    '0x4a19942900981530871098409182309481092830498102938409128309481029',
    '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    'CLAIM-SYN-019',
    7,
    'Computer Science & Engineering'
  ),
  (
    'SYN-2026-007',
    'Rohan Kulkarni',
    '0x8b22334455667788990011223344556677889900112233445566778899001122',
    NULL,
    'CLAIM-SYN-007',
    7,
    'Computer Science & Engineering'
  )
ON CONFLICT (synthetic_roll_no) DO NOTHING;
