'use client';

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Profile = {
  user_id: string;
  username: string;
  display_name: string;
  is_online: boolean;
  last_seen: string;
};

type FriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
};

type Friendship = {
  user_id: string;
  friend_id: string;
};

type Conversation = {
  id: string;
  type: 'global' | 'direct' | 'group';
  name: string | null;
  slug: string | null;
  direct_pair_key: string | null;
  created_by: string | null;
  created_at: string;
};

type ConversationMember = {
  conversation_id: string;
  user_id: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type NotificationItem = {
  id: string;
  user_id: string;
  type: 'friend_request' | 'friend_accept' | 'group_invite';
  title: string;
  body: string;
  payload: Record<string, string>;
  is_read: boolean;
  created_at: string;
};

type SupabaseErrorLike = {
  code?: string;
  message: string;
};

type CampusChatPanelProps = {
  userId: string;
  userEmail: string;
};

const POLL_INTERVAL_MS = 5000;

function buildFallbackUsername(email: string, userId: string) {
  const base = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'student';
  return `${base}-${userId.slice(0, 4)}`;
}

function isDuplicateKeyError(error: SupabaseErrorLike | null) {
  return error?.code === '23505';
}

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
  const [activeView, setActiveView] = useState<'chat' | 'friends' | 'requests' | 'notifications'>('chat');
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [groupName, setGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const selectedConversationIdRef = useRef<string | null>(null);

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.user_id, profile])),
    [profiles]
  );

  const friendIds = useMemo(
    () => friendships.filter((entry) => entry.user_id === userId).map((entry) => entry.friend_id),
    [friendships, userId]
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
    const lowered = searchTerm.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (profile.user_id === userId) return false;
      if (friendIds.includes(profile.user_id)) return false;
      if (sentRequests.some((request) => request.receiver_id === profile.user_id)) return false;
      if (!lowered) return true;
      return profile.username.toLowerCase().includes(lowered) || profile.display_name.toLowerCase().includes(lowered);
    });
  }, [friendIds, profiles, searchTerm, sentRequests, userId]);

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      if (a.type === 'global') return -1;
      if (b.type === 'global') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [conversations]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const unreadNotifications = notifications.filter((item) => !item.is_read).length;

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.type === 'global') return 'Global Campus Chat';
    if (conversation.type === 'group') return conversation.name || 'Study Group';

    const memberIds = conversationMembers
      .filter((member) => member.conversation_id === conversation.id && member.user_id !== userId)
      .map((member) => member.user_id);
    const otherProfile = profileMap.get(memberIds[0]);
    return otherProfile?.display_name || otherProfile?.username || 'Private Chat';
  };

  const addConversationMember = async (conversationId: string, memberId: string) => {
    const { error } = await supabase.from('conversation_members').insert({
      conversation_id: conversationId,
      user_id: memberId,
    });

    if (error && !isDuplicateKeyError(error)) {
      console.error(`Failed to add member ${memberId} to conversation ${conversationId}:`, error.message);
      return false;
    }

    return true;
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
      return;
    }

    setMessages((data ?? []) as Message[]);
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

  const refreshChatData = async () => {
    setLoading(true);
    await ensureBaseRecords();

    const [
      profilesResult,
      requestResult,
      friendshipsResult,
      notificationsResult,
      membersResult,
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
      supabase.from('conversation_members').select('*').eq('user_id', userId),
      supabase.from('conversations').select('*').eq('slug', 'global-lobby').maybeSingle(),
    ]);

    if (profilesResult.data) setProfiles(profilesResult.data as Profile[]);
    if (requestResult.data) setFriendRequests(requestResult.data as FriendRequest[]);
    if (friendshipsResult.data) setFriendships(friendshipsResult.data as Friendship[]);
    if (notificationsResult.data) setNotifications(notificationsResult.data as NotificationItem[]);

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

    setConversationMembers(allMembers);
    setConversations(loadedConversations);

    const currentSelectedConversationId = selectedConversationIdRef.current;
    const nextSelectedConversationId =
      currentSelectedConversationId && loadedConversations.some((conversation) => conversation.id === currentSelectedConversationId)
        ? currentSelectedConversationId
        : globalConversation?.id ?? loadedConversations[0]?.id ?? null;

    setSelectedConversationId(nextSelectedConversationId);

    if (nextSelectedConversationId) {
      await loadMessages(nextSelectedConversationId);
    } else {
      setMessages([]);
    }

    setLoading(false);
  };

  const refreshChatDataEvent = useEffectEvent(() => {
    void refreshChatData();
  });

  const loadMessagesEvent = useEffectEvent((conversationId: string) => {
    void loadMessages(conversationId);
  });

  useEffect(() => {
    refreshChatDataEvent();

    const intervalId = window.setInterval(() => {
      refreshChatDataEvent();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      void supabase
        .from('profiles')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('user_id', userId);
    };
  }, [supabase, userEmail, userId]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
    if (!selectedConversationId) return;
    loadMessagesEvent(selectedConversationId);
  }, [selectedConversationId]);

  const sendFriendRequest = async (receiverId: string) => {
    const receiverProfile = profileMap.get(receiverId);
    if (!receiverProfile) return;

    await supabase.from('friend_requests').insert({
      sender_id: userId,
      receiver_id: receiverId,
      status: 'pending',
    });

    await supabase.from('notifications').insert({
      user_id: receiverId,
      type: 'friend_request',
      title: 'New friend request',
      body: `${profileMap.get(userId)?.display_name || userEmail} sent you a friend request.`,
      payload: { sender_id: userId, sender_username: profileMap.get(userId)?.username || userEmail },
    });

    await refreshChatData();
  };

  const ensureDirectConversation = async (otherUserId: string) => {
    const pairKey = [userId, otherUserId].sort().join(':');

    const existing = await supabase
      .from('conversations')
      .select('*')
      .eq('direct_pair_key', pairKey)
      .maybeSingle();

    let conversation = existing.data as Conversation | null;
    if (!conversation) {
      const insertResult = await supabase
        .from('conversations')
        .insert({
          type: 'direct',
          direct_pair_key: pairKey,
          created_by: userId,
        })
        .select()
        .single();
      conversation = insertResult.data as Conversation | null;
    }

    if (!conversation) return null;

    const currentUserAdded = await addConversationMember(conversation.id, userId);
    const otherUserAdded = await addConversationMember(conversation.id, otherUserId);

    if (!currentUserAdded || !otherUserAdded) {
      return null;
    }

    return conversation;
  };

  const acceptFriendRequest = async (request: FriendRequest) => {
    await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', request.id);

    await supabase.from('friendships').upsert([
      { user_id: request.sender_id, friend_id: request.receiver_id },
      { user_id: request.receiver_id, friend_id: request.sender_id },
    ]);

    const directConversation = await ensureDirectConversation(request.sender_id);

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

    await refreshChatData();

    if (directConversation) {
      setActiveView('chat');
      setSelectedConversationId(directConversation.id);
    }
  };

  const rejectFriendRequest = async (requestId: string) => {
    await supabase.from('friend_requests').update({ status: 'rejected' }).eq('id', requestId);
    await refreshChatData();
  };

  const openDirectChat = async (friendId: string) => {
    const conversation = await ensureDirectConversation(friendId);
    await refreshChatData();
    if (conversation) {
      setActiveView('chat');
      setSelectedConversationId(conversation.id);
    }
  };

  const createGroupChat = async () => {
    if (!groupName.trim() || selectedFriendIds.length === 0) return;

    const conversationResult = await supabase
      .from('conversations')
      .insert({
        type: 'group',
        name: groupName.trim(),
        created_by: userId,
      })
      .select()
      .single();

    const conversation = conversationResult.data as Conversation | null;
    if (!conversation) return;

    const uniqueMembers = Array.from(new Set([userId, ...selectedFriendIds]));
    await supabase.from('conversation_members').insert(
      uniqueMembers.map((memberId) => ({
        conversation_id: conversation.id,
        user_id: memberId,
      }))
    );

    if (selectedFriendIds.length > 0) {
      await supabase.from('notifications').insert(
        selectedFriendIds.map((memberId) => ({
          user_id: memberId,
          type: 'group_invite',
          title: 'Added to a group chat',
          body: `${profileMap.get(userId)?.display_name || userEmail} added you to "${groupName.trim()}".`,
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

    const { error } = await supabase.from('messages').insert({
      conversation_id: selectedConversationId,
      sender_id: userId,
      content: trimmedMessage,
    });

    if (error) {
      console.error('Failed to send message:', error.message);
      setChatError(`Couldn't send message: ${error.message}`);
      setIsSending(false);
      return;
    }

    setNewMessage('');
    await loadMessages(selectedConversationId);
    setIsSending(false);
  };

  const markNotificationRead = async (notificationId: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
    await refreshChatData();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200/70">Campus Chat</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { key: 'chat', label: 'Chats' },
              { key: 'friends', label: 'Friends' },
              { key: 'requests', label: `Requests (${receivedRequests.length})` },
              { key: 'notifications', label: `Alerts (${unreadNotifications})` },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key as typeof activeView)}
                className={`rounded-xl px-3 py-2 text-sm transition ${activeView === item.key ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-white font-semibold">Conversations</h3>
            <button
              onClick={() => setIsCreatingGroup((value) => !value)}
              className="rounded-lg bg-white/10 px-3 py-1 text-xs text-white"
            >
              {isCreatingGroup ? 'Close' : 'New Group'}
            </button>
          </div>

          {isCreatingGroup && (
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Group name"
                className="mb-3 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/40"
              />
              <div className="max-h-32 space-y-2 overflow-y-auto">
                {availableFriends.map((friend) => (
                  <label key={friend.user_id} className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={selectedFriendIds.includes(friend.user_id)}
                      onChange={(event) => {
                        setSelectedFriendIds((prev) =>
                          event.target.checked
                            ? [...prev, friend.user_id]
                            : prev.filter((id) => id !== friend.user_id)
                        );
                      }}
                    />
                    <span>{friend.display_name}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={() => void createGroupChat()}
                className="mt-3 w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-3 py-2 text-sm font-medium text-white"
              >
                Create Group
              </button>
            </div>
          )}

          <div className="space-y-2">
            {sortedConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => {
                  setSelectedConversationId(conversation.id);
                  setActiveView('chat');
                }}
                className={`w-full rounded-xl px-3 py-3 text-left transition ${selectedConversationId === conversation.id ? 'bg-white/15 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}
              >
                <div className="font-medium">{getConversationTitle(conversation)}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-cyan-200/70">{conversation.type}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        {activeView === 'chat' && (
          <div className="flex h-[70vh] flex-col">
            <div className="border-b border-white/10 pb-3">
              <h3 className="text-xl font-semibold text-white">
                {selectedConversation ? getConversationTitle(selectedConversation) : 'Campus Chat'}
              </h3>
              <p className="text-sm text-white/50">
                {selectedConversation?.type === 'global'
                  ? 'A shared public space for everyone signed into the platform.'
                  : selectedConversation?.type === 'group'
                    ? 'Group discussion with selected members.'
                    : 'Private conversation between friends.'}
              </p>
              {chatError ? (
                <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  {chatError}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
              {loading ? (
                <div className="text-white/60">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50">
                  Start the conversation.
                </div>
              ) : (
                messages.map((message) => {
                  const sender = profileMap.get(message.sender_id);
                  const isOwn = message.sender_id === userId;
                  return (
                    <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${isOwn ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white' : 'bg-white/10 text-white'}`}>
                        <div className="mb-1 text-xs uppercase tracking-[0.2em] text-white/60">
                          {sender?.display_name || sender?.username || 'Student'}
                        </div>
                        <div className="whitespace-pre-wrap text-sm leading-6">{message.content}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 flex gap-3 border-t border-white/10 pt-4">
              <input
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Write a message..."
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40"
              />
              <button
                onClick={() => void sendMessage()}
                disabled={isSending || !selectedConversationId || !newMessage.trim()}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        )}

        {activeView === 'friends' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-white">Find People</h3>
              <p className="text-sm text-white/50">Search by username to send a friend request.</p>
            </div>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search username"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40"
            />
            <div className="grid gap-3 md:grid-cols-2">
              {searchableProfiles.map((profile) => (
                <div key={profile.user_id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="font-medium text-white">{profile.display_name}</div>
                  <div className="text-sm text-cyan-200/80">@{profile.username}</div>
                  <button
                    onClick={() => void sendFriendRequest(profile.user_id)}
                    className="mt-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-2 text-sm font-medium text-white"
                  >
                    Add Friend
                  </button>
                </div>
              ))}
            </div>

            <div>
              <h4 className="mb-3 text-white font-semibold">Your Friends</h4>
              <div className="space-y-3">
                {availableFriends.map((friend) => (
                  <div key={friend.user_id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
                    <div>
                      <div className="font-medium text-white">{friend.display_name}</div>
                      <div className="text-sm text-white/60">
                        @{friend.username} {friend.is_online ? '• Online' : '• Offline'}
                      </div>
                    </div>
                    <button
                      onClick={() => void openDirectChat(friend.user_id)}
                      className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white"
                    >
                      Message
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeView === 'requests' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-white">Friend Requests</h3>
              <p className="text-sm text-white/50">Accept requests to unlock direct messaging.</p>
            </div>

            <div className="space-y-3">
              {receivedRequests.map((request) => {
                const sender = profileMap.get(request.sender_id);
                return (
                  <div key={request.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="font-medium text-white">{sender?.display_name || sender?.username || 'Student'}</div>
                    <div className="text-sm text-white/60">@{sender?.username || 'unknown'}</div>
                    <div className="mt-3 flex gap-3">
                      <button onClick={() => void acceptFriendRequest(request)} className="rounded-lg bg-green-500 px-4 py-2 text-sm text-white">Accept</button>
                      <button onClick={() => void rejectFriendRequest(request.id)} className="rounded-lg bg-red-500/80 px-4 py-2 text-sm text-white">Reject</button>
                    </div>
                  </div>
                );
              })}
              {receivedRequests.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50">
                  No pending requests.
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-3 text-white font-semibold">Sent Requests</h4>
              <div className="space-y-3">
                {sentRequests.map((request) => {
                  const receiver = profileMap.get(request.receiver_id);
                  return (
                    <div key={request.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/80">
                      Waiting for {receiver?.display_name || receiver?.username || 'student'} to accept.
                    </div>
                  );
                })}
                {sentRequests.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50">
                    No outgoing requests.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeView === 'notifications' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-white">Notifications</h3>
              <p className="text-sm text-white/50">Friend requests, accepts, and group chat updates.</p>
            </div>
            <div className="space-y-3">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => void markNotificationRead(notification.id)}
                  className={`w-full rounded-xl border p-4 text-left ${notification.is_read ? 'border-white/10 bg-white/5 text-white/70' : 'border-cyan-400/40 bg-cyan-500/10 text-white'}`}
                >
                  <div className="font-medium">{notification.title}</div>
                  <div className="mt-1 text-sm opacity-80">{notification.body}</div>
                </button>
              ))}
              {notifications.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50">
                  No notifications yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
