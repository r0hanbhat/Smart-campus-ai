-- ============================================================
-- RLS POLICY FIXES
-- Run in Supabase SQL Editor
-- ============================================================
-- 1. Allow teachers to manage subjects (create/update/delete)
-- 2. Allow teachers to mark attendance even without teacher_subjects rows
-- ============================================================

-- Allow teachers and admins to insert subjects
drop policy if exists "teachers and admins manage subjects" on public.subjects;
create policy "teachers and admins manage subjects"
on public.subjects
for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('teacher', 'admin')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('teacher', 'admin')
  )
);

-- Drop the old admin-only policy (replaced above)
drop policy if exists "admins manage subjects" on public.subjects;

-- Fix attendance INSERT: allow any approved teacher to mark attendance
-- (not just those with teacher_subjects assignments)
drop policy if exists "attendance insert by teacher or admin" on public.attendance;
create policy "attendance insert by teacher or admin"
on public.attendance
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('teacher', 'admin')
  )
);

-- Fix attendance UPDATE: same — any teacher can update
drop policy if exists "attendance update by teacher or admin" on public.attendance;
create policy "attendance update by teacher or admin"
on public.attendance
for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('teacher', 'admin')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('teacher', 'admin')
  )
);

-- Fix attendance SELECT: also allow teachers to see all attendance they marked
drop policy if exists "attendance visible to owner or staff" on public.attendance;
create policy "attendance visible to owner or staff"
on public.attendance
for select
to authenticated
using (
  -- student sees their own
  exists (
    select 1 from public.students
    where students.id = attendance.student_id
      and students.user_id = auth.uid()
  )
  -- any teacher or admin sees all
  or exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('teacher', 'admin')
  )
);

-- Also allow teachers to auto-provision student rows
drop policy if exists "students can manage own student row" on public.students;
create policy "students can manage own student row"
on public.students
for all
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('teacher', 'admin')
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('teacher', 'admin')
  )
);
