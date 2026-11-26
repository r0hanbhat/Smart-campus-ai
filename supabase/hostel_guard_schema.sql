-- Run after hostel_gate_passes.sql. The account seed is a separate command.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to service_role;

create table if not exists public.hostel_guards (
  guard_id text primary key,
  password_hash text not null,
  is_active boolean not null default true,
  failures integer not null default 0,
  locked_until timestamptz
);
create table if not exists public.hostel_guard_sessions (
  token_hash text primary key,
  guard_id text not null references public.hostel_guards on delete cascade,
  expires_at timestamptz not null
);
create index if not exists hostel_guard_sessions_expiry on public.hostel_guard_sessions(expires_at);

create or replace function public.login_hostel_guard(login_id text, passcode text, session_hash text)
returns boolean language plpgsql set search_path = public, extensions as $$
declare
  account public.hostel_guards%rowtype;
begin
  select * into account from public.hostel_guards where guard_id = login_id and is_active for update;
  if not found or account.locked_until > now() then return false; end if;
  if crypt(passcode, account.password_hash) is distinct from account.password_hash then
    update public.hostel_guards set failures = (failures + 1) % 5,
      locked_until = case when failures >= 4 then now() + interval '15 minutes' end
      where guard_id = login_id;
    return false;
  end if;
  update public.hostel_guards set failures = 0, locked_until = null where guard_id = login_id;
  delete from public.hostel_guard_sessions where expires_at <= now();
  insert into public.hostel_guard_sessions values(session_hash, login_id, now() + interval '8 hours');
  return true;
end;
$$;

-- Keep daily scan times after the operational QR is replaced on the next day.
create table if not exists public.hostel_daily_scan_history (
  resident_id uuid references public.hostel_residents(user_id) on delete cascade,
  pass_day date not null,
  exited_at timestamptz not null,
  entered_at timestamptz,
  primary key (resident_id, pass_day)
);
create or replace function public.archive_hostel_daily_scan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.hostel_daily_scan_history values (new.resident_id,new.pass_day,new.exited_at,new.entered_at)
  on conflict (resident_id,pass_day) do update set entered_at = excluded.entered_at;
  return new;
end;
$$;
drop trigger if exists hostel_daily_scan_record on public.hostel_daily_passes;
create trigger hostel_daily_scan_record after update of exited_at, entered_at on public.hostel_daily_passes
  for each row when (new.exited_at is not null) execute function public.archive_hostel_daily_scan();
insert into public.hostel_daily_scan_history
  select resident_id,pass_day,exited_at,entered_at from public.hostel_daily_passes where exited_at is not null
  on conflict do nothing;

alter table public.hostel_guards enable row level security;
alter table public.hostel_guard_sessions enable row level security;
alter table public.hostel_daily_scan_history enable row level security;
revoke all on public.hostel_guards, public.hostel_guard_sessions, public.hostel_daily_scan_history from public, anon, authenticated;
grant select,update on public.hostel_guards to service_role;
grant select,insert,delete on public.hostel_guard_sessions to service_role;
grant select on public.hostel_daily_scan_history to service_role;
revoke all on function public.login_hostel_guard(text,text,text), public.archive_hostel_daily_scan() from public,anon,authenticated;
grant execute on function public.login_hostel_guard(text,text,text) to service_role;
commit;
