create table if not exists public.facility_resources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in (
    'hostel_laundry',
    'hostel_reading_room',
    'campus_library_seat',
    'campus_cafeteria_seat'
  )),
  name text not null,
  scope text not null check (scope in ('campus', 'hostel')),
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (code in ('hostel_laundry', 'hostel_reading_room') and scope = 'hostel')
    or (code in ('campus_library_seat', 'campus_cafeteria_seat') and scope = 'campus')
  )
);

insert into public.facility_resources (code, name, scope)
values
  ('hostel_laundry', 'Laundry slots', 'hostel'),
  ('hostel_reading_room', 'Reading room', 'hostel'),
  ('campus_library_seat', 'Library seat booking', 'campus'),
  ('campus_cafeteria_seat', 'Cafeteria seat', 'campus')
on conflict (code) do nothing;

create table if not exists public.facility_recurring_schedules (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.facility_resources(id) on delete restrict,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  slot_minutes smallint not null check (slot_minutes between 15 and 240),
  capacity integer not null check (capacity between 1 and 1000),
  active_from date not null,
  active_until date,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  check (closes_at > opens_at),
  check (active_until is null or active_until >= active_from),
  check (
    mod(
      (extract(epoch from (closes_at - opens_at)) / 60)::integer,
      slot_minutes
    ) = 0
  )
);

create index if not exists facility_schedules_lookup_idx
  on public.facility_recurring_schedules (resource_id, weekday, active_from, active_until)
  where is_active;

create table if not exists public.facility_bookings (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.facility_resources(id) on delete restrict,
  schedule_id uuid not null references public.facility_recurring_schedules(id) on delete restrict,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  slot_date date not null,
  slot_start time not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (ends_at > starts_at)
);

create unique index if not exists facility_bookings_user_slot_idx
  on public.facility_bookings (schedule_id, slot_date, slot_start, user_id)
  where status = 'booked';

create index if not exists facility_bookings_slot_idx
  on public.facility_bookings (schedule_id, slot_date, slot_start)
  where status = 'booked';

create index if not exists facility_bookings_user_idx
  on public.facility_bookings (user_id, starts_at)
  where status = 'booked';

alter table public.facility_resources enable row level security;
alter table public.facility_recurring_schedules enable row level security;
alter table public.facility_bookings enable row level security;

