'use client';

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import {
  CampusChatSidebar,
  ChatViewPanel,
  FriendsViewPanel,
  NotificationsViewPanel,
  RequestsViewPanel,
} from './campus-chat/panels';
import {
  buildFallbackUsername,
  getFriendId,
  getProfileHeading,
  getProfileSubheading,
  type ActiveChatView,
  isDuplicateKeyError,
  isNoRowsError,
  normalizeUsernameSearch,
  sortMessagesByCreatedAt,
  upsertByKey,
  type Conversation,
  type ConversationMember,
  type FriendRequest,
  type Friendship,
  type Message,
  type NotificationItem,
  type Profile,
} from './campus-chat/shared';

type CampusChatPanelProps = {
  userId: string;
  userEmail: string;
};

export default function CampusChatPanel({ userId, userEmail }: CampusChatPanelProps) {
  const [supabase] = useState(() => createClient());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationMembers, setConversationMembers] = useState<ConversationMember[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveChatView>('chat');
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupMemberUsername, setGroupMemberUsername] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingGroupChat, setIsCreatingGroupChat] = useState(false);
  const [isAddingGroupMember, setIsAddingGroupMember] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [hiddenConversationIds, setHiddenConversationIds] = useState<string[]>([]);
  const [hasLoadedHiddenConversationIds, setHasLoadedHiddenConversationIds] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedConversationIdRef = useRef<string | null>(null);
  const conversationIdsRef = useRef<string[]>([]);
  const refreshRequestIdRef = useRef(0);
  const groupCreationInFlightRef = useRef(false);
  const hiddenConversationStorageKey = `campus-chat-hidden-conversations:${userId}`;

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.user_id, profile])),
    [profiles]
  );

  const friendIds = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...friendships
              .map((entry) => getFriendId(entry, userId))
              .filter((friendId): friendId is string => Boolean(friendId)),
            ...friendRequests
              .filter((request) => request.status === 'accepted')
              .map((request) => (request.sender_id === userId ? request.receiver_id : request.sender_id))
              .filter((friendId) => friendId !== userId),
          ]
        )
      ),
    [friendRequests, friendships, userId]
  );

  const receivedRequests = useMemo(
    () => friendRequests.filter((request) => request.receiver_id === userId && request.status === 'pending'),
    [friendRequests, userId]
  );

  const sentRequests = useMemo(
    () => friendRequests.filter((request) => request.sender_id === userId && request.status === 'pending'),
    [friendRequests, userId]
  );

  const availableFriends = useMemo(
    () => friendIds.map((id) => profileMap.get(id)).filter((profile): profile is Profile => Boolean(profile)),
    [friendIds, profileMap]
  );

  const searchableProfiles = useMemo(() => {
    const lowered = normalizeUsernameSearch(searchTerm);
    return profiles.filter((profile) => {
      if (profile.user_id === userId) return false;
      if (friendIds.includes(profile.user_id)) return false;
      if (sentRequests.some((request) => request.receiver_id === profile.user_id)) return false;
      if (!lowered) return true;
      return profile.username.toLowerCase().includes(lowered) || profile.display_name.toLowerCase().includes(lowered);
    });
  }, [friendIds, profiles, searchTerm, sentRequests, userId]);

  const filteredFriends = useMemo(() => {
    const lowered = normalizeUsernameSearch(searchTerm);
    if (!lowered) return availableFriends;

    return availableFriends.filter((friend) =>
      friend.username.toLowerCase().includes(lowered) || friend.display_name.toLowerCase().includes(lowered)
    );
  }, [availableFriends, searchTerm]);

  const visibleConversations = useMemo(
    () =>
      conversations.filter((conversation) => {
        if (conversation.type === 'global') return true;
        if (hiddenConversationIds.includes(conversation.id)) return false;
        return conversationMembers.some(
          (member) => member.conversation_id === conversation.id && member.user_id === userId
        );
      }),
    [conversationMembers, conversations, hiddenConversationIds, userId]
  );

  const sortedConversations = useMemo(() => {
    return [...visibleConversations].sort((a, b) => {
      if (a.type === 'global') return -1;
      if (b.type === 'global') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [visibleConversations]);

  const selectedConversation = useMemo(
    () => visibleConversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [selectedConversationId, visibleConversations]
  );

  const unreadNotifications = notifications.filter((item) => !item.is_read).length;
  const canLeaveSelectedGroup = selectedConversation?.type === 'group';
  const canAddMembersToSelectedGroup = selectedConversation?.type === 'group';
  const canManageSelectedGroup = selectedConversation?.type === 'group' && selectedConversation.created_by === userId;
  const selectedGroupConversationId = selectedConversation?.type === 'group' ? selectedConversation.id : null;
  const selectedGroupMembers = useMemo(
    () =>
      selectedConversation?.type === 'group'
        ? conversationMembers
            .filter((member) => member.conversation_id === selectedConversation.id)
            .map((member) => profileMap.get(member.user_id))
            .filter((profile): profile is Profile => Boolean(profile))
        : [],
    [conversationMembers, profileMap, selectedConversation]
  );

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.type === 'global') return 'Global Campus Chat';
    if (conversation.type === 'group') return conversation.name || 'Study Group';

    const memberIds = conversationMembers
      .filter((member) => member.conversation_id === conversation.id && member.user_id !== userId)
      .map((member) => member.user_id);
    const otherProfile = profileMap.get(memberIds[0]);
    if (!otherProfile) return 'Private Chat';

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

  const addConversationMember = async (conversationId: string, memberId: string) => {
    const { error } = await supabase
      .from('conversation_members')
      .upsert(
        {
          conversation_id: conversationId,
          user_id: memberId,
        },
        {
          onConflict: 'conversation_id,user_id',
          ignoreDuplicates: true,
        }
      );

    if (error && !isDuplicateKeyError(error)) {
      console.error(`Failed to add member ${memberId} to conversation ${conversationId}:`, error.message);
      return { ok: false, message: error.message };
    }

    return { ok: true, message: null as string | null };
  };

  const loadMessages = async (conversationId: string) => {
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
    setMessages((data ?? []) as Message[]);
    return true;
  };

  const postSystemMessage = async (conversationId: string, message: string) => {
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: `${SYSTEM_MESSAGE_PREFIX}${message}`,
    });

    if (error) {
      console.error('Failed to post system message:', error.message);
    }
  };

  const ensureBaseRecords = async () => {
    const fallbackUsername = buildFallbackUsername(userEmail, userId);
    const existingProfile = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();

    if (!existingProfile.data) {
      const { error } = await supabase.from('profiles').insert({
        user_id: userId,
        username: fallbackUsername,
        display_name: userEmail.split('@')[0] || fallbackUsername,
        is_online: true,
      });
      if (error) {
        console.error('Failed to create profile:', error.message);
      }
    } else {
      await supabase
        .from('profiles')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('user_id', userId);
    }

    const globalConversationResult = await supabase
      .from('conversations')
      .select('*')
      .eq('slug', 'global-lobby')
      .maybeSingle();

    let globalConversation = globalConversationResult.data as Conversation | null;
    if (!globalConversation) {
      const { data, error } = await supabase.from('conversations').insert({
        type: 'global',
        name: 'Global Campus Chat',
        slug: 'global-lobby',
        created_by: userId,
      }).select().single();

      if (error) {
        console.error('Failed to create global conversation:', error.message);
      } else {
        globalConversation = data as Conversation;
      }
    }

    if (globalConversation) {
      const inserted = await addConversationMember(globalConversation.id, userId);
      if (!inserted) {
        console.error('Failed to join global conversation.');
      }
    }
  };

  async function ensureDirectConversation(otherUserId: string) {
    const pairKey = [userId, otherUserId].sort().join(':');
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

    let conversation = existing.data as Conversation | null;
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

        conversation = retryLookup.data as Conversation | null;
      }
    }

    if (!conversation) return null;

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

  async function ensureDirectConversationsForAcceptedFriends(requests: FriendRequest[]) {
    const acceptedFriendIds = Array.from(
      new Set(
        requests
          .filter((request) => request.status === 'accepted')
          .map((request) => (request.sender_id === userId ? request.receiver_id : request.sender_id))
          .filter((friendId) => friendId !== userId)
      )
    );

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
    } else {
      setIsRefreshing(true);
    }

    await ensureBaseRecords();

    const [
      profilesResult,
      requestResult,
      friendshipsResult,
      notificationsResult,
      globalConversationResult,
    ] = await Promise.all([
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
      supabase.from('conversations').select('*').eq('slug', 'global-lobby').maybeSingle(),
    ]);

    if (profilesResult.data) setProfiles(profilesResult.data as Profile[]);
    const requestRows = (requestResult.data ?? []) as FriendRequest[];
    setFriendRequests(requestRows);
    if (friendshipsResult.data) setFriendships(friendshipsResult.data as Friendship[]);
    if (notificationsResult.data) setNotifications(notificationsResult.data as NotificationItem[]);
    await ensureDirectConversationsForAcceptedFriends(requestRows);

    const membersResult = await supabase.from('conversation_members').select('*').eq('user_id', userId);
    if (refreshRequestIdRef.current !== requestId) return;

    const memberRows = (membersResult.data ?? []) as ConversationMember[];
    const conversationIds = new Set(memberRows.map((member) => member.conversation_id));
    const globalConversation = globalConversationResult.data as Conversation | null;
    if (globalConversation) conversationIds.add(globalConversation.id);

    let loadedConversations: Conversation[] = [];
    if (conversationIds.size > 0) {
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .in('id', Array.from(conversationIds));
      loadedConversations = (data ?? []) as Conversation[];
    }

    const allConversationIds = loadedConversations.map((conversation) => conversation.id);
    let allMembers: ConversationMember[] = memberRows;
    if (allConversationIds.length > 0) {
      const { data } = await supabase
        .from('conversation_members')
        .select('*')
        .in('conversation_id', allConversationIds);
      allMembers = (data ?? []) as ConversationMember[];
    }
    if (refreshRequestIdRef.current !== requestId) return;

    setConversationMembers(allMembers);
    setConversations(loadedConversations);

    const visibleConversationIds = new Set(
      loadedConversations
        .filter((conversation) => {
          if (conversation.type === 'global') return true;
          return allMembers.some(
            (member) => member.conversation_id === conversation.id && member.user_id === userId
          );
        })
        .map((conversation) => conversation.id)
    );

    const currentSelectedConversationId = selectedConversationIdRef.current;
    const nextSelectedConversationId =
      currentSelectedConversationId && visibleConversationIds.has(currentSelectedConversationId)
        ? currentSelectedConversationId
        : globalConversation?.id ??
          loadedConversations.find((conversation) => visibleConversationIds.has(conversation.id))?.id ??
          null;

    setSelectedConversationId(nextSelectedConversationId);

    if (nextSelectedConversationId) {
      await loadMessages(nextSelectedConversationId);
    } else if (shouldShowSkeleton) {
      setMessages([]);
    }

    if (refreshRequestIdRef.current !== requestId) return;

    setLoading(false);
    setIsRefreshing(false);
  };

  const refreshChatDataEvent = useEffectEvent(() => {
    void refreshChatData();
  });

  const loadMessagesEvent = useEffectEvent((conversationId: string) => {
    void loadMessages(conversationId);
  });

  useEffect(() => {
    refreshChatDataEvent();

    return () => {
      void supabase
        .from('profiles')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('user_id', userId);
    };
  }, [supabase, userEmail, userId]);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(hiddenConversationStorageKey);
    if (!storedValue) {
      setHasLoadedHiddenConversationIds(true);
      return;
    }

    try {
      const parsedValue = JSON.parse(storedValue) as string[];
      if (Array.isArray(parsedValue)) {
        setHiddenConversationIds(parsedValue);
      }
    } catch {
      window.localStorage.removeItem(hiddenConversationStorageKey);
    } finally {
      setHasLoadedHiddenConversationIds(true);
    }
  }, [hiddenConversationStorageKey]);

  useEffect(() => {
    if (!hasLoadedHiddenConversationIds) return;
    window.localStorage.setItem(hiddenConversationStorageKey, JSON.stringify(hiddenConversationIds));
  }, [hasLoadedHiddenConversationIds, hiddenConversationIds, hiddenConversationStorageKey]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
    conversationIdsRef.current = conversations.map((conversation) => conversation.id);
    if (!selectedConversationId) return;
    loadMessagesEvent(selectedConversationId);
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    if (visibleConversations.some((conversation) => conversation.id === selectedConversationId)) return;

    const fallbackConversationId =
      visibleConversations.find((conversation) => conversation.type === 'global')?.id ??
      visibleConversations[0]?.id ??
      null;

    setSelectedConversationId(fallbackConversationId);
  }, [selectedConversationId, visibleConversations]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  useEffect(() => {
    if (!selectedConversationId) return;

    loadMessagesEvent(selectedConversationId);
    const intervalId = window.setInterval(() => {
      loadMessagesEvent(selectedConversationId);
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedGroupConversationId) return;

    const intervalId = window.setInterval(() => {
      refreshChatDataEvent();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedGroupConversationId]);

  const handleProfileChange = useEffectEvent((payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
    const nextProfile = payload.new as Profile | null;
    const previousProfile = payload.old as Profile | null;
    const targetUserId = nextProfile?.user_id ?? previousProfile?.user_id;

    if (!targetUserId) return;

    if (payload.eventType === 'DELETE') {
      setProfiles((prev) => prev.filter((profile) => profile.user_id !== targetUserId));
      return;
    }

    if (!nextProfile) return;
    setProfiles((prev) => upsertByKey(prev, nextProfile, (profile) => profile.user_id));
  });

  const handleFriendRequestChange = useEffectEvent(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const nextRequest = payload.new as FriendRequest | null;
      const previousRequest = payload.old as FriendRequest | null;
      const targetRequest = nextRequest ?? previousRequest;

      if (!targetRequest) return;
      if (targetRequest.sender_id !== userId && targetRequest.receiver_id !== userId) return;

      if (payload.eventType === 'DELETE') {
        setFriendRequests((prev) => prev.filter((request) => request.id !== targetRequest.id));
      } else if (nextRequest) {
        setFriendRequests((prev) => upsertByKey(prev, nextRequest, (request) => request.id));
      }

      void refreshChatData();
    }
  );

  const handleFriendshipChange = useEffectEvent((payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
    const nextFriendship = payload.new as Friendship | null;
    const previousFriendship = payload.old as Friendship | null;
    const targetFriendship = nextFriendship ?? previousFriendship;

    if (!targetFriendship) return;
    if (targetFriendship.user_id !== userId && targetFriendship.friend_id !== userId) return;

    if (payload.eventType === 'DELETE') {
      setFriendships((prev) =>
        prev.filter(
          (entry) =>
            !(
              entry.user_id === targetFriendship.user_id &&
              entry.friend_id === targetFriendship.friend_id
            )
        )
      );
    } else if (nextFriendship) {
      setFriendships((prev) => {
        const exists = prev.some(
          (entry) =>
            entry.user_id === nextFriendship.user_id && entry.friend_id === nextFriendship.friend_id
        );

        return exists ? prev : [nextFriendship, ...prev];
      });
    }

    void refreshChatData();
  });

  const handleNotificationChange = useEffectEvent(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const nextNotification = payload.new as NotificationItem | null;
      const previousNotification = payload.old as NotificationItem | null;
      const targetNotification = nextNotification ?? previousNotification;

      if (!targetNotification || targetNotification.user_id !== userId) return;

      if (payload.eventType === 'DELETE') {
        setNotifications((prev) => prev.filter((notification) => notification.id !== targetNotification.id));
        return;
      }

      if (!nextNotification) return;
      setNotifications((prev) => upsertByKey(prev, nextNotification, (notification) => notification.id));

      if (
        payload.eventType === 'INSERT' &&
        (nextNotification.type === 'group_invite' || nextNotification.type === 'friend_accept')
      ) {
        void refreshChatData();
      }
    }
  );

  const handleConversationStructureChange = useEffectEvent(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const nextRow = payload.new as { conversation_id?: string; id?: string; created_by?: string | null } | null;
      const previousRow = payload.old as { conversation_id?: string; id?: string; created_by?: string | null } | null;
      const conversationId = nextRow?.conversation_id ?? nextRow?.id ?? previousRow?.conversation_id ?? previousRow?.id;

      if (!conversationId) return;
      const isKnownConversation = conversationIdsRef.current.includes(conversationId);
      const isCreatedByCurrentUser = nextRow?.created_by === userId || previousRow?.created_by === userId;

      if (!isKnownConversation && !isCreatedByCurrentUser) {
        const memberUserId = nextRow && 'user_id' in nextRow ? String(nextRow.user_id ?? '') : '';
        const oldMemberUserId = previousRow && 'user_id' in previousRow ? String(previousRow.user_id ?? '') : '';
        if (memberUserId !== userId && oldMemberUserId !== userId) return;
      }

      void refreshChatData();
    }
  );

  const handleConversationMemberChange = useEffectEvent(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const nextMember = payload.new as ConversationMember | null;
      const previousMember = payload.old as ConversationMember | null;
      const targetMember = nextMember ?? previousMember;

      if (!targetMember) return;

      const conversationId = targetMember.conversation_id;
      const memberUserId = targetMember.user_id;
      const isSelectedGroup = selectedConversationIdRef.current === conversationId;
      const affectsKnownConversation = conversationIdsRef.current.includes(conversationId);
      const affectsCurrentUserMembership = memberUserId === userId;

      if (!affectsKnownConversation && !affectsCurrentUserMembership) {
        return;
      }

      if (payload.eventType === 'DELETE') {
        setConversationMembers((prev) =>
          prev.filter(
            (member) =>
              !(member.conversation_id === conversationId && member.user_id === memberUserId)
          )
        );

        if (affectsCurrentUserMembership) {
          setConversations((prev) => prev.filter((conversation) => conversation.id !== conversationId));
          setMessages((prev) => (isSelectedGroup ? [] : prev));

          if (isSelectedGroup) {
            const fallbackConversationId =
              conversations
                .filter((conversation) => conversation.id !== conversationId)
                .find((conversation) => conversation.type === 'global')?.id ??
              conversations.find((conversation) => conversation.id !== conversationId)?.id ??
              null;

            setSelectedConversationId(fallbackConversationId);
          }
        }

        if (isSelectedGroup) {
          void refreshChatData();
        }
        return;
      }

      if (!nextMember) return;

      setConversationMembers((prev) =>
        upsertByKey(prev, nextMember, (member) => `${member.conversation_id}:${member.user_id}`)
      );

      if (affectsCurrentUserMembership || isSelectedGroup) {
        void refreshChatData();
      }
    }
  );

  const handleMessageChange = useEffectEvent((payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
    const nextMessage = payload.new as Message | null;
    const previousMessage = payload.old as Message | null;
    const targetMessage = nextMessage ?? previousMessage;

    if (!targetMessage) return;
    if (!conversationIdsRef.current.includes(targetMessage.conversation_id)) return;

    if (selectedConversationIdRef.current === targetMessage.conversation_id) {
      if (payload.eventType === 'DELETE') {
        setMessages((prev) => prev.filter((message) => message.id !== targetMessage.id));
      } else if (nextMessage) {
        setMessages((prev) => sortMessagesByCreatedAt(upsertByKey(prev, nextMessage, (message) => message.id)));
      }
    }

    if (payload.eventType === 'INSERT') {
      setConversations((prev) => {
        const current = prev.find((conversation) => conversation.id === targetMessage.conversation_id);
        if (!current) return prev;

        return [
          {
            ...current,
            created_at: targetMessage.created_at,
          },
          ...prev.filter((conversation) => conversation.id !== current.id),
        ];
      });
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

  const sendFriendRequest = async (receiverId: string) => {
    const receiverProfile = profileMap.get(receiverId);
    if (!receiverProfile) return;

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

  const acceptFriendRequest = async (request: FriendRequest) => {
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

    setFriendRequests((prev) =>
      prev.map((item) =>
        item.id === request.id
          ? {
              ...item,
              status: 'accepted',
            }
          : item
      )
    );
    setFriendships((prev) => {
      const alreadyExists = prev.some(
        (item) =>
          (item.user_id === request.receiver_id && item.friend_id === request.sender_id) ||
          (item.user_id === request.sender_id && item.friend_id === request.receiver_id)
      );

      if (alreadyExists) return prev;

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

  const rejectFriendRequest = async (requestId: string) => {
    setChatError(null);
    await supabase.from('friend_requests').update({ status: 'rejected' }).eq('id', requestId);
    await refreshChatData();
  };

  const openDirectChat = async (friendId: string) => {
    setChatError(null);
    const conversation = await ensureDirectConversation(friendId);
    await refreshChatData();
    if (conversation) {
      setActiveView('chat');
      setSelectedConversationId(conversation.id);
    } else {
      setChatError("Couldn't open the private chat yet. Try again in a moment.");
    }
  };

  const createGroupChat = async () => {
    if (groupCreationInFlightRef.current) return;

    const trimmedGroupName = groupName.trim();
    setChatError(null);

    if (!trimmedGroupName) {
      setChatError('Give the group a name before creating it.');
      return;
    }

    if (selectedFriendIds.length === 0) {
      setChatError('Choose at least one friend for the group.');
      return;
    }

    groupCreationInFlightRef.current = true;
    setIsCreatingGroupChat(true);

    try {
      const conversationId = crypto.randomUUID();
      const { error: conversationInsertError } = await supabase
        .from('conversations')
        .insert({
          id: conversationId,
          type: 'group',
          name: trimmedGroupName,
          created_by: userId,
        });

      if (conversationInsertError) {
        setChatError(`Couldn't create the group: ${conversationInsertError.message}`);
        return;
      }

      const conversation: Conversation = {
        id: conversationId,
        type: 'group',
        name: trimmedGroupName,
        slug: null,
        direct_pair_key: null,
        created_by: userId,
        created_at: new Date().toISOString(),
      };

      const uniqueMembers = Array.from(new Set([userId, ...selectedFriendIds]));
      for (const memberId of uniqueMembers) {
        const added = await addConversationMember(conversation.id, memberId);
        if (!added.ok) {
          setChatError(
            memberId === userId
              ? `The group was created, but you could not be joined to it: ${added.message || 'unknown error'}.`
              : `The group was created, but a member could not be added: ${added.message || 'unknown error'}.`
          );
          return;
        }
      }

      await postSystemMessage(conversation.id, `${getCurrentUserLabel()} created the group.`);

      if (selectedFriendIds.length > 0) {
        await supabase.from('notifications').insert(
          selectedFriendIds.map((memberId) => ({
            user_id: memberId,
            type: 'group_invite',
            title: 'Added to a group chat',
            body: `${profileMap.get(userId)?.display_name || userEmail} added you to "${trimmedGroupName}".`,
            payload: { conversation_id: conversation.id },
          }))
        );
      }

      setGroupName('');
      setSelectedFriendIds([]);
      setIsCreatingGroup(false);
      await refreshChatData();
      setActiveView('chat');
      setSelectedConversationId(conversation.id);
    } finally {
      groupCreationInFlightRef.current = false;
      setIsCreatingGroupChat(false);
    }
  };

  const leaveSelectedGroup = async () => {
    if (!selectedConversation || selectedConversation.type !== 'group' || isLeavingGroup) return;

    setChatError(null);
    setIsLeavingGroup(true);

    const conversationId = selectedConversation.id;
    const remainingConversations = conversations.filter((conversation) => conversation.id !== conversationId);
    const fallbackConversationId =
      remainingConversations.find((conversation) => conversation.type === 'global')?.id ??
      remainingConversations[0]?.id ??
      null;

    setHiddenConversationIds((prev) => (prev.includes(conversationId) ? prev : [...prev, conversationId]));
    setConversations(remainingConversations);
    setConversationMembers((prev) => prev.filter((member) => member.conversation_id !== conversationId || member.user_id !== userId));
    setMessages((prev) => (selectedConversationIdRef.current === conversationId ? [] : prev));
    if (selectedConversationIdRef.current === conversationId) {
      setSelectedConversationId(fallbackConversationId);
    }

    await postSystemMessage(conversationId, `${getCurrentUserLabel()} left the group.`);

    const { error } = await supabase
      .from('conversation_members')
      .delete()
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
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (verifyDeleteError && !isNoRowsError(verifyDeleteError)) {
      setChatError(`Group leave verification failed: ${verifyDeleteError.message}`);
      await refreshChatData();
      setIsLeavingGroup(false);
      return;
    }

    if (membershipAfterDelete) {
      setChatError("Couldn't leave the group because your membership record still exists.");
      await refreshChatData();
      setIsLeavingGroup(false);
      return;
    }

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

    const targetProfile =
      profiles.find((profile) => profile.username.toLowerCase() === trimmedUsername) ?? null;

    if (!targetProfile) {
      setChatError(`No user found with username "${trimmedUsername}".`);
      return;
    }

    if (targetProfile.user_id === userId) {
      setChatError('You are already part of this group.');
      return;
    }

    const isAlreadyMember = conversationMembers.some(
      (member) =>
        member.conversation_id === selectedConversation.id && member.user_id === targetProfile.user_id
    );

    if (isAlreadyMember) {
      setChatError(`@${targetProfile.username} is already in this group.`);
      return;
    }

    setIsAddingGroupMember(true);

    try {
      const added = await addConversationMember(selectedConversation.id, targetProfile.user_id);
      if (!added) {
        setChatError(`Couldn't add @${targetProfile.username} to the group.`);
        return;
      }

      await supabase.from('notifications').insert({
        user_id: targetProfile.user_id,
        type: 'group_invite',
        title: 'Added to a group chat',
        body: `${profileMap.get(userId)?.display_name || userEmail} added you to "${selectedConversation.name || 'a group chat'}".`,
        payload: { conversation_id: selectedConversation.id },
      });

      await postSystemMessage(
        selectedConversation.id,
        `${getCurrentUserLabel()} added ${getProfileHeading(targetProfile)} (@${targetProfile.username}).`
      );

      setGroupMemberUsername('');
      await refreshChatData();
    } finally {
      setIsAddingGroupMember(false);
    }
  };

  const removeMemberFromSelectedGroup = async (targetProfile: Profile) => {
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
      .delete()
      .eq('conversation_id', selectedConversation.id)
      .eq('user_id', targetProfile.user_id);

    if (error) {
      setChatError(`Couldn't remove @${targetProfile.username}: ${error.message}`);
      return;
    }

    await postSystemMessage(
      selectedConversation.id,
      `${getCurrentUserLabel()} removed ${getProfileHeading(targetProfile)} (@${targetProfile.username}) from the group.`
    );
    await refreshChatData();
  };

  const sendMessage = async () => {
    const trimmedMessage = newMessage.trim();
    setChatError(null);

    if (!selectedConversationId) {
      setChatError('Wait for a conversation to finish loading, then try again.');
      return;
    }

    if (!trimmedMessage) return;

    setIsSending(true);
    const optimisticMessage: Message = {
      id: `temp-${crypto.randomUUID()}`,
      conversation_id: selectedConversationId,
      sender_id: userId,
      content: trimmedMessage,
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
      setMessages((prev) =>
        sortMessagesByCreatedAt(
          upsertByKey(
            prev.map((message) => (message.id === optimisticMessage.id ? (data as Message) : message)),
            data as Message,
            (message) => message.id
          )
        )
      );
    }

    setIsSending(false);
  };

  const markNotificationRead = async (notification: NotificationItem) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);

    const conversationId = notification.payload?.conversation_id;
    if (conversationId) {
      setSelectedConversationId(conversationId);
      setActiveView('chat');
    }

    await refreshChatData();
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <CampusChatSidebar
        activeView={activeView}
        availableFriends={availableFriends}
        createGroupChat={createGroupChat}
        getConversationTitle={getConversationTitle}
        groupName={groupName}
        isCreatingGroup={isCreatingGroup}
        isCreatingGroupChat={isCreatingGroupChat}
        receivedRequestsCount={receivedRequests.length}
        selectedConversationId={selectedConversationId}
        selectedFriendIds={selectedFriendIds}
        setActiveView={setActiveView}
        setGroupName={setGroupName}
        setIsCreatingGroup={setIsCreatingGroup}
        setSelectedConversationId={setSelectedConversationId}
        setSelectedFriendIds={setSelectedFriendIds}
        sortedConversations={sortedConversations}
        unreadNotifications={unreadNotifications}
      />

      <div className="campus-panel-strong rounded-[1.9rem] p-4">
        {activeView === 'chat' ? (
          <ChatViewPanel
            addMemberToSelectedGroup={addMemberToSelectedGroup}
            canAddMembersToSelectedGroup={canAddMembersToSelectedGroup}
            canLeaveSelectedGroup={canLeaveSelectedGroup}
            canManageSelectedGroup={canManageSelectedGroup}
            chatError={chatError}
            getConversationTitle={getConversationTitle}
            groupMemberUsername={groupMemberUsername}
            isAddingGroupMember={isAddingGroupMember}
            isLeavingGroup={isLeavingGroup}
            isRefreshing={isRefreshing}
            isSending={isSending}
            leaveSelectedGroup={leaveSelectedGroup}
            loading={loading}
            messages={messages}
            messagesContainerRef={messagesContainerRef}
            newMessage={newMessage}
            profileMap={profileMap}
            removeMemberFromSelectedGroup={removeMemberFromSelectedGroup}
            selectedConversation={selectedConversation}
            selectedConversationId={selectedConversationId}
            selectedGroupMembers={selectedGroupMembers}
            sendMessage={sendMessage}
            setGroupMemberUsername={setGroupMemberUsername}
            setNewMessage={setNewMessage}
            userId={userId}
          />
        ) : null}

        {activeView === 'friends' ? (
          <FriendsViewPanel
            availableFriends={availableFriends}
            filteredFriends={filteredFriends}
            openDirectChat={openDirectChat}
            searchTerm={searchTerm}
            searchableProfiles={searchableProfiles}
            sendFriendRequest={sendFriendRequest}
            setSearchTerm={setSearchTerm}
          />
        ) : null}

        {activeView === 'requests' ? (
          <RequestsViewPanel
            acceptFriendRequest={acceptFriendRequest}
            profileMap={profileMap}
            receivedRequests={receivedRequests}
            rejectFriendRequest={rejectFriendRequest}
            sentRequests={sentRequests}
          />
        ) : null}

        {activeView === 'notifications' ? (
          <NotificationsViewPanel
            markNotificationRead={markNotificationRead}
            notifications={notifications}
          />
        ) : null}
      </div>
    </div>
  );
}
