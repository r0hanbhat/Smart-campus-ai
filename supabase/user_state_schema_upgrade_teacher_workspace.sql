alter table if exists public.user_state
add column if not exists teacher_workspace jsonb not null default '{"courses":[],"announcements":[],"assignments":[],"students":[],"lessonPlans":[],"communications":[]}'::jsonb;
