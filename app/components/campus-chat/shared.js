export const SYSTEM_MESSAGE_PREFIX = '[[system]] ';
export const GLOBAL_CHAT_SLUG = 'global-campus-chat';
export function buildFallbackUsername(email, userId) {
    const base = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'student';
    return `${base}-${userId.slice(0, 4)}`;
}
export function isDuplicateKeyError(error) {
    return error?.code === '23505';
}
export function isNoRowsError(error) {
    return error?.code === 'PGRST116';
}
export function getFriendId(entry, currentUserId) {
    if (entry.user_id === currentUserId)
        return entry.friend_id;
    if (entry.friend_id === currentUserId)
        return entry.user_id;
    return null;
}
export function upsertByKey(items, nextItem, getKey) {
    const nextKey = getKey(nextItem);
    const nextIndex = items.findIndex((item) => getKey(item) === nextKey);
    if (nextIndex === -1)
        return [nextItem, ...items];
    const nextItems = [...items];
    nextItems[nextIndex] = nextItem;
    return nextItems;
}
export function sortMessagesByCreatedAt(items) {
    return [...items].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}
export function normalizeUsernameSearch(value) {
    return value.trim().toLowerCase().replace(/^@+/, '');
}
export function getProfileHeading(profile) {
    if (!profile)
        return 'Student';
    return profile.display_name?.trim() || `@${profile.username}`;
}
export function getProfileSubheading(profile) {
    if (!profile?.username)
        return null;
    const normalizedDisplayName = profile.display_name?.trim().toLowerCase();
    const normalizedUsername = profile.username.trim().toLowerCase();
    if (normalizedDisplayName === normalizedUsername ||
        normalizedDisplayName === `@${normalizedUsername}`) {
        return null;
    }
    return `@${profile.username}`;
}
export function isSystemMessage(content, explicitIsSystem = false) {
    return explicitIsSystem || content.startsWith(SYSTEM_MESSAGE_PREFIX);
}
export function getSystemMessageBody(content) {
    return content.startsWith(SYSTEM_MESSAGE_PREFIX)
        ? content.slice(SYSTEM_MESSAGE_PREFIX.length)
        : content;
}
export function createSystemMessage(action, userName) {
    return `${SYSTEM_MESSAGE_PREFIX}${[userName, action].filter(Boolean).join(' ')}`;
}
export function getSessionId() {
    if (typeof window === 'undefined') {
        return 'server-session';
    }
    let sessionId = window.sessionStorage.getItem('campusChatSessionId');
    if (!sessionId) {
        sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        window.sessionStorage.setItem('campusChatSessionId', sessionId);
    }
    return sessionId;
}
export function clearSessionData() {
    if (typeof window === 'undefined')
        return;
    window.sessionStorage.removeItem('campusChatSessionId');
    window.localStorage.removeItem('campusChatHiddenConversations');
    Object.keys(window.localStorage).forEach((key) => {
        if (key.startsWith('globalChatReadMessages_')) {
            window.localStorage.removeItem(key);
        }
    });
}
export function generateDirectPairKey(userId1, userId2) {
    return [userId1, userId2].sort().join('|');
}
export function isSameUser(userId1, userId2) {
    return userId1 === userId2;
}
