-- ============================================================
-- JCUFA GROUP CHAT SCHEMA
-- Run in Supabase SQL Editor
-- ============================================================

-- Step 1: Add jcufa_position to profiles
alter table public.profiles add column if not exists jcufa_position text
  check (jcufa_position in ('President', 'Vice President', 'Secretary', 'Treasurer', 'Member', 'Other'));

-- Step 2: JCUFA Chat Groups table (3 fixed groups, seeded below)
create table if not exists public.jcufa_chat_groups (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('announcement', 'official', 'unofficial')),
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

-- Step 3: JCUFA Messages table
create table if not exists public.jcufa_messages (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.jcufa_chat_groups(id) on delete cascade,
  sender_id    uuid not null references public.profiles(user_id) on delete cascade,
  content      text not null check (char_length(trim(content)) > 0),
  is_deleted   boolean not null default false,
  updated_at   timestamptz,
  created_at   timestamptz not null default timezone('utc', now())
);

create index if not exists jcufa_messages_group_id_idx on public.jcufa_messages (group_id, created_at desc);

-- Step 4: Acknowledgments table (only for announcement group messages)
create table if not exists public.jcufa_acknowledgments (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references public.jcufa_messages(id) on delete cascade,
  user_id         uuid not null references public.profiles(user_id) on delete cascade,
  acknowledged_at timestamptz not null default timezone('utc', now()),
  unique (message_id, user_id)
);

create index if not exists jcufa_ack_message_id_idx on public.jcufa_acknowledgments (message_id);

-- ============================================================
-- SEED: The 3 permanent JCUFA groups
-- ============================================================
insert into public.jcufa_chat_groups (name, type, description)
values
  ('JCUFA Announcements',       'announcement', 'Official announcements from JCUFA position holders. All members must acknowledge.'),
  ('JCUFA Official Discussion', 'official',     'Formal discussions and official faculty communication.'),
  ('JCUFA Unofficial',          'unofficial',   'Casual conversations and general discussion.')
on conflict do nothing;

-- ============================================================
-- HELPER FUNCTION: Is the current user a JCUFA position holder?
-- ============================================================
create or replace function public.is_jcufa_position_holder()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and jcufa_position in ('President', 'Vice President', 'Secretary', 'Treasurer')
  );
$$;

-- ============================================================
-- HELPER FUNCTION: Is the current user a JCUFA member?
-- ============================================================
create or replace function public.is_jcufa_member()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and jcufa_position is not null
      and role = 'teacher'
  );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.jcufa_chat_groups   enable row level security;
alter table public.jcufa_messages      enable row level security;
alter table public.jcufa_acknowledgments enable row level security;

-- Groups: all JCUFA members (or admins) can view
drop policy if exists "jcufa members view groups" on public.jcufa_chat_groups;
create policy "jcufa members view groups"
on public.jcufa_chat_groups for select
to authenticated
using (public.is_jcufa_member() or public.is_admin());

-- Messages: all JCUFA members can view non-deleted messages
drop policy if exists "jcufa members view messages" on public.jcufa_messages;
create policy "jcufa members view messages"
on public.jcufa_messages for select
to authenticated
using (
  is_deleted = false
  and (public.is_jcufa_member() or public.is_admin())
);

-- Messages: insert requires JCUFA membership
-- For announcement group, also requires position holder
drop policy if exists "jcufa members send messages" on public.jcufa_messages;
create policy "jcufa members send messages"
on public.jcufa_messages for insert
to authenticated
with check (
  auth.uid() = sender_id
  and (
    -- For non-announcement groups: any JCUFA member can post
    exists (
      select 1 from public.jcufa_chat_groups g
      where g.id = group_id and g.type != 'announcement'
    )
    and public.is_jcufa_member()
  )
  or (
    -- For announcement group: only position holders
    exists (
      select 1 from public.jcufa_chat_groups g
      where g.id = group_id and g.type = 'announcement'
    )
    and public.is_jcufa_position_holder()
  )
  or public.is_admin()
);

-- Messages: soft-delete by sender or admin
drop policy if exists "jcufa sender can soft delete" on public.jcufa_messages;
create policy "jcufa sender can soft delete"
on public.jcufa_messages for update
to authenticated
using (auth.uid() = sender_id or public.is_admin())
with check (auth.uid() = sender_id or public.is_admin());

-- Acknowledgments: any JCUFA member can insert (acknowledge) once per message
drop policy if exists "jcufa members can acknowledge" on public.jcufa_acknowledgments;
create policy "jcufa members can acknowledge"
on public.jcufa_acknowledgments for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.is_jcufa_member()
);

-- Acknowledgments: position holders and admins can see all; others see own only
drop policy if exists "jcufa ack select" on public.jcufa_acknowledgments;
create policy "jcufa ack select"
on public.jcufa_acknowledgments for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_jcufa_position_holder()
  or public.is_admin()
);

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.jcufa_messages;
alter publication supabase_realtime add table public.jcufa_acknowledgments;
