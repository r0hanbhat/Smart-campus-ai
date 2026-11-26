-- Event tickets and attendance check-ins. Apply after club_events_schema.sql.

create table if not exists public.event_check_in_tickets (
  registration_id uuid primary key
    references public.event_registrations(id) on delete cascade,
  ticket_token uuid not null unique default gen_random_uuid(),
  checked_in_at timestamptz,
  checked_in_by_role text check (checked_in_by_role in ('admin', 'club')),
  checked_in_by_id uuid,
  created_at timestamptz not null default now(),
  check (
    (checked_in_at is null and checked_in_by_role is null and checked_in_by_id is null)
    or (checked_in_at is not null and checked_in_by_role is not null and checked_in_by_id is not null)
  )
);

alter table public.event_check_in_tickets enable row level security;
revoke all on public.event_check_in_tickets from public, anon, authenticated;
grant select, insert, update, delete on public.event_check_in_tickets to service_role;

create or replace function public.create_event_check_in_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_check_in_tickets (registration_id)
  values (new.id)
  on conflict (registration_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_event_check_in_ticket() from public, anon, authenticated;

drop trigger if exists event_registration_create_check_in_ticket on public.event_registrations;
create trigger event_registration_create_check_in_ticket
  after insert on public.event_registrations
  for each row
  execute function public.create_event_check_in_ticket();

insert into public.event_check_in_tickets (registration_id)
select registration.id
from public.event_registrations registration
on conflict (registration_id) do nothing;
