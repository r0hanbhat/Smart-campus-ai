create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists roll_number text,
  add column if not exists course text,
  add column if not exists branch text,
  add column if not exists semester integer;

create unique index if not exists profiles_roll_number_unique_idx
  on public.profiles (roll_number)
  where roll_number is not null;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(user_id) on delete cascade,
  name text not null,
  roll_number text not null unique,
  course text not null,
  branch text not null,
  semester integer not null check (semester >= 1 and semester <= 12),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists students_program_lookup_idx
  on public.students (course, branch, semester, roll_number);

create table if not exists public.subjects (
  id text primary key,
  teacher_user_id uuid references public.profiles(user_id) on delete set null,
  name text not null,
  code text,
  course text not null,
  branch text not null,
  semester integer not null check (semester >= 1 and semester <= 12),
  section text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subjects'
      and column_name = 'teacher_user_id'
  ) then
    execute 'alter table public.subjects alter column teacher_user_id drop not null';
  end if;
end $$;

create unique index if not exists subjects_program_code_unique_idx
  on public.subjects (course, branch, semester, code);

create index if not exists subjects_program_lookup_idx
  on public.subjects (course, branch, semester, name);

create table if not exists public.teacher_subjects (
  teacher_id uuid not null references public.profiles(user_id) on delete cascade,
  subject_id text not null references public.subjects(id) on delete cascade,
  course text not null,
  branch text not null,
  semester integer not null check (semester >= 1 and semester <= 12),
  assigned_at timestamptz not null default timezone('utc', now()),
  primary key (teacher_id, subject_id)
);

