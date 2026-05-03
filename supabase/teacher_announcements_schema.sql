create table if not exists public.teacher_announcements (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects(id) on delete cascade,
  subject_name text not null,
  subject_code text,
  course text not null,
  branch text not null,
  semester integer not null check (semester >= 1 and semester <= 12),
  teacher_id uuid not null references public.profiles(user_id) on delete cascade,
  teacher_name text not null,
  message text not null check (char_length(trim(message)) > 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists teacher_announcements_class_idx
  on public.teacher_announcements (course, branch, semester, created_at desc);

create index if not exists teacher_announcements_teacher_idx
  on public.teacher_announcements (teacher_id, created_at desc);

alter table public.teacher_announcements enable row level security;

drop policy if exists "admins manage teacher announcements" on public.teacher_announcements;
create policy "admins manage teacher announcements"
on public.teacher_announcements
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "teachers view own announcements" on public.teacher_announcements;
create policy "teachers view own announcements"
on public.teacher_announcements
for select
to authenticated
using (teacher_id = auth.uid() or public.is_admin());

drop policy if exists "students view class teacher announcements" on public.teacher_announcements;
create policy "students view class teacher announcements"
on public.teacher_announcements
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role = 'student'
      and profiles.course = teacher_announcements.course
      and profiles.branch = teacher_announcements.branch
      and profiles.semester = teacher_announcements.semester
  )
);
