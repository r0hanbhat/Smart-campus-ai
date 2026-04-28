'use client';

import { useState, useEffect, useCallback } from 'react';

const STATUS_COLORS = {
  PENDING_COORDINATOR_APPROVAL: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
  APPROVED_BY_COORDINATOR:      'bg-cyan-500/20 text-cyan-200 border-cyan-400/30',
  REJECTED_BY_COORDINATOR:      'bg-red-500/15 text-red-300 border-red-400/25',
  APPROVED:                     'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
  REJECTED_BY_ADMIN:            'bg-red-500/15 text-red-300 border-red-400/25',
  WITHDRAWN:                    'bg-white/10 text-white/50 border-white/10',
};
const STATUS_LABELS = {
  PENDING_COORDINATOR_APPROVAL: 'Awaiting Coordinator',
  APPROVED_BY_COORDINATOR:      'Awaiting Admin',
  REJECTED_BY_COORDINATOR:      'Rejected by Coordinator',
  APPROVED:                     'Published ✓',
  REJECTED_BY_ADMIN:            'Rejected by Admin',
  WITHDRAWN:                    'Withdrawn',
};

const EMPTY_FORM = { title: '', description: '', proposed_date: '', time_start: '', time_end: '', venue: '', expected_participants: '' };

export default function ClubPortalPage() {
  const [view, setView] = useState('login'); // 'login' | 'dashboard'
  const [club, setClub] = useState(null);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [dashTab, setDashTab] = useState('events'); // 'events' | 'submit' | 'edit'
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formMsg, setFormMsg] = useState('');
  const [formErr, setFormErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    const res = await fetch('/api/clubs/events');
    const data = await res.json();
    if (res.ok) setEvents(data.events || []);
    setEventsLoading(false);
  }, []);

  useEffect(() => {
    if (view === 'dashboard') void loadEvents();
  }, [view, loadEvents]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(''); setLoginLoading(true);
    const res = await fetch('/api/clubs/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_id: loginId, password }),
    });
    const data = await res.json();
    if (res.ok) {
      setClub(data.club);
      setView('dashboard');
    } else {
      setLoginError(data.error || 'Login failed.');
    }
    setLoginLoading(false);
  };

  const handleSubmit = async (isEdit = false) => {
    setFormMsg(''); setFormErr(''); setSubmitting(true);
    const url = isEdit ? `/api/clubs/events/${editingEvent.id}` : '/api/clubs/events';
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, expected_participants: Number(form.expected_participants) || 0 }),
    });
    const data = await res.json();
    if (res.ok) {
      setFormMsg(isEdit ? 'Event re-submitted successfully.' : 'Event proposal submitted!');
      setForm(EMPTY_FORM);
      setEditingEvent(null);
      setDashTab('events');
      void loadEvents();
    } else {
      setFormErr(data.error || 'Submission failed.');
    }
    setSubmitting(false);
  };

  const handleWithdraw = async (eventId) => {
    if (!confirm('Withdraw this event?')) return;
    await fetch(`/api/clubs/events/${eventId}`, { method: 'DELETE' });
    void loadEvents();
  };

  const startEdit = (event) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description || '',
      proposed_date: event.proposed_date,
      time_start: event.time_start,
      time_end: event.time_end,
      venue: event.venue || '',
      expected_participants: event.expected_participants || '',
    });
    setFormMsg(''); setFormErr('');
    setDashTab('edit');
  };

  if (view === 'login') {
    return (
      <div className="campus-shell min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="campus-panel-strong rounded-[2rem] p-8">
            <div className="campus-kicker">Club Portal</div>
            <h1 className="mt-3 text-3xl font-bold text-white">Club Login</h1>
            <p className="mt-2 text-sm text-white/55">Sign in with your club credentials to submit and track event proposals.</p>
            <form onSubmit={handleLogin} className="mt-8 space-y-4">
              <input
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                placeholder="Club Login ID"
                required
                className="campus-input w-full rounded-[1rem] px-4 py-3"
              />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="campus-input w-full rounded-[1rem] px-4 py-3"
              />
              {loginError && (
                <div className="rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{loginError}</div>
              )}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {loginLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const EventForm = ({ isEdit }) => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white">{isEdit ? 'Edit & Re-submit Event' : 'Submit New Event Proposal'}</h3>
      {isEdit && editingEvent?.rejection_reason && (
        <div className="rounded-[1rem] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <strong>Rejection reason:</strong> {editingEvent.rejection_reason}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title *" className="campus-input rounded-[1rem] px-4 py-3" />
        <input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder="Venue (optional)" className="campus-input rounded-[1rem] px-4 py-3" />
        <input type="date" value={form.proposed_date} onChange={e => setForm(f => ({ ...f, proposed_date: e.target.value }))} className="campus-input rounded-[1rem] px-4 py-3" />
        <input type="number" min="0" value={form.expected_participants} onChange={e => setForm(f => ({ ...f, expected_participants: e.target.value }))} placeholder="Expected participants" className="campus-input rounded-[1rem] px-4 py-3" />
        <input type="time" value={form.time_start} onChange={e => setForm(f => ({ ...f, time_start: e.target.value }))} placeholder="Start time *" className="campus-input rounded-[1rem] px-4 py-3" />
        <input type="time" value={form.time_end} onChange={e => setForm(f => ({ ...f, time_end: e.target.value }))} placeholder="End time *" className="campus-input rounded-[1rem] px-4 py-3" />
      </div>
      <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Event description" rows={4} className="campus-input w-full rounded-[1rem] px-4 py-3" />
      {formMsg && <div className="rounded-[1rem] border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">{formMsg}</div>}
      {formErr && <div className="rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{formErr}</div>}
      <div className="flex gap-3">
        <button
          onClick={() => void handleSubmit(isEdit)}
          disabled={submitting || !form.title.trim() || !form.proposed_date || !form.time_start || !form.time_end}
          className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : isEdit ? 'Re-submit Event' : 'Submit Proposal'}
        </button>
        <button onClick={() => setDashTab('events')} className="rounded-[1rem] border border-white/10 bg-white/10 px-6 py-3 text-sm text-white">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="campus-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="campus-panel-strong rounded-[2rem] p-8 flex items-center justify-between">
          <div>
            <div className="campus-kicker">Club Portal</div>
            <h1 className="mt-2 text-3xl font-bold text-white">{club?.club_name}</h1>
            <p className="mt-1 text-sm text-white/55">Manage your event proposals and track their approval status.</p>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/clubs/login', { method: 'DELETE' }).catch(() => {});
              setClub(null); setView('login');
            }}
            className="rounded-full border border-red-300/20 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-100 hover:bg-red-500/20"
          >
            Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="campus-panel rounded-[1.5rem] p-3 flex gap-2">
          {[['events', 'My Events'], ['submit', '+ Submit Event']].map(([key, label]) => (
            <button key={key} onClick={() => setDashTab(key)}
              className={`rounded-[1rem] px-5 py-3 text-sm font-medium transition ${dashTab === key ? 'campus-button text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="campus-panel rounded-[1.7rem] p-6">
          {dashTab === 'submit' && <EventForm isEdit={false} />}
          {dashTab === 'edit' && <EventForm isEdit={true} />}
          {dashTab === 'events' && (
            eventsLoading ? (
              <div className="text-center text-white/45 py-8">Loading events…</div>
            ) : events.length === 0 ? (
              <div className="text-center text-white/45 py-12">
                <div className="text-4xl mb-3">📋</div>
                <p>No events submitted yet.</p>
                <button onClick={() => setDashTab('submit')} className="mt-4 rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950">
                  Submit Your First Event
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map(event => {
                  const statusColor = STATUS_COLORS[event.status] || 'bg-white/10 text-white/50 border-white/10';
                  const statusLabel = STATUS_LABELS[event.status] || event.status;
                  const canEdit = ['REJECTED_BY_COORDINATOR', 'REJECTED_BY_ADMIN'].includes(event.status);
                  const canWithdraw = !['APPROVED', 'WITHDRAWN'].includes(event.status);
                  return (
                    <div key={event.id} className="rounded-[1.2rem] border border-white/10 bg-white/5 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold text-white">{event.title}</h3>
                          {event.description && <p className="mt-1 text-sm text-white/60 max-w-xl">{event.description}</p>}
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-white/55">
                        <div><span className="text-white/40 block">Date</span>{event.proposed_date}</div>
                        <div><span className="text-white/40 block">Time</span>{event.time_start} – {event.time_end}</div>
                        <div><span className="text-white/40 block">Venue</span>{event.venue || 'TBD'}</div>
                        <div><span className="text-white/40 block">Version</span>v{event.version}</div>
                      </div>
                      {event.rejection_reason && (
                        <div className="mt-3 rounded-[0.9rem] border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                          ✗ {event.rejection_reason}
                        </div>
                      )}
                      <div className="mt-4 flex gap-2">
                        {canEdit && (
                          <button onClick={() => startEdit(event)} className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950">
                            Edit & Re-submit
                          </button>
                        )}
                        {canWithdraw && (
                          <button onClick={() => void handleWithdraw(event.id)} className="rounded-[1rem] border border-red-400/25 bg-red-500/10 px-4 py-2 text-xs text-red-200">
                            Withdraw
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
