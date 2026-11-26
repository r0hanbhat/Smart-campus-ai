drop function if exists public.facility_slot_booking_window_is_open(text, date, timestamptz);

create or replace function public.facility_slot_booking_window_is_open(
  target_resource_code text,
  target_slot_date date,
  target_starts_at timestamptz,
  target_ends_at timestamptz
)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when target_resource_code = 'hostel_laundry' then
      target_slot_date >= date_trunc('week', timezone('Asia/Kolkata', now()))::date + 7
      and target_slot_date < date_trunc('week', timezone('Asia/Kolkata', now()))::date + 14
    when target_resource_code = 'hostel_reading_room' then
      target_ends_at > now() + interval '30 minutes'
    else target_starts_at > now()
  end;
$$;

alter table public.facility_recurring_schedules
  add column if not exists block_id uuid references public.hostel_blocks(id) on delete restrict;

create index if not exists facility_schedules_block_lookup_idx
  on public.facility_recurring_schedules (block_id, resource_id, active_from, active_until)
  where is_active;

update public.facility_recurring_schedules schedule
set capacity = 200
from public.facility_resources resource
where resource.id = schedule.resource_id
  and resource.code = 'hostel_reading_room'
  and schedule.capacity <> 200;

drop function if exists public.create_facility_recurring_schedules(uuid, uuid, integer[], time, time, integer, integer, date, date);
drop function if exists public.create_facility_recurring_schedule(uuid, uuid, integer, time, time, integer, integer, date, date);

