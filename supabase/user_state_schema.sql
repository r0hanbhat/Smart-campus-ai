create extension if not exists "pgcrypto";

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  events jsonb not null default '[]'::jsonb,
  clubs jsonb not null default '[]'::jsonb,
  reminders jsonb not null default '[]'::jsonb,
  deadlines jsonb not null default '[]'::jsonb,
  profile jsonb not null default '{"eventsAttended":0,"clubsJoined":0}'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_user_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists user_state_set_updated_at on public.user_state;
create trigger user_state_set_updated_at
before update on public.user_state
for each row
execute function public.set_user_state_updated_at();

alter table public.user_state enable row level security;

drop policy if exists "users can view own user state" on public.user_state;
create policy "users can view own user state"
on public.user_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can insert own user state" on public.user_state;
create policy "users can insert own user state"
on public.user_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "users can update own user state" on public.user_state;
create policy "users can update own user state"
on public.user_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can delete own user state" on public.user_state;
create policy "users can delete own user state"
on public.user_state
for delete
to authenticated
using (auth.uid() = user_id);
