'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const POSITION_HOLDERS = ['President', 'Vice President', 'Secretary', 'Treasurer'];
const GROUP_ICONS = { announcement: '📢', official: '🏛️', unofficial: '💬' };
const GROUP_COLORS = {
  announcement: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  official: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200',
  unofficial: 'border-purple-400/30 bg-purple-500/10 text-purple-200',
};

function AcknowledgeButton({ message, onAcknowledge }) {
  const [loading, setLoading] = useState(false);
  const [localAcked, setLocalAcked] = useState(message.user_acknowledged);
  const [ackCount, setAckCount] = useState(message.ack_count ?? 0);

  const handleAck = async () => {
    if (localAcked || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/jcufa/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: message.id }),
      });
      if (res.ok) {
        setLocalAcked(true);
        setAckCount(prev => prev + 1);
        onAcknowledge?.(message.id);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 flex items-center gap-3 flex-wrap">
      <button
        onClick={handleAck}
        disabled={localAcked || loading}
        className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
          localAcked
            ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 cursor-default'
            : 'bg-amber-500/15 border border-amber-400/30 text-amber-200 hover:bg-amber-500/25'
        }`}
      >
        {localAcked ? '✓ Acknowledged' : loading ? 'Acknowledging…' : 'Acknowledge'}
      </button>
      <AckTally messageId={message.id} initialCount={ackCount} />
    </div>
  );
}

function AckTally({ messageId, initialCount }) {
  const [detail, setDetail] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [total, setTotal] = useState(0);

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/jcufa/acknowledgments?message_id=${messageId}`);
    if (!res.ok) return;
    const data = await res.json();
    setCount(data.ack_count ?? 0);
    setTotal(data.total_members ?? 0);
    if (data.acknowledged) setDetail(data); // position holder gets full detail
  }, [messageId]);

  useEffect(() => {
    const t = setTimeout(() => void fetchDetail(), 0);
    return () => clearTimeout(t);
  }, [fetchDetail]);

  return (
    <>
      <button
        onClick={() => { void fetchDetail(); setShowModal(true); }}
        className="text-xs text-white/50 hover:text-white/80 transition underline underline-offset-2"
      >
        {count} / {total || '?'} Acknowledged
      </button>
      {showModal && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[1.8rem] border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Acknowledgment Status</h3>
              <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-white">✕</button>
            </div>
            <div className="flex gap-2 mb-4">
              <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs text-emerald-300">
                ✓ Acknowledged: {detail.acknowledged?.length ?? 0}
              </span>
              <span className="rounded-full bg-red-500/15 border border-red-400/25 px-3 py-1 text-xs text-red-300">
                Pending: {detail.pending?.length ?? 0}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 max-h-72 overflow-y-auto">
              <div>
                <div className="text-xs uppercase tracking-widest text-white/40 mb-2">Acknowledged</div>
                {(detail.acknowledged || []).length === 0
                  ? <div className="text-sm text-white/40">None yet</div>
                  : (detail.acknowledged || []).map(a => (
                    <div key={a.user_id} className="text-sm text-white/75 py-1 border-b border-white/5">
                      {a.user?.display_name || a.user?.full_name || 'Teacher'}
                    </div>
                  ))}
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-white/40 mb-2">Pending</div>
                {(detail.pending || []).length === 0
                  ? <div className="text-sm text-emerald-400">Everyone acknowledged!</div>
                  : (detail.pending || []).map(m => (
                    <div key={m.user_id} className="text-sm text-white/75 py-1 border-b border-white/5">
                      {m.display_name || m.full_name || 'Teacher'}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ msg, isOwn, isAnnouncement }) {
  const senderName = msg.sender?.display_name || msg.sender?.full_name || 'Teacher';
  const position = msg.sender?.jcufa_position;
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[78%] rounded-[1.4rem] px-4 py-3 shadow-lg ${
        isOwn ? 'campus-button text-white' : 'campus-soft-card text-white'
      }`}>
        {!isOwn && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-cyan-300">{senderName}</span>
            {position && (
              <span className="rounded-full bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 text-[10px] text-amber-200">{position}</span>
            )}
          </div>
        )}
        <p className="text-sm leading-6 whitespace-pre-wrap">{msg.content}</p>
        <div className="mt-1 text-[10px] text-white/40">
          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {msg.updated_at && ' (edited)'}
        </div>
        {isAnnouncement && <AcknowledgeButton message={msg} />}
      </div>
    </div>
  );
}

export default function JcufaChatPanel({ userId, userProfile }) {
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const supabase = createClient();

  const isPositionHolder = POSITION_HOLDERS.includes(userProfile?.jcufa_position);
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const canSend = activeGroup?.type !== 'announcement' || isPositionHolder;

  // Load groups
  useEffect(() => {
    fetch('/api/jcufa/groups')
      .then(r => r.json())
      .then(data => {
        if (data.groups?.length > 0) {
          setGroups(data.groups);
          setActiveGroupId(data.groups[0].id);
        }
      })
      .catch(() => setError('Failed to load JCUFA groups.'));
  }, []);

  // Load messages when group changes
  const loadMessages = useCallback(async (groupId) => {
    if (!groupId) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/jcufa/messages?group_id=${groupId}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      setError('Failed to load messages.');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (activeGroupId) void loadMessages(activeGroupId);
  }, [activeGroupId, loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!activeGroupId) return;
    const channel = supabase
      .channel(`jcufa-messages-${activeGroupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'jcufa_messages',
        filter: `group_id=eq.${activeGroupId}`,
      }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, { ...payload.new, ack_count: 0, user_acknowledged: false }];
        });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [activeGroupId, supabase]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending || !activeGroupId) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/jcufa/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: activeGroupId, content }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send.'); return; }
      setMessages(prev => {
        if (prev.some(m => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
    } catch {
      setError('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  if (!userProfile?.jcufa_position) {
    return (
      <div className="campus-panel rounded-[1.7rem] p-8 text-center">
        <div className="text-4xl mb-3">🏛️</div>
        <h3 className="text-xl font-bold text-white">JCUFA Portal</h3>
        <p className="mt-2 text-sm text-white/55">Your account is not currently assigned a JCUFA position. Contact the Admin to be added to the faculty association.</p>
      </div>
    );
  }

  return (
    <div className="campus-panel rounded-[1.7rem] overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-5">
        <div className="campus-kicker">Faculty Association</div>
        <h2 className="mt-2 text-2xl font-bold text-white">JCUFA Portal</h2>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm text-white/55">Signed in as {userProfile.display_name || userProfile.full_name}</span>
          {userProfile.jcufa_position && (
            <span className="rounded-full bg-amber-500/20 border border-amber-400/30 px-2.5 py-0.5 text-xs text-amber-200">
              {userProfile.jcufa_position}
            </span>
          )}
        </div>
      </div>

      {/* Group tabs */}
      <div className="flex gap-2 border-b border-white/10 px-4 py-3 overflow-x-auto">
        {groups.map(g => (
          <button
            key={g.id}
            onClick={() => setActiveGroupId(g.id)}
            className={`flex shrink-0 items-center gap-2 rounded-[1rem] px-4 py-2.5 text-sm font-medium transition ${
              activeGroupId === g.id
                ? `campus-button text-white`
                : 'bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span>{GROUP_ICONS[g.type]}</span>
            <span>{g.name}</span>
            {g.type === 'announcement' && (
              <span className="rounded-full bg-amber-500/25 px-1.5 py-0.5 text-[10px] text-amber-200">Official</span>
            )}
          </button>
        ))}
      </div>

      {/* Group description bar */}
      {activeGroup && (
        <div className={`border-b border-white/5 px-5 py-2.5 text-xs ${GROUP_COLORS[activeGroup.type]}`}>
          {activeGroup.type === 'announcement'
            ? '📢 Announcements only — position holders post, all members acknowledge'
            : activeGroup.type === 'official'
              ? '🏛️ Official Discussion — all JCUFA members can participate'
              : '💬 Unofficial — casual conversation for all members'}
        </div>
      )}

      {/* Messages area */}
      <div className="flex flex-col" style={{ height: '55vh' }}>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 campus-scroll">
          {loadingMessages ? (
            <div className="flex justify-center py-8 text-white/45 text-sm">Loading messages…</div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/35 text-sm gap-2">
              <span className="text-3xl">{GROUP_ICONS[activeGroup?.type] || '💬'}</span>
              <span>No messages yet. Start the conversation.</span>
            </div>
          ) : (
            messages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isOwn={msg.sender_id === userId}
                isAnnouncement={activeGroup?.type === 'announcement'}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-white/10 bg-black/20 px-4 py-3 backdrop-blur-md">
          {error && (
            <div className="mb-2 rounded-[0.8rem] border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
          )}
          {canSend ? (
            <div className="flex gap-3">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && void handleSend()}
                placeholder={
                  activeGroup?.type === 'announcement'
                    ? 'Post an official announcement…'
                    : activeGroup?.type === 'official'
                      ? 'Start a formal discussion…'
                      : 'Say something…'
                }
                className="campus-input flex-1 rounded-[1rem] px-4 py-3 text-sm"
                disabled={sending}
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="campus-button rounded-[1rem] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {sending ? '…' : 'Send'}
              </button>
            </div>
          ) : (
            <div className="rounded-[1rem] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/80 text-center">
              Only JCUFA position holders (President, Vice President, Secretary, Treasurer) can post in the Announcements group.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