create or replace function public.list_facility_slots(
  target_user_id uuid,
  target_scope text,
  target_from_date date,
  target_to_date date
)
returns table (
  resource_id uuid,
  resource_code text,
  resource_name text,
  scope text,
  location text,
  schedule_id uuid,
  slot_date date,
  slot_start time,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  booked_count integer,
  my_booking_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_scope not in ('campus', 'hostel')
    or target_from_date is null
    or target_to_date is null
    or target_to_date < target_from_date
    or target_to_date - target_from_date > 30 then
    raise exception 'Invalid facility search range';
  end if;

  if not exists (
    select 1 from public.profiles
    where user_id = target_user_id and role = 'student'
  ) then
    raise exception 'Student access required' using errcode = '42501';
  end if;

  if target_scope = 'hostel' and not exists (
    select 1 from public.hostel_residents
    where user_id = target_user_id
  ) then
    raise exception 'A hostel room assignment is required' using errcode = '42501';
  end if;

  return query
  with generated_slots as (
    select
      resource.id as resource_id,
      resource.code as resource_code,
      resource.name as resource_name,
      resource.scope,
      resource.location,
      schedule.id as schedule_id,
      slot_local::date as slot_date,
      slot_local::time as slot_start,
      slot_local at time zone 'Asia/Kolkata' as starts_at,
      (slot_local + make_interval(mins => schedule.slot_minutes)) at time zone 'Asia/Kolkata' as ends_at,
      schedule.capacity
    from public.facility_resources resource
    join public.facility_recurring_schedules schedule
      on schedule.resource_id = resource.id
    cross join lateral generate_series(
      greatest(target_from_date, schedule.active_from)::timestamp,
      least(target_to_date, coalesce(schedule.active_until, target_to_date))::timestamp,
      interval '1 day'
    ) as dates(day_start)
    cross join lateral generate_series(
      dates.day_start::date + schedule.opens_at,
      dates.day_start::date + (schedule.closes_at - make_interval(mins => schedule.slot_minutes)),
      make_interval(mins => schedule.slot_minutes)
    ) as times(slot_local)
    where resource.scope = target_scope
      and resource.is_active
      and schedule.is_active
      and extract(dow from dates.day_start)::integer = schedule.weekday
      and dates.day_start::date between schedule.active_from and coalesce(schedule.active_until, target_to_date)
  )
  select
    generated.resource_id,
    generated.resource_code,
    generated.resource_name,
    generated.scope,
    generated.location,
    generated.schedule_id,
    generated.slot_date,
    generated.slot_start,
    generated.starts_at,
    generated.ends_at,
    generated.capacity,
    count(booking.id)::integer,
    (array_agg(booking.id) filter (where booking.user_id = target_user_id))[1]
  from generated_slots generated
  left join public.facility_bookings booking
    on booking.schedule_id = generated.schedule_id
    and booking.slot_date = generated.slot_date
    and booking.slot_start = generated.slot_start
    and booking.status = 'booked'
  where generated.starts_at > now()
  group by
    generated.resource_id,
    generated.resource_code,
    generated.resource_name,
    generated.scope,
    generated.location,
    generated.schedule_id,
    generated.slot_date,
    generated.slot_start,
    generated.starts_at,
    generated.ends_at,
    generated.capacity
  having count(booking.id) < generated.capacity
    or coalesce(bool_or(booking.user_id = target_user_id), false)
  order by generated.starts_at;
end;
$$;

create or replace function public.create_facility_recurring_schedule(
  target_admin_id uuid,
  target_resource_id uuid,
  target_weekday integer,
  target_opens_at time,
  target_closes_at time,
  target_slot_minutes integer,
  target_capacity integer,
  target_active_from date,
  target_active_until date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_schedule_id uuid;
  schedule_window_minutes integer;
begin
  if not exists (
    select 1 from public.profiles
    where user_id = target_admin_id and role = 'admin'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if target_weekday not between 0 and 6
    or target_opens_at is null
    or target_closes_at is null
    or target_closes_at <= target_opens_at
    or target_slot_minutes not between 15 and 240
    or target_capacity not between 1 and 1000
    or target_active_from is null
    or (target_active_until is not null and target_active_until < target_active_from) then
    raise exception 'Invalid facility schedule';
  end if;

  schedule_window_minutes := (extract(epoch from (target_closes_at - target_opens_at)) / 60)::integer;
  if mod(schedule_window_minutes, target_slot_minutes) <> 0 then
    raise exception 'Opening window must divide evenly into slots';
  end if;

  perform 1
  from public.facility_resources
  where id = target_resource_id and is_active
  for update;
  if not found then
    raise exception 'Facility not found';
  end if;

  if exists (
    select 1
    from public.facility_recurring_schedules existing
    where existing.resource_id = target_resource_id
      and existing.weekday = target_weekday
      and existing.is_active
      and (existing.active_until is null or existing.active_until >= target_active_from)
      and (target_active_until is null or existing.active_from <= target_active_until)
      and existing.opens_at < target_closes_at
      and existing.closes_at > target_opens_at
  ) then
    raise exception 'This schedule overlaps an existing recurring schedule';
  end if;

  insert into public.facility_recurring_schedules (
    resource_id, weekday, opens_at, closes_at, slot_minutes, capacity,
    active_from, active_until, created_by
  )
  values (
    target_resource_id, target_weekday, target_opens_at, target_closes_at,
    target_slot_minutes, target_capacity, target_active_from, target_active_until,
    target_admin_id
  )
  returning id into new_schedule_id;

  return new_schedule_id;
end;
$$;

create or replace function public.set_facility_recurring_schedule_active(
  target_admin_id uuid,
  target_schedule_id uuid,
  target_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_schedule public.facility_recurring_schedules;
begin
  if not exists (
    select 1 from public.profiles
    where user_id = target_admin_id and role = 'admin'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into current_schedule
  from public.facility_recurring_schedules
  where id = target_schedule_id
  for update;
  if not found then
    raise exception 'Facility schedule not found' using errcode = 'P0002';
  end if;

  if not target_is_active and exists (
    select 1 from public.facility_bookings
    where schedule_id = target_schedule_id
      and status = 'booked'
      and starts_at > now()
  ) then
    raise exception 'Cancel future bookings before deactivating this schedule' using errcode = '55000';
  end if;

  if target_is_active and exists (
    select 1
    from public.facility_recurring_schedules existing
    where existing.resource_id = current_schedule.resource_id
      and existing.weekday = current_schedule.weekday
      and existing.id <> current_schedule.id
      and existing.is_active
      and (existing.active_until is null or existing.active_until >= current_schedule.active_from)
      and (current_schedule.active_until is null or existing.active_from <= current_schedule.active_until)
      and existing.opens_at < current_schedule.closes_at
      and existing.closes_at > current_schedule.opens_at
  ) then
    raise exception 'This schedule overlaps another active schedule';
  end if;

  update public.facility_recurring_schedules
  set is_active = target_is_active
  where id = target_schedule_id;

  return target_schedule_id;
end;
$$;

create or replace function public.create_facility_booking(
  target_user_id uuid,
  target_schedule_id uuid,
  target_slot_date date,
  target_slot_start time
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_schedule record;
  booking_start timestamptz;
  booking_end timestamptz;
  existing_count integer;
  new_booking_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(target_user_id::text));

  if not exists (
    select 1 from public.profiles
    where user_id = target_user_id and role = 'student'
  ) then
    raise exception 'Student access required' using errcode = '42501';
  end if;

  select schedule.*, resource.scope, resource.is_active as resource_is_active
  into current_schedule
  from public.facility_recurring_schedules schedule
  join public.facility_resources resource on resource.id = schedule.resource_id
  where schedule.id = target_schedule_id
    and schedule.is_active
    and resource.is_active
  for update of schedule;
  if not found then
    raise exception 'Facility slot is no longer available';
  end if;

  if current_schedule.scope = 'hostel' and not exists (
    select 1 from public.hostel_residents
    where user_id = target_user_id
  ) then
    raise exception 'A hostel room assignment is required' using errcode = '42501';
  end if;

  if target_slot_date is null
    or target_slot_start is null
    or target_slot_date < (timezone('Asia/Kolkata', now())::date)
    or target_slot_date > (timezone('Asia/Kolkata', now())::date + 13)
    or target_slot_date < current_schedule.active_from
    or (current_schedule.active_until is not null and target_slot_date > current_schedule.active_until)
    or extract(dow from target_slot_date)::integer <> current_schedule.weekday
    or target_slot_start < current_schedule.opens_at
    or target_slot_start + make_interval(mins => current_schedule.slot_minutes) > current_schedule.closes_at
    or mod(
      (extract(epoch from (target_slot_start - current_schedule.opens_at)) / 60)::integer,
      current_schedule.slot_minutes
    ) <> 0 then
    raise exception 'Choose a valid slot from the active schedule';
  end if;

  booking_start := (target_slot_date + target_slot_start) at time zone 'Asia/Kolkata';
  booking_end := booking_start + make_interval(mins => current_schedule.slot_minutes);
  if booking_start <= now() then
    raise exception 'This facility slot has already started';
  end if;

  if exists (
    select 1 from public.facility_bookings booking
    where booking.user_id = target_user_id
      and booking.status = 'booked'
      and booking.starts_at < booking_end
      and booking.ends_at > booking_start
  ) then
    raise exception 'You already have an overlapping facility booking';
  end if;

  select count(*) into existing_count
  from public.facility_bookings booking
  where booking.schedule_id = target_schedule_id
    and booking.slot_date = target_slot_date
    and booking.slot_start = target_slot_start
    and booking.status = 'booked';
  if existing_count >= current_schedule.capacity then
    raise exception 'This facility slot is full';
  end if;

  insert into public.facility_bookings (
    resource_id, schedule_id, user_id, slot_date, slot_start, starts_at, ends_at
  )
  values (
    current_schedule.resource_id,
    target_schedule_id,
    target_user_id,
    target_slot_date,
    target_slot_start,
    booking_start,
    booking_end
  )
  returning id into new_booking_id;

  return new_booking_id;
end;
$$;

create or replace function public.cancel_facility_booking(
  target_user_id uuid,
  target_booking_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_booking public.facility_bookings;
begin
  perform pg_advisory_xact_lock(hashtext(target_user_id::text));

  select * into current_booking
  from public.facility_bookings
  where id = target_booking_id
    and user_id = target_user_id
  for update;
  if not found then
    raise exception 'Facility booking not found' using errcode = '42501';
  end if;
  if current_booking.status <> 'booked' or current_booking.starts_at <= now() then
    raise exception 'Only future active bookings can be cancelled' using errcode = '55000';
  end if;

  update public.facility_bookings
  set status = 'cancelled', cancelled_at = now()
  where id = target_booking_id;

  return target_booking_id;
end;
$$;

revoke all on function public.list_facility_slots(uuid, text, date, date) from public, anon, authenticated;
grant execute on function public.list_facility_slots(uuid, text, date, date) to service_role;

revoke all on function public.create_facility_recurring_schedule(uuid, uuid, integer, time, time, integer, integer, date, date) from public, anon, authenticated;
grant execute on function public.create_facility_recurring_schedule(uuid, uuid, integer, time, time, integer, integer, date, date) to service_role;

revoke all on function public.set_facility_recurring_schedule_active(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_facility_recurring_schedule_active(uuid, uuid, boolean) to service_role;

revoke all on function public.create_facility_booking(uuid, uuid, date, time) from public, anon, authenticated;
grant execute on function public.create_facility_booking(uuid, uuid, date, time) to service_role;

revoke all on function public.cancel_facility_booking(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_facility_booking(uuid, uuid) to service_role;
