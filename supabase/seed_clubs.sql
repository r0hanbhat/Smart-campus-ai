-- ============================================================
-- CLUB SEED DATA — Ready to run
-- Run AFTER club_events_schema.sql
-- Default password for ALL clubs: Club@1234
-- ============================================================
-- To change a club's password later:
--   1. Generate a new hash:  node supabase/generate_club_hashes.js
--   2. Run:  UPDATE public.clubs SET password_hash = '<new_hash>' WHERE login_id = 'cs_club';
-- ============================================================

insert into public.clubs (club_name, login_id, password_hash, coordinator_id)
values
  ('Computer Science Club', 'cs_club',       '$2b$10$SLRelU2WrR/5C5mwntCYQu8nIYCK/L.WRwd.pIGviskBkZTb1uZL2', null),
  ('Cultural Club',         'cultural_club', '$2b$10$kFO2iMPdYItBT.RsAJyv5eP4Fdxw1s1AjWWho9XXKwvIR5YWc4gdO', null),
  ('Sports Club',           'sports_club',   '$2b$10$neTw6HGpIa2MPwtZsO85ruRcXnYZ190Q98oBSpax.UqHreMhDXvLm', null),
  ('Robotics Club',         'robotics_club', '$2b$10$tg6zeZXa6ERKhrW358FRIe1zVle91U8OPTmwSjqf1XokcdZd2U4ey', null)
on conflict (login_id) do update set password_hash = excluded.password_hash;

-- ============================================================
-- STEP 4: Assign coordinators AFTER this insert.
-- Find your teacher user_ids by running:
--
--   SELECT user_id, display_name, email FROM public.profiles WHERE role = 'teacher';
--
-- Then assign:
--
--   UPDATE public.clubs SET coordinator_id = '<teacher_user_id>' WHERE login_id = 'cs_club';
--   UPDATE public.clubs SET coordinator_id = '<teacher_user_id>' WHERE login_id = 'cultural_club';
--   UPDATE public.clubs SET coordinator_id = '<teacher_user_id>' WHERE login_id = 'sports_club';
--   UPDATE public.clubs SET coordinator_id = '<teacher_user_id>' WHERE login_id = 'robotics_club';
-- ============================================================
