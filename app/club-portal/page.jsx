'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

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

const EMPTY_FORM = {
  title: '', description: '', proposed_date: '',
  time_start: '', time_end: '', venue: '', expected_participants: '',
};

// ─── EventForm defined OUTSIDE the main component to avoid remount on re-render ─────
function EventForm({ isEdit, form, setForm, editingEvent, formMsg, formErr, submitting, onSubmit, onCancel }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white">
        {isEdit ? 'Edit & Re-submit Event' : 'Submit New Event Proposal'}
      </h3>

      {isEdit && editingEvent?.rejection_reason && (
        <div className="rounded-[1rem] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <strong>Rejection reason:</strong> {editingEvent.rejection_reason}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-white/50">Event Title *</label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Event title"
            className="campus-input w-full rounded-[1rem] px-4 py-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Venue</label>
          <input
            value={form.venue}
            onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
            placeholder="Venue (optional)"
            className="campus-input w-full rounded-[1rem] px-4 py-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Event Date *</label>
          <input
            type="date"
            value={form.proposed_date}
            onChange={e => setForm(f => ({ ...f, proposed_date: e.target.value }))}
            className="campus-input w-full rounded-[1rem] px-4 py-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Expected Participants</label>
          <input
            type="number"
            min="0"
            value={form.expected_participants}
            onChange={e => setForm(f => ({ ...f, expected_participants: e.target.value }))}
            placeholder="Expected participants"
            className="campus-input w-full rounded-[1rem] px-4 py-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Start Time *</label>
          <input
            type="time"
            value={form.time_start}
            onChange={e => setForm(f => ({ ...f, time_start: e.target.value }))}
            className="campus-input w-full rounded-[1rem] px-4 py-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">End Time *</label>
          <input
            type="time"
            value={form.time_end}
            onChange={e => setForm(f => ({ ...f, time_end: e.target.value }))}
            className="campus-input w-full rounded-[1rem] px-4 py-3"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-white/50">Description</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Event description"
          rows={4}
          className="campus-input w-full rounded-[1rem] px-4 py-3"
        />
      </div>

      {formMsg && (
        <div className="rounded-[1rem] border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          {formMsg}
        </div>
      )}
      {formErr && (
        <div className="rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {formErr}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onSubmit}
          disabled={submitting || !form.title.trim() || !form.proposed_date || !form.time_start || !form.time_end}
          className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting…' : isEdit ? 'Re-submit Event' : 'Submit Proposal'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-[1rem] border border-white/10 bg-white/10 px-6 py-3 text-sm text-white hover:bg-white/15"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Club Portal Page ────────────────────────────────────────────────────
export default function ClubPortalPage() {
  const router = useRouter();
  const [club, setClub] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [dashTab, setDashTab] = useState('events'); // 'events' | 'submit' | 'edit'
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingEvent, setEditingEvent] = useState(null);
  const [expandedEventId, setExpandedEventId] = useState(null);
  const [formMsg, setFormMsg] = useState('');
  const [formErr, setFormErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Session check on mount ──────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/clubs/login', { method: 'GET' })
      .then(res => res.json())
      .then(data => {
        if (data.club) {
          setClub(data.club);
        } else {
          router.replace('/auth?role=club');
        }
      })
      .catch(() => router.replace('/auth?role=club'))
      .finally(() => setSessionChecked(true));
  }, [router]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await fetch('/api/clubs/events');
      const data = await res.json();
      if (res.ok) setEvents(data.events || []);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (club) void loadEvents();
  }, [club, loadEvents]);

  // ── Form submit ─────────────────────────────────────────────────────────────
  const handleFormSubmit = async () => {
    setFormMsg(''); setFormErr(''); setSubmitting(true);
    const isEdit = dashTab === 'edit';
    const url = isEdit ? `/api/clubs/events/${editingEvent.id}` : '/api/clubs/events';
    const method = isEdit ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          expected_participants: Number(form.expected_participants) || 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFormMsg(isEdit ? 'Event re-submitted successfully.' : 'Event proposal submitted!');
        setForm(EMPTY_FORM);
        setEditingEvent(null);
        setTimeout(() => {
          setDashTab('events');
          setFormMsg('');
          void loadEvents();
        }, 1500);
      } else {
        setFormErr(data.error || 'Submission failed.');
      }
    } catch {
      setFormErr('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
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

  const handleLogout = async () => {
    await fetch('/api/clubs/login', { method: 'DELETE' }).catch(() => {});
    router.replace('/auth?role=club');
  };

  const handleCancelForm = () => {
    setForm(EMPTY_FORM);
    setEditingEvent(null);
    setFormMsg(''); setFormErr('');
    setDashTab('events');
  };

  // ── Loading / redirect state ────────────────────────────────────────────────
  if (!sessionChecked) {
    return (
      <div className="campus-shell min-h-screen flex items-center justify-center">
        <div className="text-white/50 text-sm">Loading club portal…</div>
      </div>
    );
  }
  if (!club) return null;

  // ── Dashboard ───────────────────────────────────────────────────────────────
  return (
    <div className="campus-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div className="campus-panel-strong rounded-[2rem] p-8 flex items-center justify-between">
          <div>
            <div className="campus-kicker">Club Portal</div>
            <h1 className="mt-2 text-3xl font-bold text-white">{club.club_name}</h1>
            <p className="mt-1 text-sm text-white/55">Manage your event proposals and track their approval status.</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-full border border-red-300/20 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-100 hover:bg-red-500/20"
          >
            Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="campus-panel rounded-[1.5rem] p-3 flex gap-2">
          {[['events', 'My Events'], ['submit', '+ Submit Event']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setDashTab(key); setFormMsg(''); setFormErr(''); }}
              className={`rounded-[1rem] px-5 py-3 text-sm font-medium transition ${
                dashTab === key ? 'campus-button text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="campus-panel rounded-[1.7rem] p-6">

          {/* Submit / Edit form */}
          {(dashTab === 'submit' || dashTab === 'edit') && (
            <EventForm
              isEdit={dashTab === 'edit'}
              form={form}
              setForm={setForm}
              editingEvent={editingEvent}
              formMsg={formMsg}
              formErr={formErr}
              submitting={submitting}
              onSubmit={handleFormSubmit}
              onCancel={handleCancelForm}
            />
          )}

          {/* Events list */}
          {dashTab === 'events' && (
            eventsLoading ? (
              <div className="text-center text-white/45 py-8">Loading events…</div>
            ) : events.length === 0 ? (
              <div className="text-center text-white/45 py-12">
                <div className="text-4xl mb-3">📋</div>
                <p>No events submitted yet.</p>
                <button
                  onClick={() => setDashTab('submit')}
                  className="mt-4 rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950"
                >
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
                          {event.description && (
                            <p className="mt-1 text-sm text-white/60 max-w-xl">{event.description}</p>
                          )}
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusColor}`}>
                          {statusLabel}
                        </span>
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
                      <div className="mt-4 flex flex-wrap gap-2 justify-between">
                        <div className="flex gap-2">
                          {canEdit && (
                            <button
                              onClick={() => startEdit(event)}
                              className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950"
                            >
                              Edit & Re-submit
                            </button>
                          )}
                          {canWithdraw && (
                            <button
                              onClick={() => void handleWithdraw(event.id)}
                              className="rounded-[1rem] border border-red-400/25 bg-red-500/10 px-4 py-2 text-xs text-red-200"
                            >
                              Withdraw
                            </button>
                          )}
                        </div>
                        {event.registrations && event.registrations.length > 0 && (
                          <button
                            onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
                            className="rounded-[1rem] border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-200"
                          >
                            {expandedEventId === event.id ? 'Hide Registrations' : `View Registrations (${event.registrations.length})`}
                          </button>
                        )}
                      </div>
                      {expandedEventId === event.id && event.registrations?.length > 0 && (
                        <div className="mt-4 rounded-[1rem] bg-black/20 p-4 border border-white/5">
                          <h4 className="text-sm font-semibold text-white mb-3">Registered Students</h4>
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 campus-scroll">
                            {event.registrations.map(reg => {
                              const p = reg.profile || {};
                              return (
                                <div key={reg.student_id} className="flex justify-between items-center bg-white/5 rounded-lg p-3 text-xs border border-white/5">
                                  <div>
                                    <div className="font-semibold text-white">{p.full_name || p.display_name || 'Student'}</div>
                                    <div className="text-white/60 mt-0.5">{p.roll_number || 'N/A'} • {p.course || 'N/A'} {p.branch ? `(${p.branch})` : ''}</div>
                                  </div>
                                  <div className="text-white/40">
                                    {new Date(reg.registered_at).toLocaleDateString()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
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
