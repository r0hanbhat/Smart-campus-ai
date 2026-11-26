begin;

create table if not exists public.hostel_gate_settings (
  singleton boolean primary key default true check (singleton),
  daily_enabled boolean not null default false
);
insert into public.hostel_gate_settings(singleton) values (true) on conflict do nothing;

-- One operational daily pass per resident. The next day's pass replaces it after return.
create table if not exists public.hostel_daily_passes (
  resident_id uuid primary key references public.hostel_residents(user_id) on delete cascade,
  pass_day date not null,
  token uuid not null unique default gen_random_uuid(),
  exited_at timestamptz,
  entered_at timestamptz
);
alter table public.hostel_outpass_requests
  add column if not exists gate_token uuid unique,
  add column if not exists exited_at timestamptz,
  add column if not exists entered_at timestamptz;
alter table public.hostel_gate_settings enable row level security;
alter table public.hostel_daily_passes enable row level security;
revoke all on public.hostel_gate_settings, public.hostel_daily_passes from public, anon, authenticated;
grant select, update on public.hostel_gate_settings to service_role;
grant select on public.hostel_daily_passes to service_role;

create or replace function public.issue_hostel_gate_pass(resident uuid, leave_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  daily public.hostel_daily_passes%rowtype;
  enabled boolean;
  result uuid;
begin
  perform 1 from public.hostel_residents where user_id = resident for update;
  if not found then raise exception 'Hostel assignment required'; end if;
  if leave_id is not null then
    update public.hostel_outpass_requests set gate_token = coalesce(gate_token, gen_random_uuid())
    where id = leave_id and hosteller_user_id = resident and status = 'approved'
      and entered_at is null and (return_by >= now() or exited_at is not null)
    returning gate_token into result;
    if result is null then raise exception 'An active approved leave request is required'; end if;
    return result;
  end if;

  select daily_enabled into enabled from public.hostel_gate_settings where singleton for share;
  select * into daily from public.hostel_daily_passes where resident_id = resident for update;
  if daily.exited_at is not null and daily.entered_at is null then return daily.token; end if;
  if enabled is not true then raise exception 'Daily outpasses are switched off'; end if;
  if daily.pass_day = today then
    if daily.entered_at is not null then raise exception 'Today''s daily pass has already been used'; end if;
    return daily.token;
  end if;
  insert into public.hostel_daily_passes(resident_id, pass_day) values(resident,today)
    on conflict(resident_id) do update set pass_day = excluded.pass_day, token = excluded.token,
      exited_at = null, entered_at = null returning token into result;
  return result;
end;
$$;

create or replace function public.scan_hostel_gate_pass(pass_token uuid, direction text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  scanned timestamptz := now();
  enabled boolean;
  daily public.hostel_daily_passes%rowtype;
  trip public.hostel_outpass_requests%rowtype;
begin
  if direction is null or direction not in ('exit','entry') then raise exception 'Select exit or entry'; end if;
  select daily_enabled into enabled from public.hostel_gate_settings where singleton for share;
  select * into daily from public.hostel_daily_passes where token = pass_token for update;
  if found then
    if direction = 'exit' then
      if enabled is not true or daily.pass_day <> (scanned at time zone 'Asia/Kolkata')::date then
        raise exception 'Daily pass is unavailable for exit';
      end if;
      if daily.exited_at is not null then raise exception 'Exit already recorded'; end if;
      update public.hostel_daily_passes set exited_at = scanned where token = pass_token;
    else
      if daily.exited_at is null or daily.entered_at is not null then raise exception 'No outstanding exit for this pass'; end if;
      update public.hostel_daily_passes set entered_at = scanned where token = pass_token;
    end if;
  else
    select * into trip from public.hostel_outpass_requests where gate_token = pass_token and status = 'approved' for update;
    if not found then raise exception 'Invalid pass'; end if;
    if direction = 'exit' then
      if trip.exited_at is not null or scanned not between trip.departure_at and trip.return_by then
        raise exception 'Leave pass is outside its departure window or already used';
      end if;
      update public.hostel_outpass_requests set exited_at = scanned where id = trip.id;
    else
      if trip.exited_at is null or trip.entered_at is not null then raise exception 'No outstanding exit for this pass'; end if;
      update public.hostel_outpass_requests set entered_at = scanned where id = trip.id;
    end if;
  end if;
  return scanned;
end;
$$;
revoke all on function public.issue_hostel_gate_pass(uuid, uuid), public.scan_hostel_gate_pass(uuid,text) from public, anon, authenticated;
grant execute on function public.issue_hostel_gate_pass(uuid, uuid), public.scan_hostel_gate_pass(uuid,text) to service_role;
commit;
