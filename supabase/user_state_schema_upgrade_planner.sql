alter table if exists public.user_state
add column if not exists planner_entries jsonb not null default '[]'::jsonb;