create or replace function public.create_facility_recurring_schedules(
  target_admin_id uuid,
  target_resource_id uuid,
  target_weekdays integer[],
  target_block_ids uuid[],
  target_opens_at time,
  target_closes_at time,
  target_slot_minutes integer,
  target_capacity integer,
  target_active_from date,
  target_active_until date
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_weekday integer;
  selected_block_id uuid;
  resource_code text;
  schedule_window_minutes integer;
  new_schedule_id uuid;
  new_schedule_ids uuid[] := '{}';
  campus_today date := timezone('Asia/Kolkata', now())::date;
begin
  if not exists (
    select 1 from public.profiles
    where user_id = target_admin_id and role = 'admin'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if target_weekdays is null
    or array_ndims(target_weekdays) <> 1
    or coalesce(array_length(target_weekdays, 1), 0) not between 1 and 7
    or target_opens_at is null
    or target_closes_at is null
    or target_closes_at <= target_opens_at
    or target_slot_minutes not between 15 and 240
    or target_capacity not between 1 and 1000
    or target_active_from is null
    or (target_active_until is not null and target_active_until < target_active_from) then
    raise exception 'Invalid facility schedule';
  end if;

  if exists (
    select 1
    from unnest(target_weekdays) as requested(weekday)
    where requested.weekday is null or requested.weekday not between 0 and 6
  ) or array_length(target_weekdays, 1) <> (
    select count(distinct requested.weekday)
    from unnest(target_weekdays) as requested(weekday)
  ) then
    raise exception 'Choose unique valid weekdays';
  end if;

  schedule_window_minutes := (extract(epoch from (target_closes_at - target_opens_at)) / 60)::integer;
  if mod(schedule_window_minutes, target_slot_minutes) <> 0 then
    raise exception 'Opening window must divide evenly into slots';
  end if;

  select resource.code into resource_code
  from public.facility_resources resource
  where resource.id = target_resource_id and resource.is_active
  for update;
  if not found then
    raise exception 'Facility not found';
  end if;

  if array_length(target_weekdays, 1) = 7 and resource_code <> 'hostel_laundry' then
    if resource_code <> 'hostel_reading_room' then
      raise exception 'Every-day schedules are only available for hostel resources';
    end if;
  end if;

  if resource_code = 'hostel_laundry' and (
    array_length(target_weekdays, 1) <> 7
    or not (target_weekdays @> array[0, 1, 2, 3, 4, 5, 6]::integer[])
    or coalesce(array_length(target_block_ids, 1), 0) < 1
    or exists (
      select 1
      from unnest(target_block_ids) as requested(block_id)
      where requested.block_id is null
        or not exists (select 1 from public.hostel_blocks block where block.id = requested.block_id)
    )
    or coalesce(array_length(target_block_ids, 1), 0) <> (
      select count(distinct requested.block_id)
      from unnest(coalesce(target_block_ids, '{}'::uuid[])) as requested(block_id)
    )
    or extract(dow from target_active_from)::integer <> 1
    or target_active_until is distinct from target_active_from + 6
    or target_active_from < date_trunc('week', timezone('Asia/Kolkata', now()))::date + 7
  ) then
    raise exception 'Laundry availability must cover a future Monday-Sunday week';
  end if;

  if resource_code = 'hostel_reading_room' and (
    array_length(target_weekdays, 1) <> 7
    or not (target_weekdays @> array[0, 1, 2, 3, 4, 5, 6]::integer[])
    or target_active_from <> date_trunc('month', target_active_from)::date
    or target_active_until is distinct from
      (date_trunc('month', target_active_from) + interval '1 month' - interval '1 day')::date
    or target_active_until < campus_today
    or target_capacity <> 200
    or coalesce(array_length(target_block_ids, 1), 0) <> 0
  ) then
    raise exception 'Reading-room availability must cover a month with 200 seats per slot';
  end if;

  if resource_code not in ('hostel_laundry', 'hostel_reading_room')
    and coalesce(array_length(target_block_ids, 1), 0) <> 0 then
    raise exception 'Block-specific publishing is only available for hostel laundry';
  end if;

  if exists (
    select 1
    from unnest(target_weekdays) as requested(weekday)
    join public.facility_recurring_schedules existing
      on existing.resource_id = target_resource_id
      and existing.weekday = requested.weekday
      and (
        existing.block_id is null
        or existing.block_id = any(coalesce(target_block_ids, '{}'::uuid[]))
        or resource_code <> 'hostel_laundry'
      )
    where existing.is_active
      and (existing.active_until is null or existing.active_until >= target_active_from)
      and (target_active_until is null or existing.active_from <= target_active_until)
      and existing.opens_at < target_closes_at
      and existing.closes_at > target_opens_at
  ) then
    raise exception 'This schedule overlaps an existing recurring schedule';
  end if;

  if resource_code = 'hostel_laundry' then
    foreach selected_block_id in array target_block_ids loop
      foreach selected_weekday in array target_weekdays loop
        insert into public.facility_recurring_schedules (
          resource_id, block_id, weekday, opens_at, closes_at, slot_minutes, capacity,
          active_from, active_until, created_by
        )
        values (
          target_resource_id, selected_block_id, selected_weekday, target_opens_at, target_closes_at,
          target_slot_minutes, target_capacity, target_active_from, target_active_until, target_admin_id
        )
        returning id into new_schedule_id;

        new_schedule_ids := array_append(new_schedule_ids, new_schedule_id);
      end loop;
    end loop;
  else
    foreach selected_weekday in array target_weekdays loop
      insert into public.facility_recurring_schedules (
      resource_id, block_id, weekday, opens_at, closes_at, slot_minutes, capacity,
      active_from, active_until, created_by
      )
      values (
        target_resource_id, null, selected_weekday, target_opens_at, target_closes_at,
        target_slot_minutes, target_capacity, target_active_from, target_active_until, target_admin_id
      )
      returning id into new_schedule_id;

      new_schedule_ids := array_append(new_schedule_ids, new_schedule_id);
    end loop;
  end if;

  return new_schedule_ids;
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
    select 1
    from public.facility_recurring_schedules sibling
    join public.facility_bookings booking on booking.schedule_id = sibling.id
    where sibling.resource_id = current_schedule.resource_id
      and sibling.block_id is not distinct from current_schedule.block_id
      and sibling.active_from = current_schedule.active_from
      and sibling.active_until is not distinct from current_schedule.active_until
      and sibling.opens_at = current_schedule.opens_at
      and sibling.closes_at = current_schedule.closes_at
      and sibling.slot_minutes = current_schedule.slot_minutes
      and sibling.capacity = current_schedule.capacity
      and sibling.created_by = current_schedule.created_by
      and sibling.created_at = current_schedule.created_at
      and booking.status = 'booked'
      and booking.starts_at > now()
  ) then
    raise exception 'Cancel future bookings before deactivating this schedule' using errcode = '55000';
  end if;

  if target_is_active and exists (
    select 1
    from public.facility_recurring_schedules candidate
    join public.facility_recurring_schedules existing
      on existing.resource_id = candidate.resource_id
      and existing.weekday = candidate.weekday
      and (
        existing.block_id is null
        or candidate.block_id is null
        or existing.block_id = candidate.block_id
      )
    where candidate.resource_id = current_schedule.resource_id
      and candidate.block_id is not distinct from current_schedule.block_id
      and candidate.active_from = current_schedule.active_from
      and candidate.active_until is not distinct from current_schedule.active_until
      and candidate.opens_at = current_schedule.opens_at
      and candidate.closes_at = current_schedule.closes_at
      and candidate.slot_minutes = current_schedule.slot_minutes
      and candidate.capacity = current_schedule.capacity
      and candidate.created_by = current_schedule.created_by
      and candidate.created_at = current_schedule.created_at
      and existing.id <> candidate.id
      and not (
        existing.resource_id = current_schedule.resource_id
        and existing.block_id is not distinct from current_schedule.block_id
        and existing.active_from = current_schedule.active_from
        and existing.active_until is not distinct from current_schedule.active_until
        and existing.opens_at = current_schedule.opens_at
        and existing.closes_at = current_schedule.closes_at
        and existing.slot_minutes = current_schedule.slot_minutes
        and existing.capacity = current_schedule.capacity
        and existing.created_by = current_schedule.created_by
        and existing.created_at = current_schedule.created_at
      )
      and existing.is_active
      and (existing.active_until is null or existing.active_until >= current_schedule.active_from)
      and (current_schedule.active_until is null or existing.active_from <= current_schedule.active_until)
      and existing.opens_at < candidate.closes_at
      and existing.closes_at > candidate.opens_at
  ) then
    raise exception 'This schedule overlaps another active schedule';
  end if;

  update public.facility_recurring_schedules
  set is_active = target_is_active
  where resource_id = current_schedule.resource_id
    and block_id is not distinct from current_schedule.block_id
    and active_from = current_schedule.active_from
    and active_until is not distinct from current_schedule.active_until
    and opens_at = current_schedule.opens_at
    and closes_at = current_schedule.closes_at
    and slot_minutes = current_schedule.slot_minutes
    and capacity = current_schedule.capacity
    and created_by = current_schedule.created_by
    and created_at = current_schedule.created_at;

  return target_schedule_id;
end;
$$;

drop function if exists public.list_facility_slots(uuid, text, date, date);

create function public.list_facility_slots(
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
  block_id uuid,
  block_name text,
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
declare
  resident_block_id uuid;
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

  if target_scope = 'hostel' then
    select resident.block_id into resident_block_id
    from public.hostel_residents resident
    where resident.user_id = target_user_id;
    if not found then
      raise exception 'A hostel room assignment is required' using errcode = '42501';
    end if;
  end if;

  return query
  with generated_slots as (
    select
      resource.id as resource_id,
      resource.code as resource_code,
      resource.name as resource_name,
      resource.scope,
      resource.location,
      schedule.block_id,
      block.name as block_name,
      schedule.id as schedule_id,
      slot_local::date as slot_date,
      slot_local::time as slot_start,
      slot_local at time zone 'Asia/Kolkata' as starts_at,
      (slot_local + make_interval(mins => schedule.slot_minutes)) at time zone 'Asia/Kolkata' as ends_at,
      schedule.capacity
    from public.facility_resources resource
    join public.facility_recurring_schedules schedule
      on schedule.resource_id = resource.id
    left join public.hostel_blocks block
      on block.id = schedule.block_id
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
      and (
        (resource.code = 'hostel_laundry' and schedule.block_id = resident_block_id)
        or (resource.code <> 'hostel_laundry' and schedule.block_id is null)
      )
      and extract(dow from dates.day_start)::integer = schedule.weekday
      and dates.day_start::date between schedule.active_from and coalesce(schedule.active_until, target_to_date)
  )
  select
    generated.resource_id,
    generated.resource_code,
    generated.resource_name,
    generated.scope,
    generated.location,
    generated.block_id,
    generated.block_name,
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
  where (
      (generated.resource_code = 'hostel_reading_room' and generated.ends_at > now() + interval '30 minutes')
      or (generated.resource_code <> 'hostel_reading_room' and generated.starts_at > now())
    )
    and public.facility_slot_booking_window_is_open(
      generated.resource_code,
      generated.slot_date,
      generated.starts_at,
      generated.ends_at
    )
  group by
    generated.resource_id,
    generated.resource_code,
    generated.resource_name,
    generated.scope,
    generated.location,
    generated.block_id,
    generated.block_name,
    generated.schedule_id,
    generated.slot_date,
    generated.slot_start,
    generated.starts_at,
    generated.ends_at,
    generated.capacity
  having generated.resource_code = 'hostel_reading_room'
    or count(booking.id) < generated.capacity
    or coalesce(bool_or(booking.user_id = target_user_id), false)
  order by generated.starts_at;
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
  resident_block_id uuid;
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

  select schedule.*, resource.scope, resource.code as resource_code
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

  if current_schedule.scope = 'hostel' then
    select resident.block_id into resident_block_id
    from public.hostel_residents resident
    where resident.user_id = target_user_id;
    if not found then
      raise exception 'A hostel room assignment is required' using errcode = '42501';
    end if;
  end if;

  if current_schedule.resource_code = 'hostel_laundry'
    and current_schedule.block_id is distinct from resident_block_id then
    raise exception 'Laundry availability is not published for your hostel block' using errcode = '42501';
  end if;

  if target_slot_date is null
    or target_slot_start is null
    or target_slot_date < timezone('Asia/Kolkata', now())::date
    or (
      current_schedule.resource_code <> 'hostel_reading_room'
      and target_slot_date > timezone('Asia/Kolkata', now())::date + 13
    )
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
  if current_schedule.resource_code = 'hostel_reading_room' then
    if booking_end <= now() + interval '30 minutes' then
      raise exception 'Reading-room seats can only be booked when more than 30 minutes remain in the slot';
    end if;
  elsif booking_start <= now() then
    raise exception 'This facility slot has already started';
  end if;

  if not public.facility_slot_booking_window_is_open(
    current_schedule.resource_code,
    target_slot_date,
    booking_start,
    booking_end
  ) then
    raise exception 'This facility slot is outside its booking window';
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

revoke all on function public.facility_slot_booking_window_is_open(text, date, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.facility_slot_booking_window_is_open(text, date, timestamptz, timestamptz) to service_role;

revoke all on function public.create_facility_recurring_schedules(uuid, uuid, integer[], uuid[], time, time, integer, integer, date, date) from public, anon, authenticated;
grant execute on function public.create_facility_recurring_schedules(uuid, uuid, integer[], uuid[], time, time, integer, integer, date, date) to service_role;

revoke all on function public.set_facility_recurring_schedule_active(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_facility_recurring_schedule_active(uuid, uuid, boolean) to service_role;

revoke all on function public.list_facility_slots(uuid, text, date, date) from public, anon, authenticated;
grant execute on function public.list_facility_slots(uuid, text, date, date) to service_role;

revoke all on function public.create_facility_booking(uuid, uuid, date, time) from public, anon, authenticated;
grant execute on function public.create_facility_booking(uuid, uuid, date, time) to service_role;

notify pgrst, 'reload schema';
