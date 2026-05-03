-- Replace the email and subject IDs below with real values from your project.
-- This script assigns a teacher to specific seeded subjects.

with target_teacher as (
  select user_id
  from public.profiles
  where email = 'teacher@example.com'
)
insert into public.teacher_subjects (teacher_id, subject_id, course, branch, semester)
select
  target_teacher.user_id,
  subject_catalog.id,
  subject_catalog.course,
  subject_catalog.branch,
  subject_catalog.semester
from target_teacher
join public.subjects as subject_catalog
  on subject_catalog.id in (
    'btech-cse-sem3-dsa',
    'btech-cse-sem3-oop',
    'btech-cse-sem4-dbms'
  )
on conflict (teacher_id, subject_id) do nothing;
