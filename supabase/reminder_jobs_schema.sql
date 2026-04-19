create extension if not exists "pgcrypto";

create table if not exists public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  job_key text not null,
  item_id text not null,
  item_name text not null,
  item_type text not null check (item_type in ('reminder', 'deadline')),
  date text not null,
  time text not null,
  offset_hours integer not null check (offset_hours in (0, 2, 6)),
  delivery_reason text not null default 'scheduled' check (delivery_reason in ('scheduled')),
  event_at timestamptz not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled', 'failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, job_key)
);

create or replace function public.set_reminder_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists reminder_jobs_set_updated_at on public.reminder_jobs;
create trigger reminder_jobs_set_updated_at
before update on public.reminder_jobs
for each row
execute function public.set_reminder_jobs_updated_at();

create index if not exists reminder_jobs_user_status_scheduled_for_idx
on public.reminder_jobs (user_id, status, scheduled_for);

create index if not exists reminder_jobs_status_scheduled_for_idx
on public.reminder_jobs (status, scheduled_for);

alter table public.reminder_jobs enable row level security;

drop policy if exists "users can view own reminder jobs" on public.reminder_jobs;
create policy "users can view own reminder jobs"
on public.reminder_jobs
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can manage own reminder jobs" on public.reminder_jobs;
create policy "users can manage own reminder jobs"
on public.reminder_jobs
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
