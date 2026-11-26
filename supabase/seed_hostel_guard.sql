-- In Supabase SQL Editor, replace the empty string with the guard password before running.
set search_path = public, extensions;
insert into public.hostel_guards (guard_id, password_hash)
values ('GUARD', crypt(nullif('', ''), gen_salt('bf', 10)))
on conflict (guard_id) do nothing;
