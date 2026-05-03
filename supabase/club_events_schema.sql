-- ============================================================
-- CLUB-BASED EVENT MANAGEMENT SCHEMA
-- Run in Supabase SQL Editor
-- ============================================================

-- Step 1: Clubs table (pre-registered by admin, not self-signup)
create table if not exists public.clubs (
  id             uuid primary key default gen_random_uuid(),
  club_name      text not null,
  login_id       text not null unique,
  password_hash  text not null,
  coordinator_id uuid references public.profiles(user_id) on delete set null,
  created_at     timestamptz not null default timezone('utc', now())
);

-- Step 2: Events table
create table if not exists public.events (
  id                   uuid primary key default gen_random_uuid(),
  club_id              uuid not null references public.clubs(id) on delete cascade,
  title                text not null,
  description          text,
  proposed_date        date not null,
  time_start           time not null,
  time_end             time not null,
  venue                text,
  expected_participants integer default 0,
  status               text not null default 'PENDING_COORDINATOR_APPROVAL'
    check (status in (
      'PENDING_COORDINATOR_APPROVAL',
      'APPROVED_BY_COORDINATOR',
      'REJECTED_BY_COORDINATOR',
      'APPROVED',
      'REJECTED_BY_ADMIN',
      'WITHDRAWN'
    )),
  rejection_reason     text,
  is_published         boolean not null default false,
  version              integer not null default 1,
  created_at           timestamptz not null default timezone('utc', now()),
  updated_at           timestamptz not null default timezone('utc', now())
);

create index if not exists events_club_id_idx      on public.events (club_id);
create index if not exists events_status_idx       on public.events (status);
create index if not exists events_published_idx    on public.events (is_published, proposed_date);
create index if not exists events_coordinator_idx  on public.events (club_id);

-- Prevent exact duplicate active submissions from the same club
create unique index if not exists events_no_duplicate_active
  on public.events (club_id, lower(title), proposed_date)
  where status not in ('REJECTED_BY_COORDINATOR', 'REJECTED_BY_ADMIN', 'WITHDRAWN');

-- Step 3: Event Approvals audit log
create table if not exists public.event_approvals (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  actor_id   uuid not null references public.profiles(user_id) on delete cascade,
  actor_role text not null check (actor_role in ('coordinator', 'admin')),
  action     text not null check (action in ('APPROVED', 'REJECTED')),
  reason     text,
  acted_at   timestamptz not null default timezone('utc', now())
);

create index if not exists event_approvals_event_id_idx on public.event_approvals (event_id);

-- Step 4: Event Registrations (students register for approved events)
create table if not exists public.event_registrations (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  student_id    uuid not null references public.profiles(user_id) on delete cascade,
  registered_at timestamptz not null default timezone('utc', now()),
  unique (event_id, student_id)
);

create index if not exists event_reg_event_id_idx on public.event_registrations (event_id);
create index if not exists event_reg_student_id_idx on public.event_registrations (student_id);

-- ============================================================
-- TRIGGER: auto-update updated_at on events
-- ============================================================
create or replace function public.update_event_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at
  before update on public.events
  for each row
  execute function public.update_event_timestamp();

-- ============================================================
-- HELPER: Is current user the coordinator of this event's club?
-- ============================================================
create or replace function public.is_event_coordinator(target_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    join public.clubs c on c.id = e.club_id
    where e.id = target_event_id
      and c.coordinator_id = auth.uid()
  );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- Note: clubs use a server-side session (not Supabase Auth),
-- so club-facing routes are handled in Next.js API middleware.
-- RLS here covers teacher/admin/student access.
-- ============================================================
alter table public.clubs              enable row level security;
alter table public.events             enable row level security;
alter table public.event_approvals    enable row level security;
alter table public.event_registrations enable row level security;

-- Clubs: admin can manage; coordinators can view their assigned club
drop policy if exists "admin manages clubs" on public.clubs;
create policy "admin manages clubs"
on public.clubs for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "coordinator views own club" on public.clubs;
create policy "coordinator views own club"
on public.clubs for select
to authenticated
using (coordinator_id = auth.uid());

-- Events: published events are visible to all authenticated users (students)
drop policy if exists "public view published events" on public.events;
create policy "public view published events"
on public.events for select
to authenticated
using (is_published = true);

-- Events: coordinators can view events from their club
drop policy if exists "coordinator view club events" on public.events;
create policy "coordinator view club events"
on public.events for select
to authenticated
using (
  exists (
    select 1 from public.clubs c
    where c.id = club_id and c.coordinator_id = auth.uid()
  )
);

-- Events: coordinators can update status (approval/rejection)
drop policy if exists "coordinator update event status" on public.events;
create policy "coordinator update event status"
on public.events for update
to authenticated
using (
  exists (
    select 1 from public.clubs c
    where c.id = club_id and c.coordinator_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.clubs c
    where c.id = club_id and c.coordinator_id = auth.uid()
  )
);

-- Events: admin can do everything
drop policy if exists "admin manages events" on public.events;
create policy "admin manages events"
on public.events for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Event Approvals: coordinators and admins can insert/read
drop policy if exists "approvers manage approvals" on public.event_approvals;
create policy "approvers manage approvals"
on public.event_approvals for all
to authenticated
using (
  actor_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.events e
    join public.clubs c on c.id = e.club_id
    where e.id = event_id and c.coordinator_id = auth.uid()
  )
)
with check (actor_id = auth.uid() or public.is_admin());

-- Registrations: students can register and view own registrations
drop policy if exists "students manage own registrations" on public.event_registrations;
create policy "students manage own registrations"
on public.event_registrations for all
to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

-- Registrations: admin can view all
drop policy if exists "admin view all registrations" on public.event_registrations;
create policy "admin view all registrations"
on public.event_registrations for select
to authenticated
using (public.is_admin());
