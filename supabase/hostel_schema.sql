create table if not exists public.hostel_blocks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.hostel_wardens (
  id uuid primary key default gen_random_uuid(),
  warden_id text not null unique,
  display_name text not null,
  password_hash text not null,
  is_active boolean not null default true,
  failed_login_count integer not null default 0 check (failed_login_count >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.hostel_warden_blocks (
  warden_id uuid not null references public.hostel_wardens(id) on delete cascade,
  block_id uuid not null references public.hostel_blocks(id) on delete cascade,
  primary key (warden_id, block_id)
);

create table if not exists public.hostel_residents (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  block_id uuid not null references public.hostel_blocks(id) on delete restrict,
  room_number text not null,
  assigned_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.hostel_warden_sessions (
  token_hash text primary key check (char_length(token_hash) = 64),
  warden_id uuid not null references public.hostel_wardens(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.hostel_maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles(user_id) on delete cascade,
  block_id uuid not null references public.hostel_blocks(id) on delete restrict,
  room_number text not null,
  category text not null check (category in ('Plumbing', 'Electrical', 'WiFi', 'Cleanliness', 'Other')),
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null check (char_length(trim(description)) between 1 and 2000),
  status text not null default 'submitted' check (status in ('submitted', 'in_progress', 'awaiting_student', 'resolved')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create table if not exists public.hostel_maintenance_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.hostel_maintenance_requests(id) on delete cascade,
  status text not null check (status in ('submitted', 'in_progress', 'awaiting_student', 'resolved')),
  message text not null check (char_length(trim(message)) between 1 and 1000),
  actor_role text not null check (actor_role in ('hosteller', 'warden')),
  actor_user_id uuid,
  actor_warden_id uuid,
  actor_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  check (
    (actor_role = 'hosteller' and actor_user_id is not null and actor_warden_id is null)
    or (actor_role = 'warden' and actor_warden_id is not null and actor_user_id is null)
  )
);

create table if not exists public.hostel_mess_menu (
  day_of_week smallint not null check (day_of_week between 0 and 6),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'snacks', 'dinner')),
  menu_text text not null check (char_length(trim(menu_text)) between 1 and 1000),
  updated_by uuid references public.profiles(user_id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (day_of_week, meal_type)
);

create table if not exists public.hostel_mess_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  message text not null check (char_length(trim(message)) between 1 and 2000),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.hostel_meal_ratings (
  id uuid primary key default gen_random_uuid(),
  hosteller_user_id uuid not null references public.profiles(user_id) on delete cascade,
  meal_date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'snacks', 'dinner')),
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (hosteller_user_id, meal_date, meal_type)
);

create table if not exists public.hostel_outpass_requests (
  id uuid primary key default gen_random_uuid(),
  hosteller_user_id uuid not null references public.profiles(user_id) on delete cascade,
  block_id uuid not null references public.hostel_blocks(id) on delete restrict,
  room_number text not null,
  destination text not null check (char_length(trim(destination)) between 1 and 160),
  purpose text not null check (char_length(trim(purpose)) between 1 and 1000),
  departure_at timestamptz not null,
  return_by timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  check (return_by > departure_at)
);

create table if not exists public.hostel_outpass_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.hostel_outpass_requests(id) on delete cascade,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  message text not null check (char_length(trim(message)) between 1 and 1000),
  actor_role text not null check (actor_role in ('hosteller', 'warden', 'admin')),
  actor_user_id uuid,
  actor_warden_id uuid,
  actor_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  check (
    (actor_role in ('hosteller', 'admin') and actor_user_id is not null and actor_warden_id is null)
    or (actor_role = 'warden' and actor_warden_id is not null and actor_user_id is null)
  )
);

alter table public.hostel_wardens
  add column if not exists failed_login_count integer not null default 0,
  add column if not exists locked_until timestamptz;

create index if not exists hostel_residents_block_lookup_idx
  on public.hostel_residents (block_id, room_number);

create index if not exists hostel_maintenance_requests_block_status_idx
  on public.hostel_maintenance_requests (block_id, status, created_at desc);

create index if not exists hostel_maintenance_requests_reporter_idx
  on public.hostel_maintenance_requests (reporter_user_id, created_at desc);

create index if not exists hostel_maintenance_updates_request_idx
  on public.hostel_maintenance_updates (request_id, created_at);

create index if not exists hostel_mess_announcements_created_idx
  on public.hostel_mess_announcements (created_at desc);

create index if not exists hostel_meal_ratings_date_idx
  on public.hostel_meal_ratings (meal_date, meal_type);

create index if not exists hostel_outpass_requests_block_status_idx
  on public.hostel_outpass_requests (block_id, status, created_at desc);

create index if not exists hostel_outpass_requests_hosteller_idx
  on public.hostel_outpass_requests (hosteller_user_id, created_at desc);

create index if not exists hostel_outpass_updates_request_idx
  on public.hostel_outpass_updates (request_id, created_at);

create index if not exists hostel_warden_sessions_expiry_idx
  on public.hostel_warden_sessions (expires_at);

alter table public.hostel_blocks enable row level security;
alter table public.hostel_wardens enable row level security;
alter table public.hostel_warden_blocks enable row level security;
alter table public.hostel_residents enable row level security;
alter table public.hostel_warden_sessions enable row level security;
alter table public.hostel_maintenance_requests enable row level security;
alter table public.hostel_maintenance_updates enable row level security;
alter table public.hostel_mess_menu enable row level security;
alter table public.hostel_mess_announcements enable row level security;
alter table public.hostel_meal_ratings enable row level security;
alter table public.hostel_outpass_requests enable row level security;
alter table public.hostel_outpass_updates enable row level security;

create or replace function public.replace_hostel_mess_menu(
  target_admin_user_id uuid,
  menu_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_count integer;
begin
  if not exists (
    select 1
    from public.profiles
    where user_id = target_admin_user_id and role = 'admin'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if menu_items is null or jsonb_typeof(menu_items) <> 'array' or jsonb_array_length(menu_items) > 28 then
    raise exception 'Invalid weekly menu';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(menu_items) as item(day_of_week integer, meal_type text, menu_text text)
    where item.day_of_week not between 0 and 6
      or item.meal_type not in ('breakfast', 'lunch', 'snacks', 'dinner')
      or char_length(trim(coalesce(item.menu_text, ''))) not between 1 and 1000
  ) then
    raise exception 'Invalid weekly menu entry';
  end if;

  if exists (
    select item.day_of_week, item.meal_type
    from jsonb_to_recordset(menu_items) as item(day_of_week integer, meal_type text, menu_text text)
    group by item.day_of_week, item.meal_type
    having count(*) > 1
  ) then
    raise exception 'Duplicate weekly menu entry';
  end if;

  delete from public.hostel_mess_menu
  where day_of_week between 0 and 6;

  insert into public.hostel_mess_menu (day_of_week, meal_type, menu_text, updated_by, updated_at)
  select item.day_of_week, item.meal_type, trim(item.menu_text), target_admin_user_id, timezone('utc', now())
  from jsonb_to_recordset(menu_items) as item(day_of_week integer, meal_type text, menu_text text);

  get diagnostics saved_count = row_count;
  return saved_count;
end;
$$;

create or replace function public.submit_hostel_meal_rating(
  target_hosteller_user_id uuid,
  target_meal_date date,
  target_meal_type text,
  target_rating integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rating_id uuid;
begin
  if target_meal_type not in ('breakfast', 'lunch', 'snacks', 'dinner')
    or target_rating not between 1 and 5 then
    raise exception 'Invalid meal rating';
  end if;

  if not exists (
    select 1
    from public.hostel_residents
    where user_id = target_hosteller_user_id
  ) then
    raise exception 'Hostel assignment required' using errcode = '42501';
  end if;

  insert into public.hostel_meal_ratings (hosteller_user_id, meal_date, meal_type, rating, updated_at)
  values (target_hosteller_user_id, target_meal_date, target_meal_type, target_rating, timezone('utc', now()))
  on conflict (hosteller_user_id, meal_date, meal_type)
  do update set rating = excluded.rating, updated_at = timezone('utc', now())
  returning id into rating_id;

  return rating_id;
end;
$$;

create or replace function public.create_hostel_outpass_request(
  target_hosteller_user_id uuid,
  request_destination text,
  request_purpose text,
  request_departure_at timestamptz,
  request_return_by timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resident_assignment public.hostel_residents;
  hosteller_name text;
  new_request_id uuid;
begin
  if char_length(trim(coalesce(request_destination, ''))) not between 1 and 160
    or char_length(trim(coalesce(request_purpose, ''))) not between 1 and 1000 then
    raise exception 'Destination and reason are required and must be within their length limits';
  end if;

  if request_departure_at is null
    or request_return_by is null
    or request_departure_at <= now()
    or request_return_by <= request_departure_at then
    raise exception 'Departure and return times are invalid';
  end if;

  select resident.*
  into resident_assignment
  from public.hostel_residents resident
  join public.profiles profile on profile.user_id = resident.user_id
  where resident.user_id = target_hosteller_user_id
    and profile.role = 'student';

  if not found then
    raise exception 'Hosteller hostel assignment required' using errcode = '42501';
  end if;

  select display_name
  into hosteller_name
  from public.profiles
  where user_id = target_hosteller_user_id;

  insert into public.hostel_outpass_requests (
    hosteller_user_id, block_id, room_number, destination, purpose, departure_at, return_by
  )
  values (
    target_hosteller_user_id,
    resident_assignment.block_id,
    resident_assignment.room_number,
    trim(request_destination),
    trim(request_purpose),
    request_departure_at,
    request_return_by
  )
  returning id into new_request_id;

  insert into public.hostel_outpass_updates (
    request_id, status, message, actor_role, actor_user_id, actor_name
  )
  values (
    new_request_id,
    'pending',
    'Outpass request submitted.',
    'hosteller',
    target_hosteller_user_id,
    coalesce(hosteller_name, 'Hosteller')
  );

  return new_request_id;
end;
$$;

create or replace function public.review_hostel_outpass_request(
  target_request_id uuid,
  staff_role text,
  staff_id uuid,
  next_status text,
  decision_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_request public.hostel_outpass_requests;
  staff_name text;
begin
  if next_status is null
    or next_status not in ('approved', 'rejected')
    or char_length(trim(coalesce(decision_message, ''))) not between 1 and 1000 then
    raise exception 'Choose approve or reject and provide a review note';
  end if;

  if staff_role = 'warden' then
    select outpass.*
    into current_request
    from public.hostel_outpass_requests outpass
    join public.hostel_warden_blocks assignment on assignment.block_id = outpass.block_id
    join public.hostel_wardens warden on warden.id = assignment.warden_id
    where outpass.id = target_request_id
      and assignment.warden_id = staff_id
      and warden.is_active
    for update of outpass;

    if not found then
      raise exception 'Outpass request not found or access denied' using errcode = '42501';
    end if;

    select display_name into staff_name
    from public.hostel_wardens
    where id = staff_id;
  elsif staff_role = 'admin' then
    if not exists (
      select 1 from public.profiles
      where user_id = staff_id and role = 'admin'
    ) then
      raise exception 'Admin access required' using errcode = '42501';
    end if;

    select *
    into current_request
    from public.hostel_outpass_requests
    where id = target_request_id
    for update;
    if not found then
      raise exception 'Outpass request not found' using errcode = 'P0002';
    end if;

    select display_name into staff_name
    from public.profiles
    where user_id = staff_id;
  else
    raise exception 'Authorized hostel staff required' using errcode = '42501';
  end if;

  if current_request.status <> 'pending' then
    raise exception 'This outpass request has already been reviewed' using errcode = '55000';
  end if;

  update public.hostel_outpass_requests
  set status = next_status, updated_at = timezone('utc', now()), reviewed_at = timezone('utc', now())
  where id = target_request_id;

  insert into public.hostel_outpass_updates (
    request_id, status, message, actor_role, actor_user_id, actor_warden_id, actor_name
  )
  values (
    target_request_id,
    next_status,
    trim(decision_message),
    staff_role,
    case when staff_role = 'admin' then staff_id else null end,
    case when staff_role = 'warden' then staff_id else null end,
    coalesce(staff_name, case when staff_role = 'admin' then 'Hostel admin' else 'Warden' end)
  );

  return target_request_id;
end;
$$;


create or replace function public.create_hostel_maintenance_request(
  target_reporter_user_id uuid,
  request_title text,
  request_description text,
  request_category text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resident_assignment public.hostel_residents;
  reporter_name text;
  new_request_id uuid;
begin
  if request_category not in ('Plumbing', 'Electrical', 'WiFi', 'Cleanliness', 'Other') then
    raise exception 'Invalid maintenance category';
  end if;

  select *
  into resident_assignment
  from public.hostel_residents
  where user_id = target_reporter_user_id;

  if not found then
    raise exception 'Hostel assignment required' using errcode = '42501';
  end if;

  select coalesce(display_name, full_name, roll_number, 'Hosteller')
  into reporter_name
  from public.profiles
  where user_id = target_reporter_user_id;

  insert into public.hostel_maintenance_requests (
    reporter_user_id, block_id, room_number, category, title, description
  )
  values (
    target_reporter_user_id,
    resident_assignment.block_id,
    resident_assignment.room_number,
    request_category,
    trim(request_title),
    trim(request_description)
  )
  returning id into new_request_id;

  insert into public.hostel_maintenance_updates (
    request_id, status, message, actor_role, actor_user_id, actor_name
  )
  values (
    new_request_id,
    'submitted',
    'Maintenance request submitted.',
    'hosteller',
    target_reporter_user_id,
    coalesce(reporter_name, 'Hosteller')
  );

  return new_request_id;
end;
$$;

create or replace function public.update_hostel_maintenance_request(
  target_request_id uuid,
  target_warden_id uuid,
  next_status text,
  update_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_request public.hostel_maintenance_requests;
  warden_name text;
begin
  if next_status not in ('submitted', 'in_progress', 'awaiting_student', 'resolved') then
    raise exception 'Invalid maintenance status';
  end if;

  if char_length(trim(coalesce(update_message, ''))) not between 1 and 1000 then
    raise exception 'A warden update of at most 1,000 characters is required';
  end if;

  select request.*
  into current_request
  from public.hostel_maintenance_requests request
  join public.hostel_warden_blocks assignment on assignment.block_id = request.block_id
  join public.hostel_wardens warden on warden.id = assignment.warden_id
  where request.id = target_request_id
    and assignment.warden_id = target_warden_id
    and warden.is_active;

  if not found then
    raise exception 'Maintenance request not found or access denied' using errcode = '42501';
  end if;

  select display_name
  into warden_name
  from public.hostel_wardens
  where id = target_warden_id;

  update public.hostel_maintenance_requests
  set
    status = next_status,
    updated_at = timezone('utc', now()),
    resolved_at = case
      when next_status = 'resolved' then coalesce(resolved_at, timezone('utc', now()))
      else null
    end
  where id = target_request_id;

  insert into public.hostel_maintenance_updates (
    request_id, status, message, actor_role, actor_warden_id, actor_name
  )
  values (
    target_request_id,
    next_status,
    trim(update_message),
    'warden',
    target_warden_id,
    coalesce(warden_name, 'Warden')
  );

  return target_request_id;
end;
$$;

create or replace function public.record_hostel_warden_login_failure(target_warden_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  next_locked_until timestamptz;
begin
  update public.hostel_wardens
  set
    failed_login_count = case
      when locked_until is not null and locked_until <= now() then 1
      else failed_login_count + 1
    end,
    locked_until = case
      when locked_until is not null and locked_until > now() then locked_until
      when (case
        when locked_until is not null and locked_until <= now() then 1
        else failed_login_count + 1
      end) >= 5 then now() + interval '15 minutes'
      else null
    end
  where id = target_warden_id
  returning locked_until into next_locked_until;

  return next_locked_until;
end;
$$;

revoke all on function public.record_hostel_warden_login_failure(uuid) from public, anon, authenticated;
grant execute on function public.record_hostel_warden_login_failure(uuid) to service_role;

revoke all on function public.create_hostel_maintenance_request(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.create_hostel_maintenance_request(uuid, text, text, text) to service_role;

revoke all on function public.update_hostel_maintenance_request(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.update_hostel_maintenance_request(uuid, uuid, text, text) to service_role;

revoke all on function public.replace_hostel_mess_menu(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_hostel_mess_menu(uuid, jsonb) to service_role;

revoke all on function public.submit_hostel_meal_rating(uuid, date, text, integer) from public, anon, authenticated;
grant execute on function public.submit_hostel_meal_rating(uuid, date, text, integer) to service_role;

revoke all on function public.create_hostel_outpass_request(uuid, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.create_hostel_outpass_request(uuid, text, text, timestamptz, timestamptz) to service_role;

revoke all on function public.review_hostel_outpass_request(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_hostel_outpass_request(uuid, text, uuid, text, text) to service_role;