create index if not exists teacher_subjects_class_lookup_idx
  on public.teacher_subjects (teacher_id, course, branch, semester);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id text not null references public.subjects(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent')),
  marked_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists attendance_student_subject_date_unique_idx
  on public.attendance (student_id, subject_id, date);

create index if not exists attendance_student_lookup_idx
  on public.attendance (student_id, date desc);

create index if not exists attendance_subject_lookup_idx
  on public.attendance (subject_id, date desc);

create or replace function public.set_students_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.set_subjects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
before update on public.students
for each row
execute function public.set_students_updated_at();

drop trigger if exists subjects_set_updated_at on public.subjects;
create trigger subjects_set_updated_at
before update on public.subjects
for each row
execute function public.set_subjects_updated_at();

insert into public.subjects (id, name, code, course, branch, semester, section)
values
  ('btech-cse-sem1-maths1', 'Engineering Mathematics I', 'MA101', 'B.Tech', 'CSE', 1, 'A'),
  ('btech-cse-sem1-physics', 'Engineering Physics', 'PH101', 'B.Tech', 'CSE', 1, 'A'),
  ('btech-cse-sem1-programming', 'Programming for Problem Solving', 'CS101', 'B.Tech', 'CSE', 1, 'A'),
  ('btech-cse-sem1-electrical', 'Basic Electrical Engineering', 'EE101', 'B.Tech', 'CSE', 1, 'A'),
  ('btech-cse-sem2-maths2', 'Engineering Mathematics II', 'MA102', 'B.Tech', 'CSE', 2, 'A'),
  ('btech-cse-sem2-chemistry', 'Engineering Chemistry', 'CY102', 'B.Tech', 'CSE', 2, 'A'),
  ('btech-cse-sem2-ds', 'Data Structures', 'CS102', 'B.Tech', 'CSE', 2, 'A'),
  ('btech-cse-sem2-electronics', 'Basic Electronics', 'EC102', 'B.Tech', 'CSE', 2, 'A'),
  ('btech-cse-sem3-discrete', 'Discrete Mathematics', 'MA201', 'B.Tech', 'CSE', 3, 'A'),
  ('btech-cse-sem3-dsa', 'Data Structures And Algorithms', 'CS201', 'B.Tech', 'CSE', 3, 'A'),
  ('btech-cse-sem3-digital', 'Digital Logic Design', 'CS202', 'B.Tech', 'CSE', 3, 'A'),
  ('btech-cse-sem3-oop', 'Object Oriented Programming', 'CS203', 'B.Tech', 'CSE', 3, 'A'),
  ('btech-cse-sem4-coa', 'Computer Organization', 'CS204', 'B.Tech', 'CSE', 4, 'A'),
  ('btech-cse-sem4-os', 'Operating Systems', 'CS205', 'B.Tech', 'CSE', 4, 'A'),
  ('btech-cse-sem4-dbms', 'Database Management Systems', 'CS206', 'B.Tech', 'CSE', 4, 'A'),
  ('btech-cse-sem4-java', 'Java Programming', 'CS207', 'B.Tech', 'CSE', 4, 'A'),
  ('btech-cse-sem5-cn', 'Computer Networks', 'CS301', 'B.Tech', 'CSE', 5, 'A'),
  ('btech-cse-sem5-toc', 'Theory Of Computation', 'CS302', 'B.Tech', 'CSE', 5, 'A'),
  ('btech-cse-sem5-se', 'Software Engineering', 'CS303', 'B.Tech', 'CSE', 5, 'A'),
  ('btech-cse-sem5-web', 'Web Technologies', 'CS304', 'B.Tech', 'CSE', 5, 'A'),
  ('btech-cse-sem6-ai', 'Artificial Intelligence', 'CS305', 'B.Tech', 'CSE', 6, 'A'),
  ('btech-cse-sem6-ml', 'Machine Learning', 'CS306', 'B.Tech', 'CSE', 6, 'A'),
  ('btech-cse-sem6-compiler', 'Compiler Design', 'CS307', 'B.Tech', 'CSE', 6, 'A'),
  ('btech-cse-sem6-cloud', 'Cloud Computing', 'CS308', 'B.Tech', 'CSE', 6, 'A'),
  ('btech-cse-sem7-bigdata', 'Big Data Analytics', 'CS401', 'B.Tech', 'CSE', 7, 'A'),
  ('btech-cse-sem7-cyber', 'Cyber Security', 'CS402', 'B.Tech', 'CSE', 7, 'A'),
  ('btech-cse-sem7-mobile', 'Mobile Application Development', 'CS403', 'B.Tech', 'CSE', 7, 'A'),
  ('btech-cse-sem7-iot', 'Internet Of Things', 'CS404', 'B.Tech', 'CSE', 7, 'A'),
  ('btech-cse-sem8-project', 'Major Project', 'CS498', 'B.Tech', 'CSE', 8, 'A'),
  ('btech-cse-sem8-devops', 'DevOps And Automation', 'CS405', 'B.Tech', 'CSE', 8, 'A'),
  ('btech-cse-sem8-blockchain', 'Blockchain Systems', 'CS406', 'B.Tech', 'CSE', 8, 'A'),
  ('btech-cse-sem8-ethics', 'Professional Ethics', 'HU401', 'B.Tech', 'CSE', 8, 'A'),
  ('btech-ece-sem1-maths1', 'Engineering Mathematics I', 'MA101', 'B.Tech', 'ECE', 1, 'A'),
  ('btech-ece-sem1-physics', 'Engineering Physics', 'PH101', 'B.Tech', 'ECE', 1, 'A'),
  ('btech-ece-sem1-programming', 'Programming for Problem Solving', 'CS101', 'B.Tech', 'ECE', 1, 'A'),
  ('btech-ece-sem1-basic-electronics', 'Basic Electronics Engineering', 'EC101', 'B.Tech', 'ECE', 1, 'A'),
  ('btech-ece-sem2-maths2', 'Engineering Mathematics II', 'MA102', 'B.Tech', 'ECE', 2, 'A'),
  ('btech-ece-sem2-chemistry', 'Engineering Chemistry', 'CY102', 'B.Tech', 'ECE', 2, 'A'),
  ('btech-ece-sem2-circuits', 'Circuit Theory', 'EC102', 'B.Tech', 'ECE', 2, 'A'),
  ('btech-ece-sem2-signals', 'Signals And Systems', 'EC103', 'B.Tech', 'ECE', 2, 'A'),
  ('btech-ece-sem3-network', 'Network Analysis', 'EC201', 'B.Tech', 'ECE', 3, 'A'),
  ('btech-ece-sem3-analog', 'Analog Electronics', 'EC202', 'B.Tech', 'ECE', 3, 'A'),
  ('btech-ece-sem3-digital', 'Digital Electronics', 'EC203', 'B.Tech', 'ECE', 3, 'A'),
  ('btech-ece-sem3-probability', 'Probability And Random Processes', 'MA201', 'B.Tech', 'ECE', 3, 'A'),
  ('btech-ece-sem4-emft', 'Electromagnetic Field Theory', 'EC204', 'B.Tech', 'ECE', 4, 'A'),
  ('btech-ece-sem4-analogcomm', 'Analog Communication', 'EC205', 'B.Tech', 'ECE', 4, 'A'),
  ('btech-ece-sem4-microprocessors', 'Microprocessors', 'EC206', 'B.Tech', 'ECE', 4, 'A'),
  ('btech-ece-sem4-control', 'Control Systems', 'EC207', 'B.Tech', 'ECE', 4, 'A'),
  ('btech-ece-sem5-digitalcomm', 'Digital Communication', 'EC301', 'B.Tech', 'ECE', 5, 'A'),
  ('btech-ece-sem5-vlsi', 'VLSI Design', 'EC302', 'B.Tech', 'ECE', 5, 'A'),
  ('btech-ece-sem5-embedded', 'Embedded Systems', 'EC303', 'B.Tech', 'ECE', 5, 'A'),
  ('btech-ece-sem5-dsp', 'Digital Signal Processing', 'EC304', 'B.Tech', 'ECE', 5, 'A'),
  ('btech-ece-sem6-wireless', 'Wireless Communication', 'EC305', 'B.Tech', 'ECE', 6, 'A'),
  ('btech-ece-sem6-antenna', 'Antenna And Wave Propagation', 'EC306', 'B.Tech', 'ECE', 6, 'A'),
  ('btech-ece-sem6-fpga', 'FPGA Based System Design', 'EC307', 'B.Tech', 'ECE', 6, 'A'),
  ('btech-ece-sem6-iot', 'IoT System Design', 'EC308', 'B.Tech', 'ECE', 6, 'A'),
  ('btech-ece-sem7-radar', 'Radar And Satellite Communication', 'EC401', 'B.Tech', 'ECE', 7, 'A'),
  ('btech-ece-sem7-opto', 'Optical Communication', 'EC402', 'B.Tech', 'ECE', 7, 'A'),
  ('btech-ece-sem7-asic', 'ASIC Design', 'EC403', 'B.Tech', 'ECE', 7, 'A'),
  ('btech-ece-sem7-robotics', 'Robotics And Automation', 'EC404', 'B.Tech', 'ECE', 7, 'A'),
  ('btech-ece-sem8-project', 'Major Project', 'EC498', 'B.Tech', 'ECE', 8, 'A'),
  ('btech-ece-sem8-5g', '5G Communication Systems', 'EC405', 'B.Tech', 'ECE', 8, 'A'),
  ('btech-ece-sem8-ev', 'Industrial Electronics', 'EC406', 'B.Tech', 'ECE', 8, 'A'),
  ('btech-ece-sem8-ethics', 'Professional Ethics', 'HU401', 'B.Tech', 'ECE', 8, 'A')
on conflict (id) do nothing;

alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.teacher_subjects enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "students can view own student row" on public.students;
create policy "students can view own student row"
on public.students
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('teacher', 'admin')
  )
);

