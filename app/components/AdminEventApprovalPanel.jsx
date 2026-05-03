'use client';

import { useState, useEffect, useCallback } from 'react';

const STATUS_BADGE = {
  PENDING_COORDINATOR_APPROVAL: { label: 'Pending Coordinator', color: 'bg-white/10 text-white/55 border-white/10' },
  APPROVED_BY_COORDINATOR:      { label: 'Awaiting Admin',      color: 'bg-amber-500/20 text-amber-200 border-amber-400/30' },
  REJECTED_BY_COORDINATOR:      { label: 'Coordinator Rejected',color: 'bg-red-500/15 text-red-300 border-red-400/25' },
  APPROVED:                     { label: 'Published ✓',         color: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' },
  REJECTED_BY_ADMIN:            { label: 'Admin Rejected',      color: 'bg-red-500/15 text-red-300 border-red-400/25' },
  WITHDRAWN:                    { label: 'Withdrawn',           color: 'bg-white/10 text-white/45 border-white/10' },
};

function EmptyState({ title }) {
  return (
    <div className="rounded-[1.2rem] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
      {title}
    </div>
  );
}

function AdminEventCard({ event, onAction }) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handle = async (action) => {
    if (action === 'reject' && !reason.trim()) { setMsg('Rejection reason is required.'); return; }
    setLoading(true); setMsg('');
    const res = await fetch(`/api/admin/events/${event.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason: reason.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      onAction?.(event.id, action);
    } else {
      setMsg(data.error || 'Action failed.');
    }
    setLoading(false);
  };

  const badge = STATUS_BADGE[event.status] || { label: event.status, color: 'bg-white/10 text-white/50' };
  const coordinator = event.coordinator?.coordinator || event.club?.coordinator;

  return (
    <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-bold text-white">{event.title}</h4>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-white/55">
            <span>🏛️ {event.club?.club_name}</span>
            {coordinator && <span>👤 Coordinator: {coordinator.display_name || coordinator.full_name}</span>}
          </div>
          {event.description && <p className="mt-2 text-sm text-white/65 max-w-xl">{event.description}</p>}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${badge.color}`}>{badge.label}</span>
      </div>
      <div className="mt-4 grid gap-2 grid-cols-2 md:grid-cols-4 text-xs text-white/60">
        <div><span className="text-white/40 block">Date</span>{event.proposed_date}</div>
        <div><span className="text-white/40 block">Time</span>{event.time_start} – {event.time_end}</div>
        <div><span className="text-white/40 block">Venue</span>{event.venue || 'TBD'}</div>
        <div><span className="text-white/40 block">Expected</span>{event.expected_participants} participants</div>
      </div>
      {event.approvals?.length > 0 && (
        <div className="mt-3 space-y-1">
          {event.approvals.map((a, i) => (
            <div key={i} className="text-xs text-white/45">
              {a.actor_role === 'coordinator' ? '👤' : '🔑'} {a.actor_role} → {a.action}
              {a.reason && ` — "${a.reason}"`}
            </div>
          ))}
        </div>
      )}
      {event.status === 'APPROVED_BY_COORDINATOR' && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => void handle('approve')}
            disabled={loading}
            className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Approve & Publish
          </button>
          <button
            onClick={() => setShowReject(!showReject)}
            className="rounded-[1rem] border border-red-400/30 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-200"
          >
            Reject
          </button>
        </div>
      )}
      {showReject && (
        <div className="mt-3 space-y-2">
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for rejection (required)…"
            rows={3}
            className="campus-input w-full rounded-[1rem] px-4 py-3 text-sm"
          />
          <button
            onClick={() => void handle('reject')}
            disabled={loading || !reason.trim()}
            className="rounded-[1rem] bg-red-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Confirm Rejection
          </button>
        </div>
      )}
      {msg && <div className="mt-3 text-sm text-red-300">{msg}</div>}
    </div>
  );
}

export default function AdminEventApprovalPanel() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  const load = useCallback(async (all = false) => {
    setLoading(true);
    const res = await fetch(`/api/admin/events${all ? '?all=true' : ''}`);
    const data = await res.json();
    if (res.ok) setEvents(data.events || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(activeTab === 'all'), 0);
    return () => clearTimeout(t);
  }, [load, activeTab]);

  const handleAction = (eventId) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
  };

  const pending = events.filter(e => e.status === 'APPROVED_BY_COORDINATOR');

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2">
          {[['pending', `Awaiting Approval (${pending.length})`], ['all', 'All Events']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === key
                  ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950'
                  : 'border border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => void load(activeTab === 'all')} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white">
          Refresh
        </button>
      </div>
      {loading ? (
        <EmptyState title="Loading events…" />
      ) : activeTab === 'pending' ? (
        pending.length === 0
          ? <EmptyState title="No events awaiting admin approval." />
          : <div className="space-y-4">{pending.map(e => <AdminEventCard key={e.id} event={e} onAction={handleAction} />)}</div>
      ) : (
        events.length === 0
          ? <EmptyState title="No events found." />
          : <div className="space-y-4">{events.map(e => <AdminEventCard key={e.id} event={e} />)}</div>
      )}
    </div>
  );
}
