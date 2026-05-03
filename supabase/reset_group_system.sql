begin;

-- Remove all group invite notifications from the previous group-chat system.
delete from public.notifications
where type = 'group_invite';

-- Remove every group conversation. Related members and messages are removed
-- automatically because conversation_members and messages cascade on delete.
delete from public.conversations
where type = 'group';

commit;
