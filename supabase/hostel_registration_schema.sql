create table if not exists public.hostel_registration_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  roll_number text not null,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by_user_id uuid references public.profiles(user_id) on delete set null,
  reviewed_by_warden_id uuid references public.hostel_wardens(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists hostel_registration_requests_status_created_idx
  on public.hostel_registration_requests (status, created_at);

alter table public.hostel_registration_requests enable row level security;
revoke all on public.hostel_registration_requests from public, anon, authenticated;
grant all on public.hostel_registration_requests to service_role;

create or replace function public.review_hostel_registration_request(
  target_user_id uuid,
  target_decision text,
  target_block_id uuid,
  target_room_number text,
  target_reviewer_user_id uuid,
  target_reviewer_warden_id uuid,
  target_review_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_request public.hostel_registration_requests%rowtype;
begin
  if target_decision is null or target_decision not in ('approved', 'rejected') then
    raise exception 'Invalid hostel registration decision';
  end if;

  if (target_reviewer_user_id is null) = (target_reviewer_warden_id is null) then
    raise exception 'Exactly one reviewer must be provided';
  end if;

  if target_reviewer_user_id is not null and not exists (
    select 1 from public.profiles
    where user_id = target_reviewer_user_id and role = 'admin'
  ) then
    raise exception 'Admin access required';
  end if;

  if target_reviewer_warden_id is not null and not exists (
    select 1 from public.hostel_wardens
    where id = target_reviewer_warden_id and is_active
  ) then
    raise exception 'Active warden access required';
  end if;

  select *
  into current_request
  from public.hostel_registration_requests
  where user_id = target_user_id
  for update;

  if not found or current_request.status <> 'pending' then
    raise exception 'Hostel registration request is no longer pending';
  end if;

  if target_decision = 'approved' then
    if target_block_id is null
      or char_length(trim(coalesce(target_room_number, ''))) not between 1 and 32
      or not exists (select 1 from public.hostel_blocks where id = target_block_id) then
      raise exception 'A valid block and room number are required';
    end if;

    if target_reviewer_warden_id is not null and not exists (
      select 1
      from public.hostel_warden_blocks
      where warden_id = target_reviewer_warden_id and block_id = target_block_id
    ) then
      raise exception 'Warden is not assigned to the selected block';
    end if;

    if exists (
      select 1 from public.hostel_residents where user_id = target_user_id
    ) then
      raise exception 'Hosteller already has an assignment';
    end if;

    insert into public.hostel_residents (user_id, block_id, room_number)
    values (target_user_id, target_block_id, trim(target_room_number));
  elsif target_block_id is not null or nullif(trim(coalesce(target_room_number, '')), '') is not null then
    raise exception 'A block and room can only be set when approving';
  end if;

  update public.hostel_registration_requests
  set status = target_decision,
      review_note = nullif(trim(coalesce(target_review_note, '')), ''),
      reviewed_by_user_id = target_reviewer_user_id,
      reviewed_by_warden_id = target_reviewer_warden_id,
      reviewed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where user_id = target_user_id;
end;
$$;

revoke all on function public.review_hostel_registration_request(uuid, text, uuid, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.review_hostel_registration_request(uuid, text, uuid, text, uuid, uuid, text) to service_role;
