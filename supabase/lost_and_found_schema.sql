create table if not exists public.lost_found_items (
  id uuid primary key default gen_random_uuid(),
  finder_id uuid not null references public.profiles(user_id) on delete cascade,
  item_type text not null default 'found',
  title text not null check (char_length(title) between 3 and 100),
  description text not null check (char_length(description) between 10 and 1500),
  found_location text not null check (char_length(found_location) between 2 and 160),
  found_date date not null check (found_date <= current_date),
  status text not null default 'open' check (status in ('open', 'returned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lost_found_items
  add column if not exists item_type text not null default 'found';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.lost_found_items'::regclass
      and conname = 'lost_found_items_item_type_check'
  ) then
    alter table public.lost_found_items
      add constraint lost_found_items_item_type_check check (item_type in ('lost', 'found'));
  end if;
end;
$$;

create index if not exists lost_found_items_feed_idx
  on public.lost_found_items (status, created_at desc);
create index if not exists lost_found_items_finder_idx
  on public.lost_found_items (finder_id, created_at desc);

create table if not exists public.lost_found_claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.lost_found_items(id) on delete cascade,
  claimant_id uuid not null references public.profiles(user_id) on delete cascade,
  message text not null check (char_length(message) between 10 and 1200),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  response text check (response is null or char_length(response) <= 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, claimant_id)
);

create index if not exists lost_found_claims_item_idx
  on public.lost_found_claims (item_id, created_at desc);
create index if not exists lost_found_claims_claimant_idx
  on public.lost_found_claims (claimant_id, created_at desc);

alter table public.lost_found_items enable row level security;
alter table public.lost_found_claims enable row level security;
revoke all on public.lost_found_items, public.lost_found_claims from public, anon, authenticated;
grant select, insert, update, delete on public.lost_found_items, public.lost_found_claims to service_role;

create or replace function public.update_lost_found_timestamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lost_found_items_updated_at on public.lost_found_items;
create trigger lost_found_items_updated_at
  before update on public.lost_found_items
  for each row
  execute function public.update_lost_found_timestamp();

drop trigger if exists lost_found_claims_updated_at on public.lost_found_claims;
create trigger lost_found_claims_updated_at
  before update on public.lost_found_claims
  for each row
  execute function public.update_lost_found_timestamp();

create or replace function public.submit_lost_found_claim(
  target_item_id uuid,
  target_claimant_id uuid,
  target_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_item public.lost_found_items;
  new_claim_id uuid;
begin
  select * into current_item
  from public.lost_found_items
  where id = target_item_id
  for update;
  if not found or current_item.status <> 'open' then
    raise exception 'This Lost and Found post is no longer available' using errcode = 'P0002';
  end if;
  if current_item.finder_id = target_claimant_id then
    raise exception 'You cannot respond to your own post' using errcode = '42501';
  end if;
  if target_message is null or char_length(btrim(target_message)) < 10 or char_length(target_message) > 1200 then
    raise exception 'Add at least 10 characters of private details' using errcode = '22023';
  end if;

  insert into public.lost_found_claims (item_id, claimant_id, message)
  values (target_item_id, target_claimant_id, btrim(target_message))
  returning id into new_claim_id;
  return new_claim_id;
end;
$$;

create or replace function public.respond_to_lost_found_claim(
  target_claim_id uuid,
  target_finder_id uuid,
  target_decision text,
  target_response text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_claim public.lost_found_claims;
  current_item public.lost_found_items;
begin
  select item.* into current_item
  from public.lost_found_items item
  join public.lost_found_claims claim on claim.item_id = item.id
  where claim.id = target_claim_id
  for update of item;
  if not found then
    raise exception 'Claim request not found' using errcode = 'P0002';
  end if;
  if current_item.finder_id <> target_finder_id then
    raise exception 'Only the post owner can respond to this private message' using errcode = '42501';
  end if;

  select * into current_claim
  from public.lost_found_claims
  where id = target_claim_id
  for update;
  if current_claim.status <> 'pending' then
    raise exception 'This claim has already been answered' using errcode = '55000';
  end if;
  if target_decision not in ('accepted', 'declined') then
    raise exception 'Choose accept or decline' using errcode = '22023';
  end if;
  if char_length(coalesce(target_response, '')) > 1200 then
    raise exception 'Response must be 1200 characters or fewer' using errcode = '22023';
  end if;

  update public.lost_found_claims
  set status = target_decision, response = nullif(btrim(coalesce(target_response, '')), '')
  where id = target_claim_id;

  if target_decision = 'accepted' then
    update public.lost_found_items
    set status = 'returned'
    where id = current_item.id;

    update public.lost_found_claims
    set status = 'declined', response = 'Another response was accepted and the post was closed.'
    where item_id = current_item.id
      and id <> target_claim_id
      and status = 'pending';
  end if;

  return target_claim_id;
end;
$$;

create or replace function public.mark_lost_found_item_returned(
  target_item_id uuid,
  target_finder_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_item public.lost_found_items;
begin
  select * into current_item
  from public.lost_found_items
  where id = target_item_id
  for update;
  if not found then
    raise exception 'Lost and Found post not found' using errcode = 'P0002';
  end if;
  if current_item.finder_id <> target_finder_id then
    raise exception 'Only the post owner can close this post' using errcode = '42501';
  end if;
  if current_item.status <> 'open' then
    raise exception 'This post is already closed' using errcode = '55000';
  end if;

  update public.lost_found_items
  set status = 'returned'
  where id = target_item_id;

  update public.lost_found_claims
  set status = 'declined', response = 'The post owner closed this Lost and Found post.'
  where item_id = target_item_id and status = 'pending';

  return target_item_id;
end;
$$;

revoke all on function public.submit_lost_found_claim(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.respond_to_lost_found_claim(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.mark_lost_found_item_returned(uuid, uuid) from public, anon, authenticated;
grant execute on function public.submit_lost_found_claim(uuid, uuid, text) to service_role;
grant execute on function public.respond_to_lost_found_claim(uuid, uuid, text, text) to service_role;
grant execute on function public.mark_lost_found_item_returned(uuid, uuid) to service_role;
