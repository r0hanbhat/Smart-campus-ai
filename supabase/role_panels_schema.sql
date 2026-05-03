create extension if not exists "pgcrypto";

alter table public.profiles
  add column if not exists role text not null default 'student',
  add column if not exists verification_status text not null default 'approved',
  add column if not exists phone_number text,
  add column if not exists phone_verified boolean not null default false,
  add column if not exists employee_id text,
  add column if not exists admin_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('student', 'teacher', 'admin'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_verification_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_verification_status_check
      check (verification_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create table if not exists public.teacher_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(user_id) on delete cascade,
  email text not null,
  full_name text not null,
  phone_number text,
  employee_id text not null,
  employee_id_image_name text,
  employee_id_image_data text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(user_id) on delete cascade,
  session_key text not null unique,
  device_name text,
  ip_address text,
  user_agent text,
  location_label text,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete set null,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  action text not null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_teacher_verification_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists teacher_verification_requests_set_updated_at on public.teacher_verification_requests;
create trigger teacher_verification_requests_set_updated_at
before update on public.teacher_verification_requests
for each row
execute function public.set_teacher_verification_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

alter table public.teacher_verification_requests enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "teachers can view own verification request" on public.teacher_verification_requests;
create policy "teachers can view own verification request"
on public.teacher_verification_requests
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "teachers can insert own verification request" on public.teacher_verification_requests;
create policy "teachers can insert own verification request"
on public.teacher_verification_requests
for insert
to authenticated
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "admins can update teacher verification requests" on public.teacher_verification_requests;
create policy "admins can update teacher verification requests"
on public.teacher_verification_requests
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins can view admin sessions" on public.admin_sessions;
create policy "admins can view admin sessions"
on public.admin_sessions
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins can manage own sessions" on public.admin_sessions;
create policy "admins can manage own sessions"
on public.admin_sessions
for all
to authenticated
using (public.is_admin() and auth.uid() = admin_user_id)
with check (public.is_admin() and auth.uid() = admin_user_id);

drop policy if exists "users can view own activity logs" on public.activity_logs;
create policy "users can view own activity logs"
on public.activity_logs
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "users can insert own activity logs" on public.activity_logs;
create policy "users can insert own activity logs"
on public.activity_logs
for insert
to authenticated
with check (auth.uid() = user_id or public.is_admin());
