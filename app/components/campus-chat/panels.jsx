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
      <div className="px-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">{title}</div>
      {conversations.length > 0 ? (conversations.map((conversation) => (<button key={conversation.id} onClick={() => {
                setSelectedConversationId(conversation.id);
                setActiveView('chat');
            }} className={`w-full rounded-[1.1rem] px-3 py-3 text-left transition ${selectedConversationId === conversation.id
                ? 'campus-soft-card text-slate-900'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="truncate font-medium">{getConversationTitle(conversation)}</div>
                <div className="mt-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-sky-700/70">
                  <span>{conversation.type}</span>
                  {conversation.group_status === 'pending' ? (<span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-yellow-700">
                      Pending
                    </span>) : null}
                </div>
              </div>
            </div>
          </button>))) : (<div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400">
          No {title.toLowerCase()} yet.
        </div>)}
    </div>);
    return (<div className="space-y-4">
      <div className="campus-panel rounded-[1.7rem] p-4">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-700/70">
          Campus Chat
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { key: 'chat', label: 'Chats' },
            { key: 'friends', label: 'Friends' },
            { key: 'requests', label: `Requests (${receivedRequestsCount})` },
            { key: 'notifications', label: `Alerts (${unreadNotifications})` },
        ].map((item) => (<button key={item.key} onClick={() => setActiveView(item.key)} className={`rounded-[1rem] px-3 py-2 text-sm transition ${activeView === item.key
                ? 'campus-button text-slate-900'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
              {item.label}
            </button>))}
        </div>
      </div>

      <div className="campus-panel-strong rounded-[1.7rem] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Conversations</h3>
          <button onClick={() => setIsCreatingGroup((value) => !value)} disabled={isCreatingGroupChat} className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-900 disabled:opacity-50">
            {isCreatingGroup ? 'Close' : 'New Group'}
          </button>
        </div>

        {isCreatingGroup ? (<div className="campus-soft-card mb-4 rounded-[1.2rem] p-4">
            <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Group name" className="campus-input mb-3 w-full rounded-[1rem] px-3 py-2 text-sm placeholder-slate-400"/>

            {isNonFriendModeAvailable ? (<div className="mb-3 flex gap-2 border-b border-slate-200">
                <button onClick={() => setNonFriendSearchTerm?.('')} className={`px-3 py-2 text-sm font-medium transition ${!isNonFriendMode
                    ? 'border-b-2 border-sky-400 text-sky-700'
                    : 'text-slate-500 hover:text-slate-900'}`}>
                  Friends
                </button>
                <button onClick={() => setNonFriendSearchTerm?.('active')} className={`px-3 py-2 text-sm font-medium transition ${isNonFriendMode
                    ? 'border-b-2 border-sky-400 text-sky-700'
                    : 'text-slate-500 hover:text-slate-900'}`}>
                  Invite Others
                </button>
              </div>) : null}

            {!isNonFriendMode ? (<div className="campus-scroll max-h-40 space-y-2 overflow-y-auto rounded-lg border border-white/5 p-3">
                {availableFriends.length > 0 ? (availableFriends.map((friend) => (<label key={friend.user_id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 hover:text-slate-900">
                      <input type="checkbox" checked={selectedFriendIds.includes(friend.user_id)} onChange={(event) => {
                        setSelectedFriendIds((prev) => event.target.checked
                            ? [...prev, friend.user_id]
                            : prev.filter((id) => id !== friend.user_id));
                    }} className="cursor-pointer"/>
                      <div>
                        <div className="font-medium">{friend.display_name}</div>
                        <div className="text-xs text-slate-400">@{friend.username}</div>
                      </div>
                    </label>))) : (<div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400">
                    Add friends first to create a group with them.
                  </div>)}
              </div>) : (<div className="space-y-3">
                <input value={nonFriendSearchTerm} onChange={(event) => setNonFriendSearchTerm?.(event.target.value)} placeholder="Search username to invite" className="campus-input w-full rounded-[1rem] px-3 py-2 text-sm placeholder-slate-400"/>
                <div className="campus-scroll max-h-40 space-y-2 overflow-y-auto rounded-lg border border-white/5 p-3">
                  {searchableNonFriends.length > 0 ? (searchableNonFriends.map((nonFriend) => (<label key={nonFriend.user_id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 hover:text-slate-900">
                        <input type="checkbox" checked={selectedNonFriendIds.includes(nonFriend.user_id)} onChange={(event) => {
                        setSelectedNonFriendIds?.((prev) => event.target.checked
                            ? [...prev, nonFriend.user_id]
                            : prev.filter((id) => id !== nonFriend.user_id));
                    }} className="cursor-pointer"/>
                        <div>
                          <div className="font-medium">{nonFriend.display_name}</div>
                          <div className="text-xs text-slate-400">@{nonFriend.username}</div>
                        </div>
                      </label>))) : (<div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400">
                      No users found.
                    </div>)}
                </div>
              </div>)}

            {(selectedFriendIds.length > 0 || selectedNonFriendIds.length > 0) && (<div className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                {selectedFriendIds.length > 0 ? (<div>Friends selected: {selectedFriendIds.length}</div>) : null}
                {selectedNonFriendIds.length > 0 ? (<div>People to invite: {selectedNonFriendIds.length}</div>) : null}
              </div>)}

            <button onClick={() => void createGroupChat()} disabled={isCreatingGroupChat || !canCreateGroup} className="campus-button mt-4 w-full rounded-[1rem] px-3 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-50">
              {isCreatingGroupChat ? 'Creating...' : 'Create Group'}
            </button>

            {!canCreateGroup ? (<div className="mt-2 text-xs text-red-600/70">
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
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-slate-900">
              {selectedConversation ? getConversationTitle(selectedConversation) : 'Campus Chat'}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {selectedConversation?.type === 'global'
            ? 'Public chat for the whole campus.'
            : selectedConversation?.type === 'group'
                ? selectedConversation.group_status === 'pending'
                    ? 'Group pending activation.'
                    : 'Group discussion.'
                : 'Private conversation between friends.'}
            </p>
          </div>
          {canLeaveSelectedGroup ? (<button onClick={() => void leaveSelectedGroup()} disabled={isLeavingGroup} className="rounded-[0.95rem] border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-600 disabled:cursor-not-allowed disabled:opacity-60">
              {isLeavingGroup ? 'Leaving...' : 'Leave'}
            </button>) : null}
        </div>

        {isRefreshing ? (<div className="mt-2 text-xs text-sky-700/70">Refreshing...</div>) : null}
        {chatError ? (<div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
            {chatError}
          </div>) : null}

        {selectedConversation?.type === 'group' && selectedConversation.group_status === 'pending' ? (<div className="mt-3 rounded-[1rem] border border-yellow-400/30 bg-yellow-500/10 p-3">
            <div className="text-xs font-semibold text-yellow-700">Group Pending Activation</div>
            <div className="mt-1 text-xs text-yellow-700/80">
              This group will activate once an invited member accepts.
            </div>
          </div>) : null}

        {selectedConversation?.type === 'group' ? (<div className="mt-4 rounded-[1rem] border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3">
              <div className="mb-2 text-xs font-semibold text-slate-600">Members</div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedGroupMembers.map((member) => {
                  return (<div key={member.user_id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    <span>@{member.username}</span>
                    {canManageSelectedGroup && member.user_id !== userId ? (<button onClick={() => void removeMemberFromSelectedGroup(member)} className="ml-1 rounded-full border border-red-400/25 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-500/20">x</button>) : null}
                    </div>);
                })}
              </div>
            </div>

            {groupInvitations.length > 0 ? (<div className="border-t border-slate-200 pt-3">
                <div className="mb-2 text-xs font-semibold text-slate-600">Pending Invites</div>
                <div className="flex flex-wrap items-center gap-2">
                  {groupInvitations
                    .filter((invite) => invite.status === 'pending')
                    .map((invite) => {
                    const invitedUser = profileMap.get(invite.invited_user_id);
                    return (<div key={invite.id} className="flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-700">
                          <span>@{invitedUser?.username || 'unknown'}</span>
                          <span>...</span>
                        </div>);
                })}
                </div>
              </div>) : null}

            {canAddMembersToSelectedGroup ? (<div className="border-t border-slate-200 pt-3">
                <div className="flex gap-3">
                  <input value={groupMemberUsername} onChange={(event) => setGroupMemberUsername(event.target.value)} onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        void addMemberToSelectedGroup();
                    }
                }} placeholder="Add member by username" className="campus-input flex-1 rounded-[1rem] px-4 py-2.5 text-sm placeholder-slate-400"/>
                  <button onClick={() => void addMemberToSelectedGroup()} disabled={isAddingGroupMember} className="rounded-[0.95rem] bg-slate-100 px-4 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60">
                    {isAddingGroupMember ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
              </div>) : null}

            <div className="mt-3 text-xs text-slate-400">
              Members can add people. Only the group creator can remove them.
            </div>
          </div>) : null}
      </div>

      <div ref={messagesContainerRef} className="campus-scroll mt-4 flex-1 space-y-3 overflow-y-auto">
        {loading ? (<div className="flex h-full items-center justify-center text-slate-500">
            Loading messages...
          </div>) : messages.length === 0 ? (<div className="flex h-full items-center justify-center">
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
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
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                    {getSystemMessageBody(message.content)}
                  </div>
                </div>);
            }
            return (<div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-[1.35rem] px-4 py-3 shadow-lg ${isOwn ? 'campus-button text-slate-900' : 'campus-soft-card text-slate-900'}`}>
                  {!isOwn ? (<div className="mb-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {senderHeading}
                    </div>
                    {senderSubheading ? (<div className="text-[11px] text-sky-700/75">{senderSubheading}</div>) : null}
                    {selectedConversation?.type === 'global' &&
                        sender &&
                        canRequestFriendFromSender?.(sender.user_id) &&
                        sendFriendRequestFromMessage ? (<button onClick={() => void sendFriendRequestFromMessage(sender.user_id)} className="mt-2 rounded-full border border-sky-300/20 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-700 hover:bg-sky-500/20">
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

      <div className="mt-4 border-t border-slate-200 pt-4">
        {selectedConversation?.type === 'group' && !canSendMessages ? (<div className="mb-3 rounded-lg border border-yellow-400/30 bg-yellow-500/10 p-2 text-xs text-yellow-700">
            Waiting for group activation before sending messages.
          </div>) : null}
        <div className="flex gap-3">
          <input value={newMessage} onChange={(event) => setNewMessage(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
            }
        }} disabled={!canSendMessages} placeholder={canSendMessages ? 'Write a message...' : 'Waiting for group activation...'} className="campus-input flex-1 rounded-[1rem] px-4 py-3 placeholder-slate-400 disabled:opacity-50"/>
          <button onClick={() => void sendMessage()} disabled={isSending || !selectedConversationId || !newMessage.trim() || !canSendMessages} className="campus-button rounded-[1rem] px-6 py-3 font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-50">
            {isSending ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>);
}
export function FriendsViewPanel({ availableFriends, filteredFriends, isUnfriending = false, openDirectChat, searchTerm, searchableProfiles, sendFriendRequest, setSearchTerm, unfriendUser, }) {
    return (<div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-slate-900">Friends & People</h3>
        <p className="text-sm text-slate-400">Search by username to send a friend request.</p>
      </div>

      <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search username" className="campus-input w-full rounded-[1rem] px-4 py-3 placeholder-slate-400"/>

      {searchTerm.trim() ? (<div>
          <h4 className="mb-3 font-semibold text-slate-900">Search Results</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {searchableProfiles.length > 0 ? (searchableProfiles.map((profile) => (<div key={profile.user_id} className="campus-panel rounded-[1.25rem] p-4">
                  <div className="font-medium text-slate-900">{profile.display_name}</div>
                  <div className="text-sm text-sky-700/80">@{profile.username}</div>
                  <button onClick={() => void sendFriendRequest(profile.user_id)} className="campus-button mt-3 rounded-[0.95rem] px-4 py-2 text-sm font-medium text-slate-900">
                    Add Friend
                  </button>
                </div>))) : (<div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400 md:col-span-2">
                No users matched that username.
              </div>)}
          </div>
        </div>) : null}

      <div>
        <h4 className="mb-3 font-semibold text-slate-900">Your Friends ({filteredFriends.length})</h4>
        {filteredFriends.length > 0 ? (<div className="space-y-2">
            {filteredFriends.map((friend) => (<div key={friend.user_id} className="campus-panel flex items-center justify-between rounded-[1.25rem] p-4">
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{getProfileHeading(friend)}</div>
                  <div className="text-sm text-slate-500">
                    {getProfileSubheading(friend) ?? `@${friend.username}`}
                    {friend.is_online ? ' • Online' : ' • Offline'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void openDirectChat(friend.user_id)} className="rounded-[0.95rem] bg-slate-100 px-4 py-2 text-sm text-slate-900 hover:bg-slate-200">
                    Message
                  </button>
                  {unfriendUser ? (<button onClick={() => void unfriendUser(friend.user_id)} disabled={isUnfriending} className="rounded-[0.95rem] border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 disabled:opacity-50 hover:bg-red-500/20" title="Remove friend">
                      x
                    </button>) : null}
                </div>
              </div>))}
          </div>) : (<div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
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
        <h3 className="text-xl font-semibold text-slate-900">Friend Requests</h3>
        <p className="text-sm text-slate-400">Accept requests to unlock direct messaging.</p>
      </div>

      <div>
        <h4 className="mb-3 font-semibold text-slate-900">Received ({receivedRequests.length})</h4>
        {receivedRequests.length > 0 ? (<div className="space-y-3">
            {receivedRequests.map((request) => {
                const sender = profileMap.get(request.sender_id);
                return (<div key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <div className="font-medium text-slate-900">
                      {sender?.display_name || sender?.username || 'Student'}
                    </div>
                    <div className="text-sm text-slate-500">@{sender?.username || 'unknown'}</div>
                  </div>
                  <div className="mt-3 flex gap-3">
                    <button onClick={() => void acceptFriendRequest(request)} className="rounded-lg bg-green-500 px-4 py-2 text-sm text-slate-900 hover:bg-green-600">
                      Accept
                    </button>
                    <button onClick={() => void rejectFriendRequest(request.id)} className="rounded-lg bg-red-500/80 px-4 py-2 text-sm text-slate-900 hover:bg-red-600">
                      Reject
                    </button>
                  </div>
                </div>);
            })}
          </div>) : (<div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
            No pending requests.
          </div>)}
      </div>

      <div>
        <h4 className="mb-3 font-semibold text-slate-900">Sent ({sentRequests.length})</h4>
        {sentRequests.length > 0 ? (<div className="space-y-3">
            {sentRequests.map((request) => {
                const receiver = profileMap.get(request.receiver_id);
                return (<div key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                  Waiting for{' '}
                  <span className="font-medium text-slate-900">
                    {receiver?.display_name || receiver?.username || 'student'}
                  </span>{' '}
                  to accept.
                </div>);
            })}
          </div>) : (<div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
            No outgoing requests.
          </div>)}
      </div>
    </div>);
}
export function NotificationsViewPanel({ acceptGroupInvitation, markNotificationRead, notifications, rejectGroupInvitation, }) {
    return (<div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-slate-900">Notifications</h3>
        <p className="text-sm text-slate-400">Friend requests, group updates, and teacher announcements.</p>
      </div>
      {notifications.length > 0 ? (<div className="space-y-3">
          {notifications.map((notification) => (<div key={notification.id} className={`w-full rounded-xl border p-4 text-left transition ${notification.is_read
                    ? 'border-slate-200 bg-slate-50 text-slate-600'
                    : 'border-sky-400/40 bg-sky-500/10 text-slate-900'}`}>
              <button onClick={() => void markNotificationRead(notification)} className="w-full text-left">
                <div className="font-medium">{notification.title}</div>
                <div className="mt-1 text-sm opacity-80">{notification.body}</div>
                <div className="mt-2 text-xs opacity-60">
                  {new Date(notification.created_at).toLocaleString()}
                </div>
              </button>
              {notification.type === 'group_invite' && !notification.is_read && acceptGroupInvitation ? (<div className="mt-3 flex gap-2">
                  <button onClick={() => void acceptGroupInvitation(notification)} className="rounded-lg bg-green-500 px-3 py-2 text-xs font-medium text-slate-900 hover:bg-green-600">
                    Accept Invite
                  </button>
                  {rejectGroupInvitation ? (<button onClick={() => void rejectGroupInvitation(notification)} className="rounded-lg bg-red-500/80 px-3 py-2 text-xs font-medium text-slate-900 hover:bg-red-600">
                      Decline
                    </button>) : null}
                </div>) : null}
            </div>))}
        </div>) : (<div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
          No notifications yet.
        </div>)}
    </div>);
}
