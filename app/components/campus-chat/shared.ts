export type Profile = {
  user_id: string;
  username: string;
  display_name: string;
  is_online: boolean;
  last_seen: string;
};

export type FriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
};

export type Friendship = {
  user_id: string;
  friend_id: string;
};

export type Conversation = {
  id: string;
  type: 'global' | 'direct' | 'group';
  name: string | null;
  slug: string | null;
  direct_pair_key: string | null;
  created_by: string | null;
  created_at: string;
};

export type ConversationMember = {
  conversation_id: string;
  user_id: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type NotificationItem = {
  id: string;
  user_id: string;
  type: 'friend_request' | 'friend_accept' | 'group_invite';
  title: string;
  body: string;
  payload: Record<string, string>;
  is_read: boolean;
  created_at: string;
};

export type ActiveChatView = 'chat' | 'friends' | 'requests' | 'notifications';

export type SupabaseErrorLike = {
  code?: string;
  message: string;
};

export const SYSTEM_MESSAGE_PREFIX = '[[system]] ';

export function buildFallbackUsername(email: string, userId: string) {
  const base = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'student';
  return `${base}-${userId.slice(0, 4)}`;
}

export function isDuplicateKeyError(error: SupabaseErrorLike | null) {
  return error?.code === '23505';
}

export function isNoRowsError(error: SupabaseErrorLike | null) {
  return error?.code === 'PGRST116';
}

export function getFriendId(entry: Friendship, currentUserId: string) {
  if (entry.user_id === currentUserId) return entry.friend_id;
  if (entry.friend_id === currentUserId) return entry.user_id;
  return null;
}

export function upsertByKey<T>(items: T[], nextItem: T, getKey: (item: T) => string) {
  const nextKey = getKey(nextItem);
  const nextIndex = items.findIndex((item) => getKey(item) === nextKey);
  if (nextIndex === -1) return [nextItem, ...items];

  const nextItems = [...items];
  nextItems[nextIndex] = nextItem;
  return nextItems;
}

export function sortMessagesByCreatedAt(items: Message[]) {
  return [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function normalizeUsernameSearch(value: string) {
  return value.trim().toLowerCase().replace(/^@+/, '');
}

export function getProfileHeading(profile: Profile | null | undefined) {
  if (!profile) return 'Student';
  return profile.display_name?.trim() || `@${profile.username}`;
}

export function getProfileSubheading(profile: Profile | null | undefined) {
  if (!profile?.username) return null;
  const normalizedDisplayName = profile.display_name?.trim().toLowerCase();
  const normalizedUsername = profile.username.trim().toLowerCase();

  if (normalizedDisplayName === normalizedUsername || normalizedDisplayName === `@${normalizedUsername}`) {
    return null;
  }

  return `@${profile.username}`;
}

export function isSystemMessage(content: string) {
  return content.startsWith(SYSTEM_MESSAGE_PREFIX);
}

export function getSystemMessageBody(content: string) {
  return isSystemMessage(content) ? content.slice(SYSTEM_MESSAGE_PREFIX.length) : content;
}
