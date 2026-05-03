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
