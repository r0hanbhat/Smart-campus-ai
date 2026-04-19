create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  full_name text,
  age integer,
  email text,
  is_online boolean not null default false,
  last_seen timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists age integer;
alter table public.profiles add column if not exists email text;

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(user_id) on delete cascade,
  receiver_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (sender_id, receiver_id)
);

create table if not exists public.friendships (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  friend_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('global', 'direct', 'group')),
  name text,
  slug text unique,
  direct_pair_key text unique,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(user_id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  type text not null check (type in ('friend_request', 'friend_accept', 'group_invite')),
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.is_conversation_member(target_conversation_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = target_conversation_id
      and user_id = target_user_id
  );
$$;

create or replace function public.can_access_conversation(target_conversation_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = target_conversation_id
      and (
        c.type = 'global'
        or exists (
          select 1
          from public.conversation_members cm
          where cm.conversation_id = target_conversation_id
            and cm.user_id = target_user_id
        )
      )
  );
$$;

create or replace function public.create_group_conversation(group_name text, member_ids uuid[] default '{}'::uuid[])
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  new_conversation public.conversations;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if char_length(trim(coalesce(group_name, ''))) = 0 then
    raise exception 'Group name is required';
  end if;

  insert into public.conversations (type, name, created_by)
  values ('group', trim(group_name), auth.uid())
  returning * into new_conversation;

  insert into public.conversation_members (conversation_id, user_id)
  select new_conversation.id, member_id
  from (
    select auth.uid() as member_id
    union
    select unnest(coalesce(member_ids, '{}'::uuid[]))
  ) as unique_members
  where member_id is not null
  on conflict do nothing;

  return new_conversation;
end;
$$;

create or replace function public.leave_group_conversation(target_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from public.conversation_members
  where conversation_id = target_conversation_id
    and user_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      where c.id = target_conversation_id
        and c.type = 'group'
    );

  return not exists (
    select 1
    from public.conversation_members
    where conversation_id = target_conversation_id
      and user_id = auth.uid()
  );
end;
$$;

drop trigger if exists friend_requests_set_updated_at on public.friend_requests;
create trigger friend_requests_set_updated_at
before update on public.friend_requests
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

create policy "profiles are viewable by authenticated users"
on public.profiles
for select
to authenticated
using (true);

create policy "users manage own profile"
on public.profiles
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can see related friend requests"
on public.friend_requests
for select
to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "users can send requests"
on public.friend_requests
for insert
to authenticated
with check (auth.uid() = sender_id);

create policy "receivers can update requests"
on public.friend_requests
for update
to authenticated
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id);

create policy "users can view own friendships"
on public.friendships
for select
to authenticated
using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "users can create their friendship rows"
on public.friendships
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "members can view conversations"
on public.conversations
for select
to authenticated
using (
  type = 'global'
  or public.is_conversation_member(id, auth.uid())
);

create policy "authenticated users can create conversations"
on public.conversations
for insert
to authenticated
with check (auth.uid() = created_by);

drop policy if exists "members can view conversation members" on public.conversation_members;
create policy "members can view conversation members"
on public.conversation_members
for select
to authenticated
using (
  auth.uid() = user_id
  or public.can_access_conversation(conversation_id, auth.uid())
);

drop policy if exists "users can add themselves to conversation members" on public.conversation_members;
create policy "users can add themselves to conversation members"
on public.conversation_members
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "group members can add members" on public.conversation_members;
create policy "group members can add members"
on public.conversation_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.conversation_members cm
    join public.conversations c
      on c.id = cm.conversation_id
    where cm.conversation_id = conversation_id
      and cm.user_id = auth.uid()
      and c.type = 'group'
  )
);

drop policy if exists "users can leave joined conversations" on public.conversation_members;
create policy "users can leave joined conversations"
on public.conversation_members
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "group creators can remove members" on public.conversation_members;
create policy "group creators can remove members"
on public.conversation_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.type = 'group'
      and c.created_by = auth.uid()
  )
);

drop policy if exists "members can view messages" on public.messages;
create policy "members can view messages"
on public.messages
for select
to authenticated
using (
  public.can_access_conversation(conversation_id, auth.uid())
);

drop policy if exists "members can send messages" on public.messages;
create policy "members can send messages"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and public.can_access_conversation(conversation_id, auth.uid())
);

create policy "users can view own notifications"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can update own notifications"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "authenticated users can create notifications"
on public.notifications
for insert
to authenticated
with check (true);

alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.friend_requests;
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
