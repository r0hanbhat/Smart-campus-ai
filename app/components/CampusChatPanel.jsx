'use client';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createSupabaseAuthHeaders } from '@/lib/supabase/auth-fetch.js';
import { CampusChatSidebar, ChatViewPanel, FriendsViewPanel, NotificationsViewPanel, RequestsViewPanel, } from './campus-chat/panels.jsx';
import { buildFallbackUsername, createSystemMessage, generateDirectPairKey, getFriendId, GLOBAL_CHAT_SLUG, getProfileHeading, getProfileSubheading, isDuplicateKeyError, isNoRowsError, normalizeUsernameSearch, sortMessagesByCreatedAt, upsertByKey, } from './campus-chat/shared.js';

function selectCanonicalGlobalConversation(conversationRows) {
    const globalRows = (conversationRows ?? [])
        .filter((conversation) => conversation.type === 'global' || conversation.slug === GLOBAL_CHAT_SLUG)
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return globalRows[0] ?? null;
}

export default function CampusChatPanel({ userId, userEmail }) {
    const [supabase] = useState(() => createClient());
    const [profiles, setProfiles] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);
    const [friendships, setFriendships] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [conversationMembers, setConversationMembers] = useState([]);
    const [groupInvitations, setGroupInvitations] = useState([]);
    const [globalReadStatuses, setGlobalReadStatuses] = useState([]);
    const [messages, setMessages] = useState([]);
    const [selectedConversationId, setSelectedConversationId] = useState(null);
    const [activeView, setActiveView] = useState('chat');
    const [searchTerm, setSearchTerm] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [groupName, setGroupName] = useState('');
    const [groupMemberUsername, setGroupMemberUsername] = useState('');
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [selectedFriendIds, setSelectedFriendIds] = useState([]);
    const [selectedNonFriendIds, setSelectedNonFriendIds] = useState([]);
    const [nonFriendSearchTerm, setNonFriendSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isCreatingGroupChat, setIsCreatingGroupChat] = useState(false);
    const [isAddingGroupMember, setIsAddingGroupMember] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isLeavingGroup, setIsLeavingGroup] = useState(false);
    const [isUnfriending, setIsUnfriending] = useState(false);
    const [chatError, setChatError] = useState(null);
    const messagesContainerRef = useRef(null);
    const selectedConversationIdRef = useRef(null);
    const conversationIdsRef = useRef([]);
    const refreshRequestIdRef = useRef(0);
    const groupCreationInFlightRef = useRef(false);
    const pendingGlobalReadIdsRef = useRef(new Set());
    const conversationsRef = useRef([]);
    const visibleConversationIdsRef = useRef(new Set());
    const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.user_id, profile])), [profiles]);
    const friendIds = useMemo(() => Array.from(new Set([
        ...friendships
            .map((entry) => getFriendId(entry, userId))
            .filter((friendId) => Boolean(friendId)),
        ...friendRequests
            .filter((request) => request.status === 'accepted')
            .map((request) => (request.sender_id === userId ? request.receiver_id : request.sender_id))
            .filter((friendId) => friendId !== userId),
    ])), [friendRequests, friendships, userId]);
    const receivedRequests = useMemo(() => friendRequests.filter((request) => request.receiver_id === userId && request.status === 'pending'), [friendRequests, userId]);
    const sentRequests = useMemo(() => friendRequests.filter((request) => request.sender_id === userId && request.status === 'pending'), [friendRequests, userId]);
    const availableFriends = useMemo(() => friendIds.map((id) => profileMap.get(id)).filter((profile) => Boolean(profile)), [friendIds, profileMap]);
    const persistedGlobalReadMessageIds = useMemo(() => new Set(globalReadStatuses.filter((status) => status.is_read).map((status) => status.message_id)), [globalReadStatuses]);
    const searchableProfiles = useMemo(() => {
        const lowered = normalizeUsernameSearch(searchTerm);
        return profiles.filter((profile) => {
            if (profile.user_id === userId)
                return false;
            if (friendIds.includes(profile.user_id))
                return false;
            if (sentRequests.some((request) => request.receiver_id === profile.user_id))
                return false;
            if (!lowered)
                return true;
            return profile.username.toLowerCase().includes(lowered) || profile.display_name.toLowerCase().includes(lowered);
        });
    }, [friendIds, profiles, searchTerm, sentRequests, userId]);
    const searchableNonFriends = useMemo(() => {
        const lowered = normalizeUsernameSearch(nonFriendSearchTerm === 'active' ? '' : nonFriendSearchTerm);
        return profiles.filter((profile) => {
            if (profile.user_id === userId)
                return false;
            if (friendIds.includes(profile.user_id))
                return false;
            if (selectedNonFriendIds.includes(profile.user_id))
                return false;
            if (sentRequests.some((request) => request.receiver_id === profile.user_id))
                return false;
            if (!lowered)
                return true;
            return (profile.username.toLowerCase().includes(lowered) ||
                profile.display_name.toLowerCase().includes(lowered));
        });
    }, [friendIds, nonFriendSearchTerm, profiles, selectedNonFriendIds, sentRequests, userId]);
    const filteredFriends = useMemo(() => {
        const lowered = normalizeUsernameSearch(searchTerm);
        if (!lowered)
            return availableFriends;
        return availableFriends.filter((friend) => friend.username.toLowerCase().includes(lowered) || friend.display_name.toLowerCase().includes(lowered));
    }, [availableFriends, searchTerm]);
    const canonicalGlobalConversationId = useMemo(() => selectCanonicalGlobalConversation(conversations)?.id ?? null, [conversations]);
    const visibleConversations = useMemo(() => {
        return conversations.filter((conversation) => {
            if (conversation.type === 'global') {
                return conversation.id === canonicalGlobalConversationId;
            }
            return conversationMembers.some((member) =>
                member.conversation_id === conversation.id &&
                member.user_id === userId &&
                member.member_status !== 'left'
            );
        });
    }, [canonicalGlobalConversationId, conversationMembers, conversations, userId]);

    const sortedConversations = useMemo(() => {
        return [...visibleConversations].sort((a, b) => {
            if (a.type === 'global')
                return -1;
            if (b.type === 'global')
                return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [visibleConversations]);
    const selectedConversation = useMemo(() => visibleConversations.find((conversation) => conversation.id === selectedConversationId) ?? null, [selectedConversationId, visibleConversations]);
    const unreadNotifications = notifications.filter((item) => !item.is_read).length;
    const canLeaveSelectedGroup = selectedConversation?.type === 'group';
    const canAddMembersToSelectedGroup = selectedConversation?.type === 'group';
    const canManageSelectedGroup = selectedConversation?.type === 'group' && selectedConversation.created_by === userId;
    const selectedDirectChatPartnerId = useMemo(() => selectedConversation?.type === 'direct'
        ? conversationMembers.find((member) => member.conversation_id === selectedConversation.id &&
            member.user_id !== userId &&
            member.member_status !== 'left')?.user_id ?? null
        : null, [conversationMembers, selectedConversation, userId]);
    const canSendMessages = selectedConversation?.type === 'group'
        ? selectedConversation.group_status !== 'pending'
        : selectedConversation?.type === 'direct'
            ? Boolean(selectedDirectChatPartnerId && friendIds.includes(selectedDirectChatPartnerId))
            : Boolean(selectedConversationId);
    const selectedGroupMembers = useMemo(() => selectedConversation?.type === 'group'
        ? conversationMembers
            .filter((member) => member.conversation_id === selectedConversation.id && member.member_status !== 'left')
            .map((member) => profileMap.get(member.user_id))
            .filter((profile) => Boolean(profile))
        : [], [conversationMembers, profileMap, selectedConversation]);
    const selectedConversationInvitations = useMemo(() => selectedConversation?.type === 'group'
        ? groupInvitations.filter((invitation) => invitation.conversation_id === selectedConversation.id)
        : [], [groupInvitations, selectedConversation]);
    const getConversationTitle = (conversation) => {
        if (conversation.type === 'global')
            return 'Global Campus Chat';
        if (conversation.type === 'group')
            return conversation.name || 'Study Group';
        const memberIds = conversationMembers
            .filter((member) => member.conversation_id === conversation.id && member.user_id !== userId)
            .map((member) => member.user_id);
        const otherProfile = profileMap.get(memberIds[0]);
        if (!otherProfile)
            return 'Private Chat';
        const heading = getProfileHeading(otherProfile);
        const subheading = getProfileSubheading(otherProfile);
        return subheading ? `${heading} (${subheading})` : heading;
    };
    const getCurrentUserLabel = () => {
        const currentProfile = profileMap.get(userId);
        if (currentProfile?.username) {
            return getProfileSubheading(currentProfile) ? `${getProfileHeading(currentProfile)} (${getProfileSubheading(currentProfile)})` : getProfileHeading(currentProfile);
        }
        const fallbackUsername = buildFallbackUsername(userEmail, userId);
        return `${userEmail.split('@')[0] || 'Student'} (@${fallbackUsername})`;
    };
    const loadConversationRecord = async (conversationId) => {
        const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', conversationId)
            .maybeSingle();
        if (error) {
            console.error('Failed to load conversation record:', error.message);
            return null;
        }
        return data ?? null;
    };
    const mergeConversationIntoState = (conversation) => {
        if (!conversation)
            return;
        setConversations((prev) => upsertByKey(prev, conversation, (entry) => entry.id));
    };
    const removeConversationFromState = (conversationId) => {
        setConversations((prev) => prev.filter((conversation) => conversation.id !== conversationId));
        setConversationMembers((prev) => prev.filter((member) => member.conversation_id !== conversationId));
        setGroupInvitations((prev) => prev.filter((invitation) => invitation.conversation_id !== conversationId));
        if (selectedConversationIdRef.current === conversationId) {
            setMessages([]);
        }
    };
    const addConversationMember = async (conversationId, memberId) => {
        try {
            const res = await fetch('/api/chat/add-member', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId, conversationId }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                console.error(`Failed to add member ${memberId} to conversation ${conversationId}:`, data?.message || res.statusText);
                return { ok: false, message: data?.message || res.statusText };
            }
            return { ok: true, message: null };
        }
        catch (error) {
            console.error(`Failed to add member ${memberId} to conversation ${conversationId}:`, error?.message || error);
            return { ok: false, message: error?.message || String(error) };
        }
    };

    const inviteUserToGroup = async (conversationId, invitedUserId) => {
        const invitationId = crypto.randomUUID();
        const invitationTime = new Date().toISOString();
        const invitationResult = await supabase.from('group_invitations').upsert({
            id: invitationId,
            conversation_id: conversationId,
            invited_user_id: invitedUserId,
            invited_by: userId,
            status: 'pending',
            created_at: invitationTime,
        }, {
            onConflict: 'conversation_id,invited_user_id',
            ignoreDuplicates: false,
        });
        if (invitationResult.error && !isDuplicateKeyError(invitationResult.error)) {
            return { ok: false, message: invitationResult.error.message };
        }
        // Use server API to insert conversation_members to avoid RLS issues
        const addResp = await fetch('/api/chat/add-member', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId: invitedUserId, conversationId, memberStatus: 'invited', isCreator: false }),
        });
        const addData = await addResp.json();
        if (!addResp.ok || !addData.ok) {
            // If the failure is a duplicate-key like condition, continue; otherwise fail
            const msg = addData?.message || addResp.statusText;
            if (!msg || !msg.toLowerCase().includes('duplicate')) {
                return { ok: false, message: msg };
            }
        }
        return { ok: true, message: null };
    };
    const loadMessages = useCallback(async (conversationId) => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })
            .limit(200);
        if (error) {
            console.error('Failed to load messages:', error.message);
            setChatError(`Couldn't load messages: ${error.message}`);
            return false;
        }
        setChatError(null);
        const nextMessages = (data ?? []);
        setMessages(nextMessages);
        return true;
    }, [supabase]);
    const flushPendingGlobalReadStatuses = useEffectEvent(async () => {
        const pendingIds = Array.from(pendingGlobalReadIdsRef.current);
        if (pendingIds.length === 0)
            return;
        const { error } = await supabase.from('global_chat_read_status').upsert(pendingIds.map((messageId) => ({
            user_id: userId,
            message_id: messageId,
            is_read: true,
            read_at: new Date().toISOString(),
        })), {
            onConflict: 'user_id,message_id',
            ignoreDuplicates: false,
        });
        if (!error) {
            pendingGlobalReadIdsRef.current.clear();
        }
    });
    const postSystemMessage = async (conversationId, message) => {
        const { error } = await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_id: userId,
            content: createSystemMessage(message, ''),
            is_system: true,
        });
        if (error) {
            console.error('Failed to post system message:', error.message);
        }
    };
    const ensureBaseRecords = async () => {
        const fallbackUsername = buildFallbackUsername(userEmail, userId);
        const authHeaders = await createSupabaseAuthHeaders(supabase);
        const provisionResponse = await fetch('/api/profile/provision', {
            method: 'POST',
            headers: {
                ...Object.fromEntries(authHeaders.entries()),
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                email: userEmail,
                fallbackUsername,
                displayName: userEmail.split('@')[0] || fallbackUsername,
                isOnline: true,
                lastSeen: new Date().toISOString(),
            }),
        });
        if (!provisionResponse.ok) {
            const payload = await provisionResponse.json().catch(() => ({ error: 'Failed to provision profile.' }));
            console.error('Failed to create profile:', payload.error || 'Failed to provision profile.');
        }
        const globalConversationRowsResult = await supabase
            .from('conversations')
            .select('*')
            .eq('slug', GLOBAL_CHAT_SLUG)
            .order('id', { ascending: true });
        let globalConversation = selectCanonicalGlobalConversation(globalConversationRowsResult.data);
        if (!globalConversation) {
            const { data, error } = await supabase.from('conversations').insert({
                type: 'global',
                name: 'Global Campus Chat',
                slug: GLOBAL_CHAT_SLUG,
                created_by: userId,
            }).select().single();
            if (error) {
                if (isDuplicateKeyError(error)) {
                    const retry = await supabase
                        .from('conversations')
                        .select('*')
                        .eq('slug', GLOBAL_CHAT_SLUG)
                        .order('id', { ascending: true });
                    if (!retry.error) {
                        globalConversation = selectCanonicalGlobalConversation(retry.data);
                    }
                    else {
                        console.error('Failed to reload global conversation after duplicate key:', retry.error.message);
                    }
                }
                else {
                    console.error('Failed to create global conversation:', error.message);
                }
            }
            else {
                globalConversation = data;
            }
        }
        if (globalConversation) {
            const inserted = await addConversationMember(globalConversation.id, userId);
            if (!inserted || (typeof inserted === 'object' && !inserted.ok)) {
                console.error('Failed to join global conversation.');
            }
        }
    };
    async function ensureDirectConversation(otherUserId) {
        const pairKey = generateDirectPairKey(userId, otherUserId);
        let createdConversationInThisCall = false;
        const existing = await supabase
            .from('conversations')
            .select('*')
            .eq('direct_pair_key', pairKey)
            .maybeSingle();
        if (existing.error && !isNoRowsError(existing.error)) {
            console.error('Failed to look up direct conversation:', existing.error.message);
            return null;
        }
        let conversation = existing.data;
        if (!conversation) {
            const conversationId = crypto.randomUUID();
            const insertResult = await supabase
                .from('conversations')
                .insert({
                id: conversationId,
                type: 'direct',
                direct_pair_key: pairKey,
                created_by: userId,
            });
            if (insertResult.error && !isDuplicateKeyError(insertResult.error)) {
                console.error('Failed to create direct conversation:', insertResult.error.message);
                return null;
            }
            if (!insertResult.error) {
                conversation = {
                    id: conversationId,
                    type: 'direct',
                    name: null,
                    slug: null,
                    direct_pair_key: pairKey,
                    created_by: userId,
                    created_at: new Date().toISOString(),
                };
                createdConversationInThisCall = true;
            }
            if (!conversation && isDuplicateKeyError(insertResult.error)) {
                const retryLookup = await supabase
                    .from('conversations')
                    .select('*')
                    .eq('direct_pair_key', pairKey)
                    .maybeSingle();
                if (retryLookup.error && !isNoRowsError(retryLookup.error)) {
                    console.error('Failed to reload direct conversation after duplicate key:', retryLookup.error.message);
                    return null;
                }
                conversation = retryLookup.data;
            }
        }
        if (!conversation)
            return null;
        const currentUserAdded = await addConversationMember(conversation.id, userId);
        if (!currentUserAdded.ok) {
            return null;
        }
        if (createdConversationInThisCall || conversation.created_by === userId) {
            const otherUserAdded = await addConversationMember(conversation.id, otherUserId);
            if (!otherUserAdded.ok) {
                return null;
            }
        }
        return conversation;
    }
    async function ensureDirectConversationsForAcceptedFriends(requests) {
        const acceptedFriendIds = Array.from(new Set(requests
            .filter((request) => request.status === 'accepted')
            .map((request) => (request.sender_id === userId ? request.receiver_id : request.sender_id))
            .filter((friendId) => friendId !== userId)));
        for (const friendId of acceptedFriendIds) {
            await ensureDirectConversation(friendId);
        }
    }
    const refreshChatData = async () => {
        const requestId = refreshRequestIdRef.current + 1;
        refreshRequestIdRef.current = requestId;
        const shouldShowSkeleton = conversations.length === 0 && messages.length === 0;
        if (shouldShowSkeleton) {
            setLoading(true);
        }
        else {
            setIsRefreshing(true);
        }
        await ensureBaseRecords();
        const [profilesResult, requestResult, friendshipsResult, notificationsResult, globalConversationRowsResult, globalReadStatusResult,] = await Promise.all([
            supabase.from('profiles').select('*').order('display_name', { ascending: true }),
            supabase
                .from('friend_requests')
                .select('*')
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: false }),
            supabase
                .from('friendships')
                .select('*')
                .or(`user_id.eq.${userId},friend_id.eq.${userId}`),
            supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50),
            supabase.from('conversations').select('*').eq('slug', GLOBAL_CHAT_SLUG).order('id', { ascending: true }),
            supabase.from('global_chat_read_status').select('*').eq('user_id', userId),
        ]);
        if (profilesResult.data)
            setProfiles(profilesResult.data);
        const requestRows = (requestResult.data ?? []);
        setFriendRequests(requestRows);
        if (friendshipsResult.data)
            setFriendships(friendshipsResult.data);
        if (notificationsResult.data)
            setNotifications(notificationsResult.data);
        if (globalReadStatusResult.data) {
            setGlobalReadStatuses(globalReadStatusResult.data);
        }
        await ensureDirectConversationsForAcceptedFriends(requestRows);
        const membersResult = await supabase.from('conversation_members').select('*').eq('user_id', userId);
        if (refreshRequestIdRef.current !== requestId)
            return;
        const memberRows = (membersResult.data ?? []);
        const conversationIds = new Set(memberRows.map((member) => member.conversation_id));
        const globalConversation = selectCanonicalGlobalConversation(globalConversationRowsResult.data);
        if (globalConversation)
            conversationIds.add(globalConversation.id);
        let loadedConversations = [];
        if (conversationIds.size > 0) {
            const { data } = await supabase
                .from('conversations')
                .select('*')
                .in('id', Array.from(conversationIds));
            loadedConversations = (data ?? []);
        }
        const allConversationIds = loadedConversations.map((conversation) => conversation.id);
        let allMembers = memberRows;
        let loadedInvitations = [];
        if (allConversationIds.length > 0) {
            const [{ data: memberData }, { data: invitationData }] = await Promise.all([
                supabase
                    .from('conversation_members')
                    .select('*')
                    .in('conversation_id', allConversationIds),
                supabase
                    .from('group_invitations')
                    .select('*')
                    .in('conversation_id', allConversationIds),
            ]);
            allMembers = (memberData ?? []);
            loadedInvitations = (invitationData ?? []);
        }
        if (refreshRequestIdRef.current !== requestId)
            return;
        setConversationMembers(allMembers);
        setGroupInvitations(loadedInvitations);
        setConversations(loadedConversations);
        const canonicalGlobalConversation = selectCanonicalGlobalConversation(loadedConversations);
        const visibleConversationIds = new Set(loadedConversations
            .filter((conversation) => {
            if (conversation.type === 'global')
                return conversation.id === canonicalGlobalConversation?.id;
            return allMembers.some((member) => member.conversation_id === conversation.id &&
                member.user_id === userId &&
                member.member_status !== 'left');
        })
            .map((conversation) => conversation.id));
        const currentSelectedConversationId = selectedConversationIdRef.current;
        const nextSelectedConversationId = currentSelectedConversationId && visibleConversationIds.has(currentSelectedConversationId)
            ? currentSelectedConversationId
            : globalConversation?.id ??
                loadedConversations.find((conversation) => visibleConversationIds.has(conversation.id))?.id ??
                null;
        setSelectedConversationId(nextSelectedConversationId);
        if (nextSelectedConversationId) {
            await loadMessages(nextSelectedConversationId);
        }
        else if (shouldShowSkeleton) {
            setMessages([]);
        }
        if (refreshRequestIdRef.current !== requestId)
            return;
        setLoading(false);
        setIsRefreshing(false);
    };
    const refreshChatDataEvent = useEffectEvent(() => {
        void refreshChatData();
    });
    useEffect(() => {
        refreshChatDataEvent();
        return () => {
            void flushPendingGlobalReadStatuses();
            void supabase
                .from('profiles')
                .update({ is_online: false, last_seen: new Date().toISOString() })
                .eq('user_id', userId);
        };
    }, [supabase, userEmail, userId]);
    useEffect(() => {
        const handlePageHide = () => {
            void flushPendingGlobalReadStatuses();
        };
        window.addEventListener('pagehide', handlePageHide);
        return () => {
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, [supabase, userId]);
    useEffect(() => {
        selectedConversationIdRef.current = selectedConversationId;
        conversationIdsRef.current = conversations.map((conversation) => conversation.id);
        conversationsRef.current = conversations;
        visibleConversationIdsRef.current = new Set(visibleConversations.map((conversation) => conversation.id));
        if (!selectedConversationId)
            return;
        void loadMessages(selectedConversationId);
    }, [conversations, loadMessages, selectedConversationId, visibleConversations]);
    useEffect(() => {
        if (!selectedConversationId)
            return;
        if (visibleConversations.some((conversation) => conversation.id === selectedConversationId))
            return;
        const fallbackConversationId = visibleConversations.find((conversation) => conversation.type === 'global')?.id ??
            visibleConversations[0]?.id ??
            null;
        setSelectedConversationId(fallbackConversationId);
    }, [selectedConversationId, visibleConversations]);
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container)
            return;
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth',
        });
    }, [messages]);
    useEffect(() => {
        if (selectedConversation?.type !== 'global')
            return;
        messages.forEach((message) => {
            if (!persistedGlobalReadMessageIds.has(message.id)) {
                pendingGlobalReadIdsRef.current.add(message.id);
            }
        });
    }, [messages, persistedGlobalReadMessageIds, selectedConversation]);
    // Keep the open conversation feeling live even if a realtime event is delayed.
    useEffect(() => {
        if (!selectedConversationId)
            return;
        void loadMessages(selectedConversationId);
        const intervalId = window.setInterval(() => {
            if (document.visibilityState !== 'visible')
                return;
            void loadMessages(selectedConversationId);
        }, 2500);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [loadMessages, selectedConversationId]);
    // Fallback sync only. Realtime subscriptions are the primary data path.
    useEffect(() => {
        const intervalId = window.setInterval(() => {
            refreshChatDataEvent();
        }, 60000);
        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    const handleProfileChange = useEffectEvent((payload) => {
        const nextProfile = payload.new;
        const previousProfile = payload.old;
        const targetUserId = nextProfile?.user_id ?? previousProfile?.user_id;
        if (!targetUserId)
            return;
        if (payload.eventType === 'DELETE') {
            setProfiles((prev) => prev.filter((profile) => profile.user_id !== targetUserId));
            return;
        }
        if (!nextProfile)
            return;
        setProfiles((prev) => upsertByKey(prev, nextProfile, (profile) => profile.user_id));
    });
    const handleFriendRequestChange = useEffectEvent((payload) => {
        const nextRequest = payload.new;
        const previousRequest = payload.old;
        const targetRequest = nextRequest ?? previousRequest;
        if (!targetRequest)
            return;
        if (targetRequest.sender_id !== userId && targetRequest.receiver_id !== userId)
            return;
        if (payload.eventType === 'DELETE') {
            setFriendRequests((prev) => prev.filter((request) => request.id !== targetRequest.id));
        }
        else if (nextRequest) {
            setFriendRequests((prev) => upsertByKey(prev, nextRequest, (request) => request.id));
        }
        void refreshChatData();
    });
    const handleFriendshipChange = useEffectEvent((payload) => {
        const nextFriendship = payload.new;
        const previousFriendship = payload.old;
        const targetFriendship = nextFriendship ?? previousFriendship;
        if (!targetFriendship)
            return;
        if (targetFriendship.user_id !== userId && targetFriendship.friend_id !== userId)
            return;
        if (payload.eventType === 'DELETE') {
            setFriendships((prev) => prev.filter((entry) => !(entry.user_id === targetFriendship.user_id &&
                entry.friend_id === targetFriendship.friend_id)));
        }
        else if (nextFriendship) {
            setFriendships((prev) => {
                const exists = prev.some((entry) => entry.user_id === nextFriendship.user_id && entry.friend_id === nextFriendship.friend_id);
                return exists ? prev : [nextFriendship, ...prev];
            });
        }
        void refreshChatData();
    });
    const handleNotificationChange = useEffectEvent((payload) => {
        const nextNotification = payload.new;
        const previousNotification = payload.old;
        const targetNotification = nextNotification ?? previousNotification;
        if (!targetNotification || targetNotification.user_id !== userId)
            return;
        if (payload.eventType === 'DELETE') {
            setNotifications((prev) => prev.filter((notification) => notification.id !== targetNotification.id));
            return;
        }
        if (!nextNotification)
            return;
        setNotifications((prev) => upsertByKey(prev, nextNotification, (notification) => notification.id));
        if (payload.eventType === 'INSERT' &&
            (nextNotification.type === 'group_invite' ||
                nextNotification.type === 'friend_accept' ||
                nextNotification.type === 'group_member_joined' ||
                nextNotification.type === 'group_member_left')) {
            void refreshChatData();
        }
    });
    const handleConversationStructureChange = useEffectEvent((payload) => {
        const nextRow = payload.new;
        const previousRow = payload.old;
        const conversationId = nextRow?.id ?? previousRow?.id;
        if (!conversationId)
            return;
        const isKnownConversation = conversationIdsRef.current.includes(conversationId);
        const isCreatedByCurrentUser = nextRow?.created_by === userId || previousRow?.created_by === userId;
        if (!isKnownConversation && !isCreatedByCurrentUser) {
            return;
        }
        if (payload.eventType === 'DELETE') {
            removeConversationFromState(conversationId);
            return;
        }
        if (!nextRow)
            return;
        mergeConversationIntoState(nextRow);
    });
    const handleConversationMemberChange = useEffectEvent((payload) => {
        const nextMember = payload.new;
        const previousMember = payload.old;
        const targetMember = nextMember ?? previousMember;
        if (!targetMember)
            return;
        const conversationId = targetMember.conversation_id;
        const memberUserId = targetMember.user_id;
        const isSelectedGroup = selectedConversationIdRef.current === conversationId;
        const affectsKnownConversation = conversationIdsRef.current.includes(conversationId);
        const affectsCurrentUserMembership = memberUserId === userId;
        if (!affectsKnownConversation && !affectsCurrentUserMembership) {
            return;
        }
        if (payload.eventType === 'DELETE') {
            setConversationMembers((prev) => prev.filter((member) => !(member.conversation_id === conversationId && member.user_id === memberUserId)));
            if (affectsCurrentUserMembership) {
                removeConversationFromState(conversationId);
                if (isSelectedGroup) {
                    const fallbackConversationId = conversationsRef.current
                        .filter((conversation) => conversation.id !== conversationId)
                        .find((conversation) => conversation.type === 'global')?.id ??
                        conversationsRef.current.find((conversation) => conversation.id !== conversationId)?.id ??
                        null;
                    setSelectedConversationId(fallbackConversationId);
                }
            }
            return;
        }
        if (!nextMember)
            return;
        setConversationMembers((prev) => upsertByKey(prev, nextMember, (member) => `${member.conversation_id}:${member.user_id}`));
        if (affectsCurrentUserMembership && !conversationIdsRef.current.includes(conversationId)) {
            void loadConversationRecord(conversationId).then((conversation) => {
                if (!conversation)
                    return;
                mergeConversationIntoState(conversation);
                if (nextMember.member_status !== 'left' && !selectedConversationIdRef.current) {
                    setSelectedConversationId(conversation.id);
                }
            });
        }
        if (affectsCurrentUserMembership && nextMember.member_status === 'left') {
            removeConversationFromState(conversationId);
        }
        if (selectedConversationIdRef.current === conversationId) {
            void loadMessages(conversationId);
        }
    });
    const handleMessageChange = useEffectEvent((payload) => {
        const nextMessage = payload.new;
        const previousMessage = payload.old;
        const targetMessage = nextMessage ?? previousMessage;
        if (!targetMessage)
            return;
        if (!conversationIdsRef.current.includes(targetMessage.conversation_id))
            return;
        if (selectedConversationIdRef.current === targetMessage.conversation_id) {
            if (payload.eventType === 'DELETE') {
                setMessages((prev) => prev.filter((message) => message.id !== targetMessage.id));
            }
            else if (nextMessage) {
                setMessages((prev) => {
                    return sortMessagesByCreatedAt(upsertByKey(prev, nextMessage, (message) => message.id));
                });
            }
        }
        if (payload.eventType === 'INSERT') {
            setConversations((prev) => {
                const current = prev.find((conversation) => conversation.id === targetMessage.conversation_id);
                if (!current)
                    return prev;
                if (current.type === 'global') {
                    return prev;
                }
                return [
                    {
                        ...current,
                        created_at: targetMessage.created_at,
                    },
                    ...prev.filter((conversation) => conversation.id !== current.id),
                ];
            });
            if (selectedConversationIdRef.current !== targetMessage.conversation_id &&
                visibleConversationIdsRef.current.has(targetMessage.conversation_id)) {
                void loadConversationRecord(targetMessage.conversation_id).then((conversation) => {
                    mergeConversationIntoState(conversation);
                });
            }
        }
    });
    const handleGlobalReadStatusChange = useEffectEvent((payload) => {
        const nextStatus = payload.new;
        const previousStatus = payload.old;
        const targetStatus = nextStatus ?? previousStatus;
        if (!targetStatus || targetStatus.user_id !== userId)
            return;
        if (payload.eventType === 'DELETE') {
            setGlobalReadStatuses((prev) => prev.filter((status) => status.id !== targetStatus.id));
            return;
        }
        if (!nextStatus)
            return;
        setGlobalReadStatuses((prev) => upsertByKey(prev, nextStatus, (status) => status.message_id));
    });
    const handleGroupInvitationChange = useEffectEvent((payload) => {
        const nextInvitation = payload.new;
        const previousInvitation = payload.old;
        const targetInvitation = nextInvitation ?? previousInvitation;
        if (!targetInvitation)
            return;
        if (payload.eventType === 'DELETE') {
            setGroupInvitations((prev) => prev.filter((invitation) => invitation.id !== targetInvitation.id));
        }
        else if (nextInvitation) {
            setGroupInvitations((prev) => upsertByKey(prev, nextInvitation, (invitation) => invitation.id));
        }
        if (targetInvitation.invited_user_id === userId || targetInvitation.invited_by === userId) {
            if (!conversationIdsRef.current.includes(targetInvitation.conversation_id)) {
                void loadConversationRecord(targetInvitation.conversation_id).then((conversation) => {
                    mergeConversationIntoState(conversation);
                });
            }
        }
    });
    useEffect(() => {
        const socialChannel = supabase
            .channel(`campus-social:${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, handleProfileChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, handleFriendRequestChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, handleFriendshipChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, handleNotificationChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, handleConversationStructureChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, handleConversationMemberChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_invitations' }, handleGroupInvitationChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'global_chat_read_status' }, handleGlobalReadStatusChange)
            .subscribe();
        const messageChannel = supabase
            .channel(`campus-messages:${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, handleMessageChange)
            .subscribe();
        return () => {
            void supabase.removeChannel(socialChannel);
            void supabase.removeChannel(messageChannel);
        };
    }, [supabase, userId]);
    const sendFriendRequest = async (receiverId) => {
        const receiverProfile = profileMap.get(receiverId);
        if (!receiverProfile)
            return;
        setChatError(null);
        const { error: requestError } = await supabase.from('friend_requests').insert({
            sender_id: userId,
            receiver_id: receiverId,
            status: 'pending',
        });
        if (requestError && !isDuplicateKeyError(requestError)) {
            setChatError(`Couldn't send friend request: ${requestError.message}`);
            return;
        }
        await supabase.from('notifications').insert({
            user_id: receiverId,
            type: 'friend_request',
            title: 'New friend request',
            body: `${profileMap.get(userId)?.display_name || userEmail} sent you a friend request.`,
            payload: { sender_id: userId, sender_username: profileMap.get(userId)?.username || userEmail },
        });
        await refreshChatData();
    };
    const acceptFriendRequest = async (request) => {
        setChatError(null);
        const { error: requestError } = await supabase
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', request.id);
        if (requestError) {
            setChatError(`Couldn't accept the request: ${requestError.message}`);
            return;
        }
        const { error: friendshipError } = await supabase.from('friendships').upsert({
            user_id: request.receiver_id,
            friend_id: request.sender_id,
        });
        if (friendshipError && !isDuplicateKeyError(friendshipError)) {
            setChatError(`Friend request was accepted, but the friendship record failed: ${friendshipError.message}`);
            return;
        }
        const directConversation = await ensureDirectConversation(request.sender_id);
        if (!directConversation) {
            setChatError("Friend request was accepted, but the private chat couldn't be prepared yet.");
        }
        await supabase.from('notifications').insert({
            user_id: request.sender_id,
            type: 'friend_accept',
            title: 'Friend request accepted',
            body: `${profileMap.get(userId)?.display_name || userEmail} accepted your friend request.`,
            payload: {
                friend_id: userId,
                conversation_id: directConversation?.id || '',
            },
        });
        setFriendRequests((prev) => prev.map((item) => item.id === request.id
            ? {
                ...item,
                status: 'accepted',
            }
            : item));
        setFriendships((prev) => {
            const alreadyExists = prev.some((item) => (item.user_id === request.receiver_id && item.friend_id === request.sender_id) ||
                (item.user_id === request.sender_id && item.friend_id === request.receiver_id));
            if (alreadyExists)
                return prev;
            return [
                ...prev,
                {
                    user_id: request.receiver_id,
                    friend_id: request.sender_id,
                },
            ];
        });
        await refreshChatData();
        if (directConversation) {
            setActiveView('chat');
            setSelectedConversationId(directConversation.id);
        }
    };
    const rejectFriendRequest = async (requestId) => {
        setChatError(null);
        await supabase.from('friend_requests').update({ status: 'rejected' }).eq('id', requestId);
        await refreshChatData();
    };
    const openDirectChat = async (friendId) => {
        setChatError(null);
        const conversation = await ensureDirectConversation(friendId);
        await refreshChatData();
        if (conversation) {
            setActiveView('chat');
            setSelectedConversationId(conversation.id);
        }
        else {
            setChatError("Couldn't open the private chat yet. Try again in a moment.");
        }
    };
    const createGroupChat = async () => {
        if (groupCreationInFlightRef.current)
            return;
        const trimmedGroupName = groupName.trim();
        setChatError(null);
        if (!trimmedGroupName) {
            setChatError('Give the group a name before creating it.');
            return;
        }
        if (selectedFriendIds.length === 0 && selectedNonFriendIds.length === 0) {
            setChatError('Choose at least one friend or person to invite.');
            return;
        }
        groupCreationInFlightRef.current = true;
        setIsCreatingGroupChat(true);
        try {
            const willBePending = selectedFriendIds.length === 0 && selectedNonFriendIds.length > 0;
            const conversationId = crypto.randomUUID();
            const { error: conversationInsertError } = await supabase
                .from('conversations')
                .insert({
                id: conversationId,
                type: 'group',
                name: trimmedGroupName,
                created_by: userId,
                group_status: willBePending ? 'pending' : 'active',
            });
            if (conversationInsertError) {
                setChatError(`Couldn't create the group: ${conversationInsertError.message}`);
                return;
            }
            const conversation = {
                id: conversationId,
                type: 'group',
                name: trimmedGroupName,
                slug: null,
                direct_pair_key: null,
                created_by: userId,
                group_status: willBePending ? 'pending' : 'active',
                created_at: new Date().toISOString(),
            };
            const creatorResult = await supabase.from('conversation_members').upsert({
                conversation_id: conversation.id,
                user_id: userId,
                is_creator: true,
                member_status: 'active',
                joined_at: new Date().toISOString(),
            });
            if (creatorResult.error && !isDuplicateKeyError(creatorResult.error)) {
                setChatError(`The group was created, but you could not be joined to it: ${creatorResult.error.message}.`);
                return;
            }
            const uniqueFriendMembers = Array.from(new Set(selectedFriendIds));
            for (const memberId of uniqueFriendMembers) {
                const added = await supabase.from('conversation_members').upsert({
                    conversation_id: conversation.id,
                    user_id: memberId,
                    is_creator: false,
                    member_status: 'active',
                    joined_at: new Date().toISOString(),
                });
                if (added.error && !isDuplicateKeyError(added.error)) {
                    setChatError(`The group was created, but a friend could not be added: ${added.error.message}.`);
                    return;
                }
            }
            const uniqueInvitedMembers = Array.from(new Set(selectedNonFriendIds));
            for (const invitedUserId of uniqueInvitedMembers) {
                const invited = await inviteUserToGroup(conversation.id, invitedUserId);
                if (!invited.ok) {
                    setChatError(`The group was created, but an invitation could not be sent: ${invited.message || 'unknown error'}.`);
                    return;
                }
            }
            await postSystemMessage(conversation.id, `${getCurrentUserLabel()} created the group.`);
            const notificationRecipients = [...uniqueFriendMembers, ...uniqueInvitedMembers];
            if (notificationRecipients.length > 0) {
                await supabase.from('notifications').insert(notificationRecipients.map((memberId) => ({
                    user_id: memberId,
                    type: 'group_invite',
                    title: uniqueInvitedMembers.includes(memberId) ? 'Group invitation' : 'Added to a group chat',
                    body: `${profileMap.get(userId)?.display_name || userEmail} added you to "${trimmedGroupName}".`,
                    payload: { conversation_id: conversation.id },
                })));
            }
            setGroupName('');
            setSelectedFriendIds([]);
            setSelectedNonFriendIds([]);
            setNonFriendSearchTerm('');
            setIsCreatingGroup(false);
            await refreshChatData();
            setActiveView('chat');
            setSelectedConversationId(conversation.id);
        }
        finally {
            groupCreationInFlightRef.current = false;
            setIsCreatingGroupChat(false);
        }
    };
    const leaveSelectedGroup = async () => {
        if (!selectedConversation || selectedConversation.type !== 'group' || isLeavingGroup)
            return;
        setChatError(null);
        setIsLeavingGroup(true);
        const conversationId = selectedConversation.id;
        const remainingConversations = conversations.filter((conversation) => conversation.id !== conversationId);
        const fallbackConversationId = remainingConversations.find((conversation) => conversation.type === 'global')?.id ??
            remainingConversations[0]?.id ??
            null;
        setConversations(remainingConversations);
        setConversationMembers((prev) => prev.filter((member) => member.conversation_id !== conversationId || member.user_id !== userId));
        setMessages((prev) => (selectedConversationIdRef.current === conversationId ? [] : prev));
        if (selectedConversationIdRef.current === conversationId) {
            setSelectedConversationId(fallbackConversationId);
        }
        await postSystemMessage(conversationId, `${getCurrentUserLabel()} left the group.`);
        const { error } = await supabase
            .from('conversation_members')
            .update({ member_status: 'left', left_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', userId);
        if (error) {
            setChatError(`Couldn't leave the group: ${error.message}`);
            await refreshChatData();
            setIsLeavingGroup(false);
            return;
        }
        const { data: membershipAfterDelete, error: verifyDeleteError } = await supabase
            .from('conversation_members')
            .select('conversation_id,member_status')
            .eq('conversation_id', conversationId)
            .eq('user_id', userId)
            .maybeSingle();
        if (verifyDeleteError && !isNoRowsError(verifyDeleteError)) {
            setChatError(`Group leave verification failed: ${verifyDeleteError.message}`);
            await refreshChatData();
            setIsLeavingGroup(false);
            return;
        }
        if (membershipAfterDelete && membershipAfterDelete.member_status !== 'left') {
            setChatError("Couldn't leave the group because your membership status is still active.");
            await refreshChatData();
            setIsLeavingGroup(false);
            return;
        }
        await supabase.from('notifications').insert({
            user_id: selectedConversation.created_by || userId,
            type: 'group_member_left',
            title: 'Group member left',
            body: `${getCurrentUserLabel()} left "${selectedConversation.name || 'your group'}".`,
            payload: { conversation_id: conversationId },
        });
        await refreshChatData();
        setIsLeavingGroup(false);
    };
    const addMemberToSelectedGroup = async () => {
        if (!selectedConversation || selectedConversation.type !== 'group' || !canAddMembersToSelectedGroup || isAddingGroupMember) {
            return;
        }
        const trimmedUsername = groupMemberUsername.trim().toLowerCase();
        setChatError(null);
        if (!trimmedUsername) {
            setChatError('Enter a username to add someone to this group.');
            return;
        }
        const targetProfile = profiles.find((profile) => profile.username.toLowerCase() === trimmedUsername) ?? null;
        if (!targetProfile) {
            setChatError(`No user found with username "${trimmedUsername}".`);
            return;
        }
        if (targetProfile.user_id === userId) {
            setChatError('You are already part of this group.');
            return;
        }
        const isAlreadyMember = conversationMembers.some((member) => member.conversation_id === selectedConversation.id &&
            member.user_id === targetProfile.user_id &&
            member.member_status !== 'left');
        if (isAlreadyMember) {
            setChatError(`@${targetProfile.username} is already in this group.`);
            return;
        }
        setIsAddingGroupMember(true);
        try {
            const added = await addConversationMember(selectedConversation.id, targetProfile.user_id);
            if (!added.ok) {
                setChatError(`Couldn't add @${targetProfile.username}: ${added.message || 'unknown error'}`);
                return;
            }
            await postSystemMessage(selectedConversation.id, `${getCurrentUserLabel()} added ${getProfileHeading(targetProfile)} (@${targetProfile.username}) to the group.`);
            await supabase.from('notifications').insert({
                user_id: targetProfile.user_id,
                type: 'group_invite',
                title: 'Added to a group chat',
                body: `${getCurrentUserLabel()} added you to "${selectedConversation.name || 'a group chat'}".`,
                payload: { conversation_id: selectedConversation.id },
            });
            setGroupMemberUsername('');
            await refreshChatData();
        }
        finally {
            setIsAddingGroupMember(false);
        }
    };
    const removeMemberFromSelectedGroup = async (targetProfile) => {
        if (!selectedConversation || selectedConversation.type !== 'group' || !canManageSelectedGroup) {
            return;
        }
        if (targetProfile.user_id === userId) {
            setChatError('Use "Leave Group" if you want to remove yourself.');
            return;
        }
        setChatError(null);
        const { error } = await supabase
            .from('conversation_members')
            .update({ member_status: 'left', left_at: new Date().toISOString() })
            .eq('conversation_id', selectedConversation.id)
            .eq('user_id', targetProfile.user_id);
        if (error) {
            setChatError(`Couldn't remove @${targetProfile.username}: ${error.message}`);
            return;
        }
        await postSystemMessage(selectedConversation.id, `${getCurrentUserLabel()} removed ${getProfileHeading(targetProfile)} (@${targetProfile.username}) from the group.`);
        await supabase.from('notifications').insert({
            user_id: targetProfile.user_id,
            type: 'group_member_left',
            title: 'Removed from group',
            body: `${getCurrentUserLabel()} removed you from "${selectedConversation.name || 'a group chat'}".`,
            payload: { conversation_id: selectedConversation.id },
        });
        await refreshChatData();
    };
    const sendMessage = async () => {
        const trimmedMessage = newMessage.trim();
        setChatError(null);
        if (!selectedConversationId) {
            setChatError('Wait for a conversation to finish loading, then try again.');
            return;
        }
        if (!trimmedMessage)
            return;
        if (!canSendMessages) {
            setChatError('This group is still pending activation.');
            return;
        }
        setIsSending(true);
        const optimisticMessage = {
            id: `temp-${crypto.randomUUID()}`,
            conversation_id: selectedConversationId,
            sender_id: userId,
            content: trimmedMessage,
            is_system: false,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => sortMessagesByCreatedAt([...prev, optimisticMessage]));
        setNewMessage('');
        const { data, error } = await supabase
            .from('messages')
            .insert({
            conversation_id: selectedConversationId,
            sender_id: userId,
            content: trimmedMessage,
            is_system: false,
        })
            .select()
            .single();
        if (error) {
            console.error('Failed to send message:', error.message);
            setChatError(`Couldn't send message: ${error.message}`);
            setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
            setIsSending(false);
            return;
        }
        if (data) {
            setMessages((prev) => sortMessagesByCreatedAt(upsertByKey(prev.map((message) => (message.id === optimisticMessage.id ? data : message)), data, (message) => message.id)));
        }
        setIsSending(false);
    };
    const markNotificationRead = async (notification) => {
        await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
        const conversationId = notification.payload?.conversation_id;
        if (conversationId) {
            setSelectedConversationId(conversationId);
            setActiveView('chat');
        }
        await refreshChatData();
    };
    const canRequestFriendFromSender = (senderId) => {
        if (senderId === userId)
            return false;
        if (friendIds.includes(senderId))
            return false;
        return !friendRequests.some((request) => (request.sender_id === userId && request.receiver_id === senderId) ||
            (request.sender_id === senderId && request.receiver_id === userId));
    };
    const acceptGroupInvitation = async (notification) => {
        const conversationId = notification.payload?.conversation_id;
        if (!conversationId)
            return;
        const invitation = groupInvitations.find((entry) => entry.conversation_id === conversationId && entry.invited_user_id === userId && entry.status === 'pending');
        if (!invitation) {
            setChatError('This invitation is no longer pending.');
            return;
        }
        await supabase.from('group_invitations').update({ status: 'accepted' }).eq('id', invitation.id);
        await supabase
            .from('conversation_members')
            .update({ member_status: 'active', left_at: null, joined_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', userId);
        await supabase.from('conversations').update({ group_status: 'active' }).eq('id', conversationId);
        await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
        const conversation = conversations.find((entry) => entry.id === conversationId);
        await supabase.from('notifications').insert({
            user_id: conversation?.created_by || userId,
            type: 'group_member_joined',
            title: 'Group member joined',
            body: `${getCurrentUserLabel()} joined "${conversation?.name || 'your group'}".`,
            payload: { conversation_id: conversationId },
        });
        await postSystemMessage(conversationId, `${getCurrentUserLabel()} joined the group.`);
        await refreshChatData();
        setSelectedConversationId(conversationId);
        setActiveView('chat');
    };
    const rejectGroupInvitation = async (notification) => {
        const conversationId = notification.payload?.conversation_id;
        if (!conversationId)
            return;
        const invitation = groupInvitations.find((entry) => entry.conversation_id === conversationId && entry.invited_user_id === userId && entry.status === 'pending');
        if (!invitation) {
            setChatError('This invitation is no longer pending.');
            return;
        }
        await supabase.from('group_invitations').update({ status: 'rejected' }).eq('id', invitation.id);
        await supabase
            .from('conversation_members')
            .update({ member_status: 'left', left_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', userId);
        await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
        await refreshChatData();
    };
    const unfriendUser = async (friendUserId) => {
        setIsUnfriending(true);
        setChatError(null);
        try {
            const response = await fetch('/api/chat/unfriend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ friendUserId }),
            });
            const data = await response.json();
            if (!response.ok || !data.ok) {
                setChatError(`Couldn't remove this friend: ${data.message || response.statusText}`);
                return;
            }
            setFriendships((prev) => prev.filter((item) => !((item.user_id === userId && item.friend_id === friendUserId) ||
                (item.user_id === friendUserId && item.friend_id === userId))));
            setFriendRequests((prev) => prev.filter((item) => !((item.sender_id === userId && item.receiver_id === friendUserId) ||
                (item.sender_id === friendUserId && item.receiver_id === userId))));
            await refreshChatData();
        }
        finally {
            setIsUnfriending(false);
        }
    };
    return (<div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <CampusChatSidebar activeView={activeView} availableFriends={availableFriends} createGroupChat={createGroupChat} getConversationTitle={getConversationTitle} groupName={groupName} isCreatingGroup={isCreatingGroup} isCreatingGroupChat={isCreatingGroupChat} nonFriendSearchTerm={nonFriendSearchTerm} receivedRequestsCount={receivedRequests.length} searchableNonFriends={searchableNonFriends} selectedConversationId={selectedConversationId} selectedFriendIds={selectedFriendIds} selectedNonFriendIds={selectedNonFriendIds} setActiveView={setActiveView} setGroupName={setGroupName} setIsCreatingGroup={setIsCreatingGroup} setNonFriendSearchTerm={setNonFriendSearchTerm} setSelectedConversationId={setSelectedConversationId} setSelectedFriendIds={setSelectedFriendIds} setSelectedNonFriendIds={setSelectedNonFriendIds} sortedConversations={sortedConversations} unreadNotifications={unreadNotifications}/>

      <div className="campus-panel-strong rounded-[1.9rem] p-4">
        {activeView === 'chat' ? (<ChatViewPanel addMemberToSelectedGroup={addMemberToSelectedGroup} canAddMembersToSelectedGroup={canAddMembersToSelectedGroup} canLeaveSelectedGroup={canLeaveSelectedGroup} canManageSelectedGroup={canManageSelectedGroup} canRequestFriendFromSender={canRequestFriendFromSender} canSendMessages={canSendMessages} chatError={chatError} getConversationTitle={getConversationTitle} groupInvitations={selectedConversationInvitations} groupMemberUsername={groupMemberUsername} isAddingGroupMember={isAddingGroupMember} isLeavingGroup={isLeavingGroup} isRefreshing={isRefreshing} isSending={isSending} leaveSelectedGroup={leaveSelectedGroup} loading={loading} messages={messages} messagesContainerRef={messagesContainerRef} newMessage={newMessage} profileMap={profileMap} removeMemberFromSelectedGroup={removeMemberFromSelectedGroup} selectedConversation={selectedConversation} selectedConversationId={selectedConversationId} selectedGroupMembers={selectedGroupMembers} sendMessage={sendMessage} sendFriendRequestFromMessage={sendFriendRequest} setGroupMemberUsername={setGroupMemberUsername} setNewMessage={setNewMessage} userId={userId}/>) : null}

        {activeView === 'friends' ? (<FriendsViewPanel availableFriends={availableFriends} filteredFriends={filteredFriends} openDirectChat={openDirectChat} searchTerm={searchTerm} searchableProfiles={searchableProfiles} sendFriendRequest={sendFriendRequest} setSearchTerm={setSearchTerm} unfriendUser={unfriendUser} isUnfriending={isUnfriending}/>) : null}

        {activeView === 'requests' ? (<RequestsViewPanel acceptFriendRequest={acceptFriendRequest} profileMap={profileMap} receivedRequests={receivedRequests} rejectFriendRequest={rejectFriendRequest} sentRequests={sentRequests}/>) : null}

        {activeView === 'notifications' ? (<NotificationsViewPanel acceptGroupInvitation={acceptGroupInvitation} markNotificationRead={markNotificationRead} notifications={notifications} rejectGroupInvitation={rejectGroupInvitation}/>) : null}
      </div>
    </div>);
}
