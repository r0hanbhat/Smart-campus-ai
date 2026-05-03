-- ============================================================
-- SEED: Test Students for Attendance System (FIXED)
-- Run in Supabase SQL Editor AFTER attendance_schema.sql
-- Creates dummy profiles first to satisfy the FK constraint,
-- then inserts matching student records.
-- ============================================================

-- Step 1: Insert dummy profile rows for each test student.
INSERT INTO public.profiles (user_id, role, display_name, email, course, branch, semester, roll_number, verification_status)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'student', 'Aarav Sharma',   'aarav.sharma@test.local',   'B.Tech', 'CSE', 8, 'BT-CSE-8-001', 'approved'),
  ('00000000-0000-0000-0000-000000000102', 'student', 'Priya Singh',    'priya.singh@test.local',    'B.Tech', 'CSE', 8, 'BT-CSE-8-002', 'approved'),
  ('00000000-0000-0000-0000-000000000103', 'student', 'Rohan Verma',    'rohan.verma@test.local',    'B.Tech', 'CSE', 8, 'BT-CSE-8-003', 'approved'),
  ('00000000-0000-0000-0000-000000000104', 'student', 'Ananya Gupta',   'ananya.gupta@test.local',   'B.Tech', 'CSE', 8, 'BT-CSE-8-004', 'approved'),
  ('00000000-0000-0000-0000-000000000105', 'student', 'Karan Mehta',    'karan.mehta@test.local',    'B.Tech', 'CSE', 8, 'BT-CSE-8-005', 'approved'),
  ('00000000-0000-0000-0000-000000000201', 'student', 'Divya Patel',    'divya.patel@test.local',    'B.Tech', 'CSE', 6, 'BT-CSE-6-001', 'approved'),
  ('00000000-0000-0000-0000-000000000202', 'student', 'Arjun Nair',     'arjun.nair@test.local',     'B.Tech', 'CSE', 6, 'BT-CSE-6-002', 'approved'),
  ('00000000-0000-0000-0000-000000000203', 'student', 'Sneha Reddy',    'sneha.reddy@test.local',    'B.Tech', 'CSE', 6, 'BT-CSE-6-003', 'approved'),
  ('00000000-0000-0000-0000-000000000204', 'student', 'Vikram Joshi',   'vikram.joshi@test.local',   'B.Tech', 'CSE', 6, 'BT-CSE-6-004', 'approved'),
  ('00000000-0000-0000-0000-000000000205', 'student', 'Neha Kapoor',    'neha.kapoor@test.local',    'B.Tech', 'CSE', 6, 'BT-CSE-6-005', 'approved'),
  ('00000000-0000-0000-0000-000000000301', 'student', 'Rahul Kumar',    'rahul.kumar@test.local',    'B.Tech', 'CSE', 4, 'BT-CSE-4-001', 'approved'),
  ('00000000-0000-0000-0000-000000000302', 'student', 'Pooja Saxena',   'pooja.saxena@test.local',   'B.Tech', 'CSE', 4, 'BT-CSE-4-002', 'approved'),
  ('00000000-0000-0000-0000-000000000303', 'student', 'Manish Tiwari',  'manish.tiwari@test.local',  'B.Tech', 'CSE', 4, 'BT-CSE-4-003', 'approved'),
  ('00000000-0000-0000-0000-000000000304', 'student', 'Kavita Mishra',  'kavita.mishra@test.local',  'B.Tech', 'CSE', 4, 'BT-CSE-4-004', 'approved'),
  ('00000000-0000-0000-0000-000000000305', 'student', 'Amit Pandey',    'amit.pandey@test.local',    'B.Tech', 'CSE', 4, 'BT-CSE-4-005', 'approved'),
  ('00000000-0000-0000-0000-000000000401', 'student', 'Suresh Yadav',   'suresh.yadav@test.local',   'B.Tech', 'CSE', 2, 'BT-CSE-2-001', 'approved'),
  ('00000000-0000-0000-0000-000000000402', 'student', 'Ritu Agarwal',   'ritu.agarwal@test.local',   'B.Tech', 'CSE', 2, 'BT-CSE-2-002', 'approved'),
  ('00000000-0000-0000-0000-000000000403', 'student', 'Deepak Chauhan', 'deepak.chauhan@test.local', 'B.Tech', 'CSE', 2, 'BT-CSE-2-003', 'approved'),
  ('00000000-0000-0000-0000-000000000404', 'student', 'Meena Bhatt',    'meena.bhatt@test.local',    'B.Tech', 'CSE', 2, 'BT-CSE-2-004', 'approved'),
  ('00000000-0000-0000-0000-000000000405', 'student', 'Tarun Shah',     'tarun.shah@test.local',     'B.Tech', 'CSE', 2, 'BT-CSE-2-005', 'approved'),
  ('00000000-0000-0000-0000-000000000501', 'student', 'Alok Srivastava','alok.srivastava@test.local','B.Tech', 'ECE', 8, 'BT-ECE-8-001', 'approved'),
  ('00000000-0000-0000-0000-000000000502', 'student', 'Swati Dubey',    'swati.dubey@test.local',    'B.Tech', 'ECE', 8, 'BT-ECE-8-002', 'approved'),
  ('00000000-0000-0000-0000-000000000503', 'student', 'Nikhil Rawat',   'nikhil.rawat@test.local',   'B.Tech', 'ECE', 8, 'BT-ECE-8-003', 'approved'),
  ('00000000-0000-0000-0000-000000000504', 'student', 'Pallavi Goel',   'pallavi.goel@test.local',   'B.Tech', 'ECE', 8, 'BT-ECE-8-004', 'approved'),
  ('00000000-0000-0000-0000-000000000505', 'student', 'Shubham Singh',  'shubham.singh@test.local',  'B.Tech', 'ECE', 8, 'BT-ECE-8-005', 'approved'),
  ('00000000-0000-0000-0000-000000000601', 'student', 'Ankita Chandra', 'ankita.chandra@test.local', 'B.Tech', 'ECE', 6, 'BT-ECE-6-001', 'approved'),
  ('00000000-0000-0000-0000-000000000602', 'student', 'Gaurav Thakur',  'gaurav.thakur@test.local',  'B.Tech', 'ECE', 6, 'BT-ECE-6-002', 'approved'),
  ('00000000-0000-0000-0000-000000000603', 'student', 'Harsha Pillai',  'harsha.pillai@test.local',  'B.Tech', 'ECE', 6, 'BT-ECE-6-003', 'approved'),
  ('00000000-0000-0000-0000-000000000604', 'student', 'Isha Menon',     'isha.menon@test.local',     'B.Tech', 'ECE', 6, 'BT-ECE-6-004', 'approved'),
  ('00000000-0000-0000-0000-000000000605', 'student', 'Jayesh Bose',    'jayesh.bose@test.local',    'B.Tech', 'ECE', 6, 'BT-ECE-6-005', 'approved')
