'use client';

import {
  getProfileHeading,
  getProfileSubheading,
  getSystemMessageBody,
  isSystemMessage,
  type ActiveChatView,
  type Conversation,
  type FriendRequest,
  type Message,
  type NotificationItem,
  type Profile,
} from './shared';

type CampusChatSidebarProps = {
  activeView: ActiveChatView;
  availableFriends: Profile[];
  getConversationTitle: (conversation: Conversation) => string;
  groupName: string;
  isCreatingGroup: boolean;
  isCreatingGroupChat: boolean;
  selectedConversationId: string | null;
  selectedFriendIds: string[];
  setActiveView: (view: ActiveChatView) => void;
  setGroupName: (value: string) => void;
  setIsCreatingGroup: (value: boolean | ((value: boolean) => boolean)) => void;
  setSelectedConversationId: (value: string) => void;
  setSelectedFriendIds: (value: string[] | ((value: string[]) => string[])) => void;
  sortedConversations: Conversation[];
  unreadNotifications: number;
  createGroupChat: () => Promise<void>;
  receivedRequestsCount: number;
};

export function CampusChatSidebar({
  activeView,
  availableFriends,
  createGroupChat,
  getConversationTitle,
  groupName,
  isCreatingGroup,
  isCreatingGroupChat,
  receivedRequestsCount,
  selectedConversationId,
  selectedFriendIds,
  setActiveView,
  setGroupName,
  setIsCreatingGroup,
  setSelectedConversationId,
  setSelectedFriendIds,
  sortedConversations,
  unreadNotifications,
}: CampusChatSidebarProps) {
  return (
    <div className="space-y-4">
      <div className="campus-panel rounded-[1.7rem] p-4">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200/70">Campus Chat</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { key: 'chat' as const, label: 'Chats' },
            { key: 'friends' as const, label: 'Friends' },
            { key: 'requests' as const, label: `Requests (${receivedRequestsCount})` },
            { key: 'notifications' as const, label: `Alerts (${unreadNotifications})` },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveView(item.key)}
              className={`rounded-[1rem] px-3 py-2 text-sm transition ${
                activeView === item.key
                  ? 'campus-button text-white'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="campus-panel-strong rounded-[1.7rem] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-white">Conversations</h3>
          <button
            onClick={() => setIsCreatingGroup((value) => !value)}
            disabled={isCreatingGroupChat}
            className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-white"
          >
            {isCreatingGroup ? 'Close' : 'New Group'}
          </button>
        </div>

        {isCreatingGroup ? (
          <div className="campus-soft-card mb-4 rounded-[1.2rem] p-3">
            <input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Group name"
              className="campus-input mb-3 w-full rounded-[1rem] px-3 py-2 text-sm placeholder-white/40"
            />
            <div className="campus-scroll max-h-32 space-y-2 overflow-y-auto">
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
              {availableFriends.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-sm text-white/50">
                  Add at least one friend first, then you can create a personal group.
                </div>
              ) : null}
            </div>
            <button
              onClick={() => void createGroupChat()}
              disabled={isCreatingGroupChat}
              className="campus-button mt-3 w-full rounded-[1rem] px-3 py-2 text-sm font-medium text-white"
            >
              {isCreatingGroupChat ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        ) : null}

        <div className="space-y-2">
          {sortedConversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => {
                setSelectedConversationId(conversation.id);
                setActiveView('chat');
              }}
              className={`w-full rounded-[1.1rem] px-3 py-3 text-left transition ${
                selectedConversationId === conversation.id
                  ? 'campus-soft-card text-white'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="font-medium">{getConversationTitle(conversation)}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-cyan-200/70">{conversation.type}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type ChatViewPanelProps = {
  canAddMembersToSelectedGroup: boolean;
  canLeaveSelectedGroup: boolean;
  canManageSelectedGroup: boolean;
  chatError: string | null;
  getConversationTitle: (conversation: Conversation) => string;
  groupMemberUsername: string;
  isAddingGroupMember: boolean;
  isLeavingGroup: boolean;
  isRefreshing: boolean;
  isSending: boolean;
  loading: boolean;
  messages: Message[];
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  newMessage: string;
  profileMap: Map<string, Profile>;
  removeMemberFromSelectedGroup: (member: Profile) => Promise<void>;
  selectedConversation: Conversation | null;
  selectedConversationId: string | null;
  selectedGroupMembers: Profile[];
  sendMessage: () => Promise<void>;
  setGroupMemberUsername: (value: string) => void;
  setNewMessage: (value: string) => void;
  addMemberToSelectedGroup: () => Promise<void>;
  userId: string;
  leaveSelectedGroup: () => Promise<void>;
};

export function ChatViewPanel({
  addMemberToSelectedGroup,
  canAddMembersToSelectedGroup,
  canLeaveSelectedGroup,
  canManageSelectedGroup,
  chatError,
  getConversationTitle,
  groupMemberUsername,
  isAddingGroupMember,
  isLeavingGroup,
  isRefreshing,
  isSending,
  leaveSelectedGroup,
  loading,
  messages,
  messagesContainerRef,
  newMessage,
  profileMap,
  removeMemberFromSelectedGroup,
  selectedConversation,
  selectedConversationId,
  selectedGroupMembers,
  sendMessage,
  setGroupMemberUsername,
  setNewMessage,
  userId,
}: ChatViewPanelProps) {
  return (
    <div className="flex h-[70vh] flex-col">
      <div className="border-b border-white/10 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
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
          </div>
          {canLeaveSelectedGroup ? (
            <button
              onClick={() => void leaveSelectedGroup()}
              disabled={isLeavingGroup}
              className="rounded-[0.95rem] border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLeavingGroup ? 'Leaving...' : 'Leave Group'}
            </button>
          ) : null}
        </div>
        {isRefreshing ? <div className="mt-2 text-xs text-cyan-200/70">Refreshing chat...</div> : null}
        {chatError ? (
          <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {chatError}
          </div>
        ) : null}
        {selectedConversation?.type === 'group' ? (
          <div className="mt-4 rounded-[1rem] border border-white/10 bg-white/5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {selectedGroupMembers.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/80"
                >
                  <span>@{member.username}</span>
                  {canManageSelectedGroup && member.user_id !== userId ? (
                    <button
                      onClick={() => void removeMemberFromSelectedGroup(member)}
                      className="rounded-full border border-red-400/25 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-100"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {canAddMembersToSelectedGroup ? (
              <div className="mt-3 flex gap-3">
                <input
                  value={groupMemberUsername}
                  onChange={(event) => setGroupMemberUsername(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void addMemberToSelectedGroup();
                    }
                  }}
                  placeholder="Add member by username"
                  className="campus-input flex-1 rounded-[1rem] px-4 py-2.5 text-sm placeholder-white/40"
                />
                <button
                  onClick={() => void addMemberToSelectedGroup()}
                  disabled={isAddingGroupMember}
                  className="rounded-[0.95rem] bg-white/10 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAddingGroupMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            ) : null}
            <div className="mt-3 text-xs text-white/50">
              Group members can add people. Only the group creator can remove them.
            </div>
          </div>
        ) : null}
      </div>

      <div ref={messagesContainerRef} className="campus-scroll mt-4 flex-1 space-y-3 overflow-y-auto">
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
            const systemMessage = isSystemMessage(message.content);
            const senderHeading = getProfileHeading(sender);
            const senderSubheading = getProfileSubheading(sender);

            if (systemMessage) {
              return (
                <div key={message.id} className="flex justify-center">
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/65">
                    {getSystemMessageBody(message.content)}
                  </div>
                </div>
              );
            }

            return (
              <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-[1.35rem] px-4 py-3 shadow-lg ${
                    isOwn ? 'campus-button text-white' : 'campus-soft-card text-white'
                  }`}
                >
                  <div className="mb-1">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60">{senderHeading}</div>
                    {senderSubheading ? (
                      <div className="mt-1 text-[11px] text-cyan-100/75">{senderSubheading}</div>
                    ) : null}
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
          className="campus-input flex-1 rounded-[1rem] px-4 py-3 placeholder-white/40"
        />
        <button
          onClick={() => void sendMessage()}
          disabled={isSending || !selectedConversationId || !newMessage.trim()}
          className="campus-button rounded-[1rem] px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

type FriendsViewPanelProps = {
  availableFriends: Profile[];
  filteredFriends: Profile[];
  openDirectChat: (friendUserId: string) => Promise<void>;
  searchTerm: string;
  searchableProfiles: Profile[];
  sendFriendRequest: (receiverId: string) => Promise<void>;
  setSearchTerm: (value: string) => void;
};

export function FriendsViewPanel({
  availableFriends,
  filteredFriends,
  openDirectChat,
  searchTerm,
  searchableProfiles,
  sendFriendRequest,
  setSearchTerm,
}: FriendsViewPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-white">Find People</h3>
        <p className="text-sm text-white/50">Search by username to send a friend request.</p>
      </div>
      <input
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Search username"
        className="campus-input w-full rounded-[1rem] px-4 py-3 placeholder-white/40"
      />
      <div className="grid gap-3 md:grid-cols-2">
        {searchableProfiles.map((profile) => (
          <div key={profile.user_id} className="campus-panel rounded-[1.25rem] p-4">
            <div className="font-medium text-white">{profile.display_name}</div>
            <div className="text-sm text-cyan-200/80">@{profile.username}</div>
            <button
              onClick={() => void sendFriendRequest(profile.user_id)}
              className="campus-button mt-3 rounded-[0.95rem] px-4 py-2 text-sm font-medium text-white"
            >
              Add Friend
            </button>
          </div>
        ))}
        {searchableProfiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50 md:col-span-2">
            No users matched that username yet.
          </div>
        ) : null}
      </div>

      <div>
        <h4 className="mb-3 font-semibold text-white">Your Friends</h4>
        <div className="space-y-3">
          {filteredFriends.map((friend) => (
            <div
              key={friend.user_id}
              className="campus-panel flex items-center justify-between rounded-[1.25rem] p-4"
            >
              <div>
                <div className="font-medium text-white">{getProfileHeading(friend)}</div>
                <div className="text-sm text-white/60">
                  {getProfileSubheading(friend) ?? `@${friend.username}`} {friend.is_online ? '• Online' : '• Offline'}
                </div>
              </div>
              <button
                onClick={() => void openDirectChat(friend.user_id)}
                className="rounded-[0.95rem] bg-white/10 px-4 py-2 text-sm text-white"
              >
                Message
              </button>
            </div>
          ))}
          {filteredFriends.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50">
              {availableFriends.length === 0 ? 'No friends added yet.' : 'No friends matched that username.'}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type RequestsViewPanelProps = {
  acceptFriendRequest: (request: FriendRequest) => Promise<void>;
  profileMap: Map<string, Profile>;
  receivedRequests: FriendRequest[];
  rejectFriendRequest: (requestId: string) => Promise<void>;
  sentRequests: FriendRequest[];
};

export function RequestsViewPanel({
  acceptFriendRequest,
  profileMap,
  receivedRequests,
  rejectFriendRequest,
  sentRequests,
}: RequestsViewPanelProps) {
  return (
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
                <button
                  onClick={() => void acceptFriendRequest(request)}
                  className="rounded-lg bg-green-500 px-4 py-2 text-sm text-white"
                >
                  Accept
                </button>
                <button
                  onClick={() => void rejectFriendRequest(request.id)}
                  className="rounded-lg bg-red-500/80 px-4 py-2 text-sm text-white"
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
        {receivedRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50">
            No pending requests.
          </div>
        ) : null}
      </div>

      <div>
        <h4 className="mb-3 font-semibold text-white">Sent Requests</h4>
        <div className="space-y-3">
          {sentRequests.map((request) => {
            const receiver = profileMap.get(request.receiver_id);
            return (
              <div key={request.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/80">
                Waiting for {receiver?.display_name || receiver?.username || 'student'} to accept.
              </div>
            );
          })}
          {sentRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50">
              No outgoing requests.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type NotificationsViewPanelProps = {
  markNotificationRead: (notification: NotificationItem) => Promise<void>;
  notifications: NotificationItem[];
};

export function NotificationsViewPanel({
  markNotificationRead,
  notifications,
}: NotificationsViewPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-white">Notifications</h3>
        <p className="text-sm text-white/50">Friend requests, accepts, and group chat updates.</p>
      </div>
      <div className="space-y-3">
        {notifications.map((notification) => (
          <button
            key={notification.id}
            onClick={() => void markNotificationRead(notification)}
            className={`w-full rounded-xl border p-4 text-left ${
              notification.is_read
                ? 'border-white/10 bg-white/5 text-white/70'
                : 'border-cyan-400/40 bg-cyan-500/10 text-white'
            }`}
          >
            <div className="font-medium">{notification.title}</div>
            <div className="mt-1 text-sm opacity-80">{notification.body}</div>
          </button>
        ))}
        {notifications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50">
            No notifications yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
