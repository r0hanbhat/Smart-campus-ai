begin;

create extension if not exists "pgcrypto";

alter table public.conversations
  add column if not exists group_status text,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_group_status_check'
  ) then
    alter table public.conversations
      add constraint conversations_group_status_check
      check (group_status in ('active', 'pending'));
  end if;
end $$;

alter table public.conversation_members
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists is_creator boolean not null default false,
  add column if not exists member_status text not null default 'active',
  add column if not exists left_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversation_members_member_status_check'
  ) then
    alter table public.conversation_members
      add constraint conversation_members_member_status_check
      check (member_status in ('active', 'invited', 'left'));
  end if;
end $$;

update public.conversation_members
set member_status = 'active'
where member_status is null;

update public.conversation_members
set is_creator = false
where is_creator is null;

alter table public.messages
  alter column sender_id drop not null;

alter table public.messages
  drop constraint if exists messages_sender_id_fkey;

alter table public.messages
  add constraint messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(user_id) on delete set null;

alter table public.messages
  add column if not exists is_system boolean not null default false,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.messages
set is_system = true
where content like '[[system]] %';

create table if not exists public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(user_id) on delete cascade,
  invited_by uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (conversation_id, invited_user_id)
);

create table if not exists public.global_chat_read_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, message_id)
);

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'friend_request',
      'friend_accept',
      'group_invite',
      'teacher_announcement',
      'group_member_joined',
      'group_member_left'
    )
  );

update public.conversations
set group_status = 'active'
where type = 'group' and group_status is null;

update public.conversations
set group_status = 'active'
where type = 'global' and slug = 'global-campus-chat' and group_status is null;

insert into public.conversations (type, name, slug, group_status)
select 'global', 'Global Campus Chat', 'global-campus-chat', 'active'
where not exists (
  select 1 from public.conversations where slug = 'global-campus-chat'
);

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();

drop trigger if exists messages_set_updated_at on public.messages;
create trigger messages_set_updated_at
before update on public.messages
for each row
execute function public.set_updated_at();

drop trigger if exists group_invitations_set_updated_at on public.group_invitations;
create trigger group_invitations_set_updated_at
before update on public.group_invitations
for each row
execute function public.set_updated_at();

create or replace function public.is_active_conversation_member(target_conversation_id uuid, target_user_id uuid)
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
      and member_status <> 'left'
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
            and cm.member_status <> 'left'
        )
      )
  );
$$;

alter table public.group_invitations enable row level security;
alter table public.global_chat_read_status enable row level security;

drop policy if exists "members can view conversations" on public.conversations;
create policy "members can view conversations"
on public.conversations
for select
to authenticated
using (
  type = 'global'
  or public.is_active_conversation_member(id, auth.uid())
  or exists (
    select 1
    from public.group_invitations gi
    where gi.conversation_id = id
      and gi.invited_user_id = auth.uid()
      and gi.status = 'pending'
  )
);

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
drop policy if exists "group members can add members" on public.conversation_members;
drop policy if exists "users can leave joined conversations" on public.conversation_members;
drop policy if exists "group creators can remove members" on public.conversation_members;

create policy "users can add themselves to conversation members"
on public.conversation_members
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "group members can add members"
on public.conversation_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.conversation_id = conversation_id
      and cm.user_id = auth.uid()
      and cm.member_status <> 'left'
      and c.type = 'group'
  )
);

create policy "group members can update own membership state"
on public.conversation_members
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "group creators can update group memberships"
on public.conversation_members
for update
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.type = 'group'
      and c.created_by = auth.uid()
  )
)
with check (
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
  and (
    not exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and c.type = 'group'
        and c.group_status = 'pending'
    )
  )
);

create policy "users can view relevant group invitations"
on public.group_invitations
for select
to authenticated
using (auth.uid() = invited_user_id or auth.uid() = invited_by);

create policy "group members can create invitations"
on public.group_invitations
for insert
to authenticated
with check (
  auth.uid() = invited_by
  and exists (
    select 1
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.conversation_id = group_invitations.conversation_id
      and cm.user_id = auth.uid()
      and cm.member_status <> 'left'
      and c.type = 'group'
  )
);

create policy "invited users can update invitations"
on public.group_invitations
for update
to authenticated
using (auth.uid() = invited_user_id)
with check (auth.uid() = invited_user_id);

create policy "users can view own global read status"
on public.global_chat_read_status
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can manage own global read status"
on public.global_chat_read_status
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.group_invitations;
alter publication supabase_realtime add table public.global_chat_read_status;

create index if not exists idx_conversations_group_status on public.conversations(group_status);
create index if not exists idx_conversation_members_member_status on public.conversation_members(member_status);
create index if not exists idx_messages_is_system on public.messages(is_system);
create index if not exists idx_group_invitations_conversation_id on public.group_invitations(conversation_id);
create index if not exists idx_group_invitations_invited_user_id on public.group_invitations(invited_user_id);
create index if not exists idx_group_invitations_status on public.group_invitations(status);
create index if not exists idx_global_chat_read_status_user_id on public.global_chat_read_status(user_id);
create index if not exists idx_global_chat_read_status_message_id on public.global_chat_read_status(message_id);

commit;