ON CONFLICT (user_id) DO NOTHING;

-- Step 2: Insert students referencing those profiles.
INSERT INTO public.students (user_id, name, roll_number, course, branch, semester)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'Aarav Sharma',   'BT-CSE-8-001', 'B.Tech', 'CSE', 8),
  ('00000000-0000-0000-0000-000000000102', 'Priya Singh',    'BT-CSE-8-002', 'B.Tech', 'CSE', 8),
  ('00000000-0000-0000-0000-000000000103', 'Rohan Verma',    'BT-CSE-8-003', 'B.Tech', 'CSE', 8),
  ('00000000-0000-0000-0000-000000000104', 'Ananya Gupta',   'BT-CSE-8-004', 'B.Tech', 'CSE', 8),
  ('00000000-0000-0000-0000-000000000105', 'Karan Mehta',    'BT-CSE-8-005', 'B.Tech', 'CSE', 8),
  ('00000000-0000-0000-0000-000000000201', 'Divya Patel',    'BT-CSE-6-001', 'B.Tech', 'CSE', 6),
  ('00000000-0000-0000-0000-000000000202', 'Arjun Nair',     'BT-CSE-6-002', 'B.Tech', 'CSE', 6),
  ('00000000-0000-0000-0000-000000000203', 'Sneha Reddy',    'BT-CSE-6-003', 'B.Tech', 'CSE', 6),
  ('00000000-0000-0000-0000-000000000204', 'Vikram Joshi',   'BT-CSE-6-004', 'B.Tech', 'CSE', 6),
  ('00000000-0000-0000-0000-000000000205', 'Neha Kapoor',    'BT-CSE-6-005', 'B.Tech', 'CSE', 6),
  ('00000000-0000-0000-0000-000000000301', 'Rahul Kumar',    'BT-CSE-4-001', 'B.Tech', 'CSE', 4),
  ('00000000-0000-0000-0000-000000000302', 'Pooja Saxena',   'BT-CSE-4-002', 'B.Tech', 'CSE', 4),
  ('00000000-0000-0000-0000-000000000303', 'Manish Tiwari',  'BT-CSE-4-003', 'B.Tech', 'CSE', 4),
  ('00000000-0000-0000-0000-000000000304', 'Kavita Mishra',  'BT-CSE-4-004', 'B.Tech', 'CSE', 4),
  ('00000000-0000-0000-0000-000000000305', 'Amit Pandey',    'BT-CSE-4-005', 'B.Tech', 'CSE', 4),
  ('00000000-0000-0000-0000-000000000401', 'Suresh Yadav',   'BT-CSE-2-001', 'B.Tech', 'CSE', 2),
  ('00000000-0000-0000-0000-000000000402', 'Ritu Agarwal',   'BT-CSE-2-002', 'B.Tech', 'CSE', 2),
  ('00000000-0000-0000-0000-000000000403', 'Deepak Chauhan', 'BT-CSE-2-003', 'B.Tech', 'CSE', 2),
  ('00000000-0000-0000-0000-000000000404', 'Meena Bhatt',    'BT-CSE-2-004', 'B.Tech', 'CSE', 2),
  ('00000000-0000-0000-0000-000000000405', 'Tarun Shah',     'BT-CSE-2-005', 'B.Tech', 'CSE', 2),
  ('00000000-0000-0000-0000-000000000501', 'Alok Srivastava','BT-ECE-8-001', 'B.Tech', 'ECE', 8),
  ('00000000-0000-0000-0000-000000000502', 'Swati Dubey',    'BT-ECE-8-002', 'B.Tech', 'ECE', 8),
  ('00000000-0000-0000-0000-000000000503', 'Nikhil Rawat',   'BT-ECE-8-003', 'B.Tech', 'ECE', 8),
  ('00000000-0000-0000-0000-000000000504', 'Pallavi Goel',   'BT-ECE-8-004', 'B.Tech', 'ECE', 8),
  ('00000000-0000-0000-0000-000000000505', 'Shubham Singh',  'BT-ECE-8-005', 'B.Tech', 'ECE', 8),
  ('00000000-0000-0000-0000-000000000601', 'Ankita Chandra', 'BT-ECE-6-001', 'B.Tech', 'ECE', 6),
  ('00000000-0000-0000-0000-000000000602', 'Gaurav Thakur',  'BT-ECE-6-002', 'B.Tech', 'ECE', 6),
  ('00000000-0000-0000-0000-000000000603', 'Harsha Pillai',  'BT-ECE-6-003', 'B.Tech', 'ECE', 6),
  ('00000000-0000-0000-0000-000000000604', 'Isha Menon',     'BT-ECE-6-004', 'B.Tech', 'ECE', 6),
  ('00000000-0000-0000-0000-000000000605', 'Jayesh Bose',    'BT-ECE-6-005', 'B.Tech', 'ECE', 6)
ON CONFLICT (user_id) DO NOTHING;
