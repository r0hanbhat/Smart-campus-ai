'use client';
import { getProfileHeading, getProfileSubheading, getSystemMessageBody, isSystemMessage, } from './shared.js';
export function CampusChatSidebar({ activeView, availableFriends, createGroupChat, getConversationTitle, groupName, isCreatingGroup, isCreatingGroupChat, nonFriendSearchTerm = '', receivedRequestsCount, searchableNonFriends = [], selectedConversationId, selectedFriendIds, selectedNonFriendIds = [], setActiveView, setGroupName, setIsCreatingGroup, setNonFriendSearchTerm, setSelectedConversationId, setSelectedFriendIds, setSelectedNonFriendIds, sortedConversations, unreadNotifications, }) {
    const hasAtLeastOneFriend = selectedFriendIds.length > 0;
    const hasAtLeastOneNonFriend = selectedNonFriendIds.length > 0;
    const canCreateGroup = hasAtLeastOneFriend || hasAtLeastOneNonFriend;
    const isNonFriendModeAvailable = Boolean(setNonFriendSearchTerm && setSelectedNonFriendIds);
    const isNonFriendMode = isNonFriendModeAvailable && nonFriendSearchTerm !== '';
    const globalConversations = sortedConversations.filter((conversation) => conversation.type === 'global');
    const groupConversations = sortedConversations.filter((conversation) => conversation.type === 'group');
    const directConversations = sortedConversations.filter((conversation) => conversation.type === 'direct');
    const renderConversationSection = (title, conversations) => (<div className="space-y-2">
      <div className="px-1 text-[11px] uppercase tracking-[0.2em] text-white/45">{title}</div>
      {conversations.length > 0 ? (conversations.map((conversation) => (<button key={conversation.id} onClick={() => {
                setSelectedConversationId(conversation.id);
                setActiveView('chat');
            }} className={`w-full rounded-[1.1rem] px-3 py-3 text-left transition ${selectedConversationId === conversation.id
                ? 'campus-soft-card text-white'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="truncate font-medium">{getConversationTitle(conversation)}</div>
                <div className="mt-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-200/70">
                  <span>{conversation.type}</span>
                  {conversation.group_status === 'pending' ? (<span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-yellow-200">
                      Pending
                    </span>) : null}
                </div>
              </div>
            </div>
          </button>))) : (<div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-sm text-white/50">
          No {title.toLowerCase()} yet.
        </div>)}
    </div>);
    return (<div className="space-y-4">
      <div className="campus-panel rounded-[1.7rem] p-4">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200/70">
          Campus Chat
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { key: 'chat', label: 'Chats' },
            { key: 'friends', label: 'Friends' },
            { key: 'requests', label: `Requests (${receivedRequestsCount})` },
            { key: 'notifications', label: `Alerts (${unreadNotifications})` },
        ].map((item) => (<button key={item.key} onClick={() => setActiveView(item.key)} className={`rounded-[1rem] px-3 py-2 text-sm transition ${activeView === item.key
                ? 'campus-button text-white'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}>
              {item.label}
            </button>))}
        </div>
      </div>

      <div className="campus-panel-strong rounded-[1.7rem] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-white">Conversations</h3>
          <button onClick={() => setIsCreatingGroup((value) => !value)} disabled={isCreatingGroupChat} className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-white disabled:opacity-50">
            {isCreatingGroup ? 'Close' : 'New Group'}
          </button>
        </div>

        {isCreatingGroup ? (<div className="campus-soft-card mb-4 rounded-[1.2rem] p-4">
            <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Group name" className="campus-input mb-3 w-full rounded-[1rem] px-3 py-2 text-sm placeholder-white/40"/>

            {isNonFriendModeAvailable ? (<div className="mb-3 flex gap-2 border-b border-white/10">
                <button onClick={() => setNonFriendSearchTerm?.('')} className={`px-3 py-2 text-sm font-medium transition ${!isNonFriendMode
                    ? 'border-b-2 border-cyan-400 text-cyan-200'
                    : 'text-white/60 hover:text-white'}`}>
                  Friends
                </button>
                <button onClick={() => setNonFriendSearchTerm?.('active')} className={`px-3 py-2 text-sm font-medium transition ${isNonFriendMode
                    ? 'border-b-2 border-cyan-400 text-cyan-200'
                    : 'text-white/60 hover:text-white'}`}>
                  Invite Others
                </button>
              </div>) : null}

            {!isNonFriendMode ? (<div className="campus-scroll max-h-40 space-y-2 overflow-y-auto rounded-lg border border-white/5 p-3">
                {availableFriends.length > 0 ? (availableFriends.map((friend) => (<label key={friend.user_id} className="flex cursor-pointer items-center gap-2 text-sm text-white/80 hover:text-white">
                      <input type="checkbox" checked={selectedFriendIds.includes(friend.user_id)} onChange={(event) => {
                        setSelectedFriendIds((prev) => event.target.checked
                            ? [...prev, friend.user_id]
                            : prev.filter((id) => id !== friend.user_id));
                    }} className="cursor-pointer"/>
                      <div>
                        <div className="font-medium">{friend.display_name}</div>
                        <div className="text-xs text-white/50">@{friend.username}</div>
                      </div>
                    </label>))) : (<div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-sm text-white/50">
                    Add friends first to create a group with them.
                  </div>)}
              </div>) : (<div className="space-y-3">
                <input value={nonFriendSearchTerm} onChange={(event) => setNonFriendSearchTerm?.(event.target.value)} placeholder="Search username to invite" className="campus-input w-full rounded-[1rem] px-3 py-2 text-sm placeholder-white/40"/>
                <div className="campus-scroll max-h-40 space-y-2 overflow-y-auto rounded-lg border border-white/5 p-3">
                  {searchableNonFriends.length > 0 ? (searchableNonFriends.map((nonFriend) => (<label key={nonFriend.user_id} className="flex cursor-pointer items-center gap-2 text-sm text-white/80 hover:text-white">
                        <input type="checkbox" checked={selectedNonFriendIds.includes(nonFriend.user_id)} onChange={(event) => {
                        setSelectedNonFriendIds?.((prev) => event.target.checked
                            ? [...prev, nonFriend.user_id]
                            : prev.filter((id) => id !== nonFriend.user_id));
                    }} className="cursor-pointer"/>
                        <div>
                          <div className="font-medium">{nonFriend.display_name}</div>
                          <div className="text-xs text-white/50">@{nonFriend.username}</div>
                        </div>
                      </label>))) : (<div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-sm text-white/50">
                      No users found.
                    </div>)}
                </div>
              </div>)}

            {(selectedFriendIds.length > 0 || selectedNonFriendIds.length > 0) && (<div className="mt-3 rounded-lg bg-white/5 p-2 text-xs text-white/70">
                {selectedFriendIds.length > 0 ? (<div>Friends selected: {selectedFriendIds.length}</div>) : null}
                {selectedNonFriendIds.length > 0 ? (<div>People to invite: {selectedNonFriendIds.length}</div>) : null}
              </div>)}

            <button onClick={() => void createGroupChat()} disabled={isCreatingGroupChat || !canCreateGroup} className="campus-button mt-4 w-full rounded-[1rem] px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
              {isCreatingGroupChat ? 'Creating...' : 'Create Group'}
            </button>

            {!canCreateGroup ? (<div className="mt-2 text-xs text-red-200/70">
                Select at least one friend or person to invite.
              </div>) : null}
          </div>) : null}

        <div className="space-y-4">
          {renderConversationSection('Global Chat', globalConversations)}
          {renderConversationSection('Group Chats', groupConversations)}
          {renderConversationSection('Direct Messages', directConversations)}
        </div>
      </div>
    </div>);
}
export function ChatViewPanel({ addMemberToSelectedGroup, canAddMembersToSelectedGroup, canLeaveSelectedGroup, canManageSelectedGroup, canRequestFriendFromSender, canSendMessages = true, chatError, getConversationTitle, groupInvitations = [], groupMemberUsername, isAddingGroupMember, isLeavingGroup, isRefreshing, isSending, leaveSelectedGroup, loading, messages, messagesContainerRef, newMessage, profileMap, removeMemberFromSelectedGroup, selectedConversation, selectedConversationId, selectedGroupMembers, sendMessage, sendFriendRequestFromMessage, setGroupMemberUsername, setNewMessage, userId, }) {
    return (<div className="flex h-[70vh] flex-col">
      <div className="border-b border-white/10 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-white">
              {selectedConversation ? getConversationTitle(selectedConversation) : 'Campus Chat'}
            </h3>
            <p className="mt-1 text-sm text-white/50">
              {selectedConversation?.type === 'global'
            ? 'Public chat for the whole campus.'
            : selectedConversation?.type === 'group'
                ? selectedConversation.group_status === 'pending'
                    ? 'Group pending activation.'
                    : 'Group discussion.'
                : 'Private conversation between friends.'}
            </p>
          </div>
          {canLeaveSelectedGroup ? (<button onClick={() => void leaveSelectedGroup()} disabled={isLeavingGroup} className="rounded-[0.95rem] border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-100 disabled:cursor-not-allowed disabled:opacity-60">
              {isLeavingGroup ? 'Leaving...' : 'Leave'}
            </button>) : null}
        </div>

        {isRefreshing ? (<div className="mt-2 text-xs text-cyan-200/70">Refreshing...</div>) : null}
        {chatError ? (<div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {chatError}
          </div>) : null}

        {selectedConversation?.type === 'group' && selectedConversation.group_status === 'pending' ? (<div className="mt-3 rounded-[1rem] border border-yellow-400/30 bg-yellow-500/10 p-3">
            <div className="text-xs font-semibold text-yellow-200">Group Pending Activation</div>
            <div className="mt-1 text-xs text-yellow-100/80">
              This group will activate once an invited member accepts.
            </div>
          </div>) : null}

        {selectedConversation?.type === 'group' ? (<div className="mt-4 rounded-[1rem] border border-white/10 bg-white/5 p-3">
            <div className="mb-3">
              <div className="mb-2 text-xs font-semibold text-white/70">Members</div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedGroupMembers.map((member) => {
                  return (<div key={member.user_id} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/80">
                    <span>@{member.username}</span>
                    {canManageSelectedGroup && member.user_id !== userId ? (<button onClick={() => void removeMemberFromSelectedGroup(member)} className="ml-1 rounded-full border border-red-400/25 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-100 hover:bg-red-500/20">x</button>) : null}
                    </div>);
                })}
              </div>
            </div>

            {groupInvitations.length > 0 ? (<div className="border-t border-white/10 pt-3">
                <div className="mb-2 text-xs font-semibold text-white/70">Pending Invites</div>
                <div className="flex flex-wrap items-center gap-2">
                  {groupInvitations
                    .filter((invite) => invite.status === 'pending')
                    .map((invite) => {
                    const invitedUser = profileMap.get(invite.invited_user_id);
                    return (<div key={invite.id} className="flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-100">
                          <span>@{invitedUser?.username || 'unknown'}</span>
                          <span>...</span>
                        </div>);
                })}
                </div>
              </div>) : null}

            {canAddMembersToSelectedGroup ? (<div className="border-t border-white/10 pt-3">
                <div className="flex gap-3">
                  <input value={groupMemberUsername} onChange={(event) => setGroupMemberUsername(event.target.value)} onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        void addMemberToSelectedGroup();
                    }
                }} placeholder="Add member by username" className="campus-input flex-1 rounded-[1rem] px-4 py-2.5 text-sm placeholder-white/40"/>
                  <button onClick={() => void addMemberToSelectedGroup()} disabled={isAddingGroupMember} className="rounded-[0.95rem] bg-white/10 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
                    {isAddingGroupMember ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
              </div>) : null}

            <div className="mt-3 text-xs text-white/50">
              Members can add people. Only the group creator can remove them.
            </div>
          </div>) : null}
      </div>

      <div ref={messagesContainerRef} className="campus-scroll mt-4 flex-1 space-y-3 overflow-y-auto">
        {loading ? (<div className="flex h-full items-center justify-center text-white/60">
            Loading messages...
          </div>) : messages.length === 0 ? (<div className="flex h-full items-center justify-center">
            <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50">
              Start the conversation.
            </div>
          </div>) : (messages.map((message) => {
            const sender = profileMap.get(message.sender_id);
            const isOwn = message.sender_id === userId;
            const systemMessage = isSystemMessage(message.content, message.is_system ?? false);
            const senderHeading = getProfileHeading(sender);
            const senderSubheading = getProfileSubheading(sender);
            if (systemMessage) {
                return (<div key={message.id} className="flex justify-center py-2">
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/65">
                    {getSystemMessageBody(message.content)}
                  </div>
                </div>);
            }
            return (<div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-[1.35rem] px-4 py-3 shadow-lg ${isOwn ? 'campus-button text-white' : 'campus-soft-card text-white'}`}>
                  {!isOwn ? (<div className="mb-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60">
                      {senderHeading}
                    </div>
                    {senderSubheading ? (<div className="text-[11px] text-cyan-100/75">{senderSubheading}</div>) : null}
                    {selectedConversation?.type === 'global' &&
                        sender &&
                        canRequestFriendFromSender?.(sender.user_id) &&
                        sendFriendRequestFromMessage ? (<button onClick={() => void sendFriendRequestFromMessage(sender.user_id)} className="mt-2 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100 hover:bg-cyan-500/20">
                        Add Friend
                      </button>) : null}
                  </div>) : null}
                  <div className="whitespace-pre-wrap break-words text-sm leading-6">
                    {message.content}
                  </div>
                </div>
              </div>);
        }))}
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        {selectedConversation?.type === 'group' && !canSendMessages ? (<div className="mb-3 rounded-lg border border-yellow-400/30 bg-yellow-500/10 p-2 text-xs text-yellow-100">
            Waiting for group activation before sending messages.
          </div>) : null}
        <div className="flex gap-3">
          <input value={newMessage} onChange={(event) => setNewMessage(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
            }
        }} disabled={!canSendMessages} placeholder={canSendMessages ? 'Write a message...' : 'Waiting for group activation...'} className="campus-input flex-1 rounded-[1rem] px-4 py-3 placeholder-white/40 disabled:opacity-50"/>
          <button onClick={() => void sendMessage()} disabled={isSending || !selectedConversationId || !newMessage.trim() || !canSendMessages} className="campus-button rounded-[1rem] px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
            {isSending ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>);
}
export function FriendsViewPanel({ availableFriends, filteredFriends, isUnfriending = false, openDirectChat, searchTerm, searchableProfiles, sendFriendRequest, setSearchTerm, unfriendUser, }) {
    return (<div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-white">Friends & People</h3>
        <p className="text-sm text-white/50">Search by username to send a friend request.</p>
      </div>

      <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search username" className="campus-input w-full rounded-[1rem] px-4 py-3 placeholder-white/40"/>

      {searchTerm.trim() ? (<div>
          <h4 className="mb-3 font-semibold text-white">Search Results</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {searchableProfiles.length > 0 ? (searchableProfiles.map((profile) => (<div key={profile.user_id} className="campus-panel rounded-[1.25rem] p-4">
                  <div className="font-medium text-white">{profile.display_name}</div>
                  <div className="text-sm text-cyan-200/80">@{profile.username}</div>
                  <button onClick={() => void sendFriendRequest(profile.user_id)} className="campus-button mt-3 rounded-[0.95rem] px-4 py-2 text-sm font-medium text-white">
                    Add Friend
                  </button>
                </div>))) : (<div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50 md:col-span-2">
                No users matched that username.
              </div>)}
          </div>
        </div>) : null}

      <div>
        <h4 className="mb-3 font-semibold text-white">Your Friends ({filteredFriends.length})</h4>
        {filteredFriends.length > 0 ? (<div className="space-y-2">
            {filteredFriends.map((friend) => (<div key={friend.user_id} className="campus-panel flex items-center justify-between rounded-[1.25rem] p-4">
                <div className="flex-1">
                  <div className="font-medium text-white">{getProfileHeading(friend)}</div>
                  <div className="text-sm text-white/60">
                    {getProfileSubheading(friend) ?? `@${friend.username}`}
                    {friend.is_online ? ' • Online' : ' • Offline'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void openDirectChat(friend.user_id)} className="rounded-[0.95rem] bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">
                    Message
                  </button>
                  {unfriendUser ? (<button onClick={() => void unfriendUser(friend.user_id)} disabled={isUnfriending} className="rounded-[0.95rem] border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 disabled:opacity-50 hover:bg-red-500/20" title="Remove friend">
                      x
                    </button>) : null}
                </div>
              </div>))}
          </div>) : (<div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50">
            {availableFriends.length === 0
                ? 'No friends added yet. Search for users above.'
                : 'No friends matched that username.'}
          </div>)}
      </div>
    </div>);
}
export function RequestsViewPanel({ acceptFriendRequest, profileMap, receivedRequests, rejectFriendRequest, sentRequests, }) {
    return (<div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-white">Friend Requests</h3>
        <p className="text-sm text-white/50">Accept requests to unlock direct messaging.</p>
      </div>

      <div>
        <h4 className="mb-3 font-semibold text-white">Received ({receivedRequests.length})</h4>
        {receivedRequests.length > 0 ? (<div className="space-y-3">
            {receivedRequests.map((request) => {
                const sender = profileMap.get(request.sender_id);
                return (<div key={request.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div>
                    <div className="font-medium text-white">
                      {sender?.display_name || sender?.username || 'Student'}
                    </div>
                    <div className="text-sm text-white/60">@{sender?.username || 'unknown'}</div>
                  </div>
                  <div className="mt-3 flex gap-3">
                    <button onClick={() => void acceptFriendRequest(request)} className="rounded-lg bg-green-500 px-4 py-2 text-sm text-white hover:bg-green-600">
                      Accept
                    </button>
                    <button onClick={() => void rejectFriendRequest(request.id)} className="rounded-lg bg-red-500/80 px-4 py-2 text-sm text-white hover:bg-red-600">
                      Reject
                    </button>
                  </div>
                </div>);
            })}
          </div>) : (<div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50">
            No pending requests.
          </div>)}
      </div>

      <div>
        <h4 className="mb-3 font-semibold text-white">Sent ({sentRequests.length})</h4>
        {sentRequests.length > 0 ? (<div className="space-y-3">
            {sentRequests.map((request) => {
                const receiver = profileMap.get(request.receiver_id);
                return (<div key={request.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/80">
                  Waiting for{' '}
                  <span className="font-medium text-white">
                    {receiver?.display_name || receiver?.username || 'student'}
                  </span>{' '}
                  to accept.
                </div>);
            })}
          </div>) : (<div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50">
            No outgoing requests.
          </div>)}
      </div>
    </div>);
}
export function NotificationsViewPanel({ acceptGroupInvitation, markNotificationRead, notifications, rejectGroupInvitation, }) {
    return (<div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-white">Notifications</h3>
        <p className="text-sm text-white/50">Friend requests, group updates, and teacher announcements.</p>
      </div>
      {notifications.length > 0 ? (<div className="space-y-3">
          {notifications.map((notification) => (<div key={notification.id} className={`w-full rounded-xl border p-4 text-left transition ${notification.is_read
                    ? 'border-white/10 bg-white/5 text-white/70'
                    : 'border-cyan-400/40 bg-cyan-500/10 text-white'}`}>
              <button onClick={() => void markNotificationRead(notification)} className="w-full text-left">
                <div className="font-medium">{notification.title}</div>
                <div className="mt-1 text-sm opacity-80">{notification.body}</div>
                <div className="mt-2 text-xs opacity-60">
                  {new Date(notification.created_at).toLocaleString()}
                </div>
              </button>
              {notification.type === 'group_invite' && !notification.is_read && acceptGroupInvitation ? (<div className="mt-3 flex gap-2">
                  <button onClick={() => void acceptGroupInvitation(notification)} className="rounded-lg bg-green-500 px-3 py-2 text-xs font-medium text-white hover:bg-green-600">
                    Accept Invite
                  </button>
                  {rejectGroupInvitation ? (<button onClick={() => void rejectGroupInvitation(notification)} className="rounded-lg bg-red-500/80 px-3 py-2 text-xs font-medium text-white hover:bg-red-600">
                      Decline
                    </button>) : null}
                </div>) : null}
            </div>))}
        </div>) : (<div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50">
          No notifications yet.
        </div>)}
    </div>);
}
