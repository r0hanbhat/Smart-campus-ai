'use client';

import { useState, useEffect, useCallback } from 'react';

const STATUS_BADGE = {
  PENDING_COORDINATOR_APPROVAL: { label: 'Pending Coordinator', color: 'bg-slate-100 text-slate-500 border-slate-200' },
  APPROVED_BY_COORDINATOR:      { label: 'Awaiting Admin',      color: 'bg-amber-500/20 text-amber-700 border-amber-400/30' },
  REJECTED_BY_COORDINATOR:      { label: 'Coordinator Rejected',color: 'bg-red-500/15 text-red-600 border-red-400/25' },
  APPROVED:                     { label: 'Published ✓',         color: 'bg-emerald-500/20 text-emerald-700 border-emerald-400/30' },
  REJECTED_BY_ADMIN:            { label: 'Admin Rejected',      color: 'bg-red-500/15 text-red-600 border-red-400/25' },
  WITHDRAWN:                    { label: 'Withdrawn',           color: 'bg-slate-100 text-slate-400 border-slate-200' },
};

function EmptyState({ title }) {
  return (
    <div className="rounded-[1.2rem] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
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

  const badge = STATUS_BADGE[event.status] || { label: event.status, color: 'bg-slate-100 text-slate-400' };
  const coordinator = event.coordinator?.coordinator || event.club?.coordinator;

  return (
    <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-bold text-slate-900">{event.title}</h4>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">
            <span>🏛️ {event.club?.club_name}</span>
            {coordinator && <span>👤 Coordinator: {coordinator.display_name || coordinator.full_name}</span>}
          </div>
          {event.description && <p className="mt-2 text-sm text-slate-500 max-w-xl">{event.description}</p>}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${badge.color}`}>{badge.label}</span>
      </div>
      <div className="mt-4 grid gap-2 grid-cols-2 md:grid-cols-4 text-xs text-slate-500">
        <div><span className="text-slate-400 block">Date</span>{event.proposed_date}</div>
        <div><span className="text-slate-400 block">Time</span>{event.time_start} – {event.time_end}</div>
        <div><span className="text-slate-400 block">Venue</span>{event.venue || 'TBD'}</div>
        <div><span className="text-slate-400 block">Expected</span>{event.expected_participants} participants</div>
      </div>
      {event.approvals?.length > 0 && (
        <div className="mt-4 rounded-[1rem] border border-slate-200 bg-white/[0.04] p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Approval History</div>
          <div className="space-y-2">
            {event.approvals.map((a, i) => {
              const isCoord = a.actor_role === 'coordinator';
              const actionColor = a.action === 'approve'
                ? 'bg-emerald-500/15 text-emerald-700 border-emerald-400/25'
                : a.action === 'reject'
                  ? 'bg-red-500/15 text-red-600 border-red-400/25'
                  : 'bg-slate-100 text-slate-500 border-slate-200';
              return (
                <div key={i} className="flex flex-wrap items-start gap-3 rounded-[0.8rem] border border-white/[0.07] bg-slate-100 px-4 py-3">
                  <span className="mt-0.5 text-base">{isCoord ? '👤' : '🔑'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-700 capitalize">{a.actor_role}</span>
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${actionColor}`}>{a.action}</span>
                    </div>
                    {a.reason && <div className="mt-1 text-xs text-slate-500 italic">&ldquo;{a.reason}&rdquo;</div>}
                  </div>
                  {a.acted_at && (
                    <div className="text-xs text-slate-400 whitespace-nowrap">
                      {new Date(a.acted_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {event.status === 'APPROVED_BY_COORDINATOR' && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => void handle('approve')}
            disabled={loading}
            className="rounded-[1rem] bg-gradient-to-r from-sky-500 to-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Approve & Publish
          </button>
          <button
            onClick={() => setShowReject(!showReject)}
            className="rounded-[1rem] border border-red-400/30 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-600"
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
            className="rounded-[1rem] bg-red-500 px-5 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50"
          >
            Confirm Rejection
          </button>
        </div>
      )}
      {msg && <div className="mt-3 text-sm text-red-600">{msg}</div>}
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
                  ? 'bg-gradient-to-r from-sky-500 to-emerald-400 text-slate-950'
                  : 'border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => void load(activeTab === 'all')} className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-900">
          Refresh
        </button>
      </div>
      {loading ? (
        <EmptyState title="Loading events…" />
      ) : activeTab === 'pending' ? (
        pending.length === 0
          ? <EmptyState title="No events awaiting admin approval." />
          : <div className="campus-scroll max-h-[28rem] space-y-4 overflow-y-auto pr-1">{pending.map(e => <AdminEventCard key={e.id} event={e} onAction={handleAction} />)}</div>
      ) : (
        events.length === 0
          ? <EmptyState title="No events found." />
          : <div className="campus-scroll max-h-[28rem] space-y-4 overflow-y-auto pr-1">{events.map(e => <AdminEventCard key={e.id} event={e} />)}</div>
      )}
    </div>
  );
}