drop policy if exists "students can manage own student row" on public.students;
drop policy if exists "teachers can upsert student rows" on public.students;
drop policy if exists "teachers can update student rows" on public.students;
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

drop policy if exists "authenticated users can view subjects" on public.subjects;
create policy "authenticated users can view subjects"
on public.subjects
for select
to authenticated
using (true);

drop policy if exists "admins manage subjects" on public.subjects;
create policy "admins manage subjects"
on public.subjects
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "teachers can view own subject assignments" on public.teacher_subjects;
create policy "teachers can view own subject assignments"
on public.teacher_subjects
for select
to authenticated
using (teacher_id = auth.uid() or public.is_admin());

drop policy if exists "admins manage teacher subject assignments" on public.teacher_subjects;
create policy "admins manage teacher subject assignments"
on public.teacher_subjects
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "attendance visible to owner or staff" on public.attendance;
create policy "attendance visible to owner or staff"
on public.attendance
for select
to authenticated
using (
  -- student sees own records
  exists (
    select 1 from public.students
    where students.id = attendance.student_id
      and students.user_id = auth.uid()
  )
  -- any teacher or admin sees all records
  or exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('teacher', 'admin')
  )
);

drop policy if exists "attendance insert by teacher or admin" on public.attendance;
create policy "attendance insert by teacher or admin"
on public.attendance
for insert
to authenticated
with check (
  exists (
    select 1
    from public.teacher_subjects
    where teacher_subjects.subject_id = attendance.subject_id
      and teacher_subjects.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role = 'teacher'
  )
  or public.is_admin()
);

drop policy if exists "attendance update by teacher or admin" on public.attendance;
create policy "attendance update by teacher or admin"
on public.attendance
for update
to authenticated
using (
  exists (
    select 1
    from public.teacher_subjects
    where teacher_subjects.subject_id = attendance.subject_id
      and teacher_subjects.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role = 'teacher'
  )
  or public.is_admin()
)
with check (
  exists (
    select 1
    from public.teacher_subjects
    where teacher_subjects.subject_id = attendance.subject_id
      and teacher_subjects.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role = 'teacher'
  )
  or public.is_admin()
);
