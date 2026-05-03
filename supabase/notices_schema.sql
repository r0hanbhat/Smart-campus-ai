-- ============================================================
-- NOTICES SCHEMA
-- Run in Supabase SQL Editor
-- ============================================================

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  target_role text not null check (target_role in ('student', 'teacher', 'all')),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists notices_target_role_idx on public.notices (target_role, created_at desc);
create index if not exists notices_created_at_idx on public.notices (created_at desc);

alter table public.notices enable row level security;

-- Admin can do everything
drop policy if exists "admins manage notices" on public.notices;
create policy "admins manage notices"
on public.notices
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Authenticated users can read notices targeted at their role or 'all'
drop policy if exists "users read own role notices" on public.notices;
create policy "users read own role notices"
on public.notices
for select
to authenticated
using (
  target_role = 'all'
  or target_role = (
    select role from public.profiles
    where profiles.user_id = auth.uid()
    limit 1
  )
  or public.is_admin()
);
