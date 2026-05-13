'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_COLORS = {
  PENDING_COORDINATOR_APPROVAL: 'bg-amber-500/20 text-amber-700 border-amber-400/30',
  APPROVED_BY_COORDINATOR:      'bg-sky-500/20 text-sky-700 border-sky-400/30',
  REJECTED_BY_COORDINATOR:      'bg-red-500/15 text-red-600 border-red-400/25',
  APPROVED:                     'bg-emerald-500/20 text-emerald-700 border-emerald-400/30',
  REJECTED_BY_ADMIN:            'bg-red-500/15 text-red-600 border-red-400/25',
  WITHDRAWN:                    'bg-slate-100 text-slate-400 border-slate-200',
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
  title: '', description: '', proposed_date: '', event_end_date: '',
  time_start: '', time_end: '', venue: '', expected_participants: '',
  registration_starts: '',
};

// ─── EventForm defined OUTSIDE the main component to avoid remount on re-render ─────
function EventForm({ isEdit, form, setForm, editingEvent, formMsg, formErr, submitting, onSubmit, onCancel }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-slate-900">
        {isEdit ? 'Edit & Re-submit Event' : 'Submit New Event Proposal'}
      </h3>

      {isEdit && editingEvent?.rejection_reason && (
        <div className="rounded-[1rem] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          <strong>Rejection reason:</strong> {editingEvent.rejection_reason}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-slate-400">Event Title *</label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Event title"
            className="campus-input w-full rounded-[1rem] px-4 py-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Venue</label>
          <input
            value={form.venue}
            onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
            placeholder="Venue (optional)"
            className="campus-input w-full rounded-[1rem] px-4 py-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Event Start Date *</label>
          <input
            type="date"
            value={form.proposed_date}
            onChange={e => setForm(f => ({ ...f, proposed_date: e.target.value }))}
            className="campus-input w-full rounded-[1rem] px-4 py-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Event End Date *</label>
          <input
            type="date"
            value={form.event_end_date}
            onChange={e => setForm(f => ({ ...f, event_end_date: e.target.value }))}
            min={form.proposed_date || undefined}
            className="campus-input w-full rounded-[1rem] px-4 py-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Expected Participants</label>
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
          <label className="mb-1 block text-xs text-slate-400">Start Time *</label>
          <input
            type="time"
            value={form.time_start}
            onChange={e => setForm(f => ({ ...f, time_start: e.target.value }))}
            className="campus-input w-full rounded-[1rem] px-4 py-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">End Time *</label>
          <input
            type="time"
            value={form.time_end}
            onChange={e => setForm(f => ({ ...f, time_end: e.target.value }))}
            className="campus-input w-full rounded-[1rem] px-4 py-3"
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-slate-400">Registration Opens (Date & Time) *</label>
          <input
            type="datetime-local"
            value={form.registration_starts}
            onChange={e => setForm(f => ({ ...f, registration_starts: e.target.value }))}
            className="campus-input w-full rounded-[1rem] px-4 py-3"
          />
          <p className="mt-1 text-[11px] text-slate-400">Students can register for this event starting from this date & time (after admin approval).</p>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-400">Description</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Event description"
          rows={4}
          className="campus-input w-full rounded-[1rem] px-4 py-3"
        />
      </div>

      {formMsg && (
        <div className="rounded-[1rem] border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-700">
          {formMsg}
        </div>
      )}
      {formErr && (
        <div className="rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {formErr}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onSubmit}
          disabled={submitting || !form.title.trim() || !form.proposed_date || !form.time_start || !form.time_end}
          className="rounded-[1rem] bg-gradient-to-r from-sky-500 to-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting…' : isEdit ? 'Re-submit Event' : 'Submit Proposal'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-[1rem] border border-slate-200 bg-slate-100 px-6 py-3 text-sm text-slate-900 hover:bg-slate-200"
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
  const [registrationModalEvent, setRegistrationModalEvent] = useState(null);
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

  useEffect(() => {
    if (!registrationModalEvent) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setRegistrationModalEvent(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [registrationModalEvent]);

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
          registration_starts: form.registration_starts ? new Date(form.registration_starts).toISOString() : null,
          event_end_date: form.event_end_date || form.proposed_date || null,
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
      event_end_date: event.event_end_date || '',
      time_start: event.time_start,
      time_end: event.time_end,
      venue: event.venue || '',
      expected_participants: event.expected_participants || '',
      registration_starts: event.registration_starts ? new Date(event.registration_starts).toISOString().slice(0, 16) : '',
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

  const openRegistrationsModal = (event) => {
    setRegistrationModalEvent(event);
  };

  const closeRegistrationsModal = () => {
    setRegistrationModalEvent(null);
  };

  // ── Loading / redirect state ────────────────────────────────────────────────
  if (!sessionChecked) {
    return (
      <div className="campus-shell min-h-screen flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading club portal…</div>
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
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{club.club_name}</h1>
            <p className="mt-1 text-sm text-slate-500">Manage your event proposals and track their approval status.</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-full border border-red-300/20 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-500/20"
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
                dashTab === key ? 'campus-button text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
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
              <div className="text-center text-slate-400 py-8">Loading events…</div>
            ) : events.length === 0 ? (
              <div className="text-center text-slate-400 py-12">
                <div className="text-4xl mb-3">📋</div>
                <p>No events submitted yet.</p>
                <button
                  onClick={() => setDashTab('submit')}
                  className="mt-4 rounded-[1rem] bg-gradient-to-r from-sky-500 to-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950"
                >
                  Submit Your First Event
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map(event => {
                  const statusColor = STATUS_COLORS[event.status] || 'bg-slate-100 text-slate-400 border-slate-200';
                  const statusLabel = STATUS_LABELS[event.status] || event.status;
                  const canEdit = ['REJECTED_BY_COORDINATOR', 'REJECTED_BY_ADMIN'].includes(event.status);
                  const canWithdraw = !['APPROVED', 'WITHDRAWN'].includes(event.status);
                  return (
                    <div key={event.id} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{event.title}</h3>
                          {event.description && (
                            <p className="mt-1 text-sm text-slate-500 max-w-xl">{event.description}</p>
                          )}
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-500">
                        <div><span className="text-slate-400 block">Start Date</span>{event.proposed_date}</div>
                        <div><span className="text-slate-400 block">End Date</span>{event.event_end_date || event.proposed_date}</div>
                        <div><span className="text-slate-400 block">Time</span>{event.time_start} – {event.time_end}</div>
                        <div><span className="text-slate-400 block">Venue</span>{event.venue || 'TBD'}</div>
                      </div>
                      {event.rejection_reason && (
                        <div className="mt-3 rounded-[0.9rem] border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-600">
                          ✗ {event.rejection_reason}
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2 justify-between">
                        <div className="flex gap-2">
                          {canEdit && (
                            <button
                              onClick={() => startEdit(event)}
                              className="rounded-[1rem] bg-gradient-to-r from-sky-500 to-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950"
                            >
                              Edit & Re-submit
                            </button>
                          )}
                          {canWithdraw && (
                            <button
                              onClick={() => void handleWithdraw(event.id)}
                              className="rounded-[1rem] border border-red-400/25 bg-red-500/10 px-4 py-2 text-xs text-red-600"
                            >
                              Withdraw
                            </button>
                          )}
                        </div>
                        {event.registrations && event.registrations.length > 0 && (
                          <button
                            onClick={() => openRegistrationsModal(event)}
                            className="rounded-[1rem] border border-sky-400/20 bg-sky-500/10 px-4 py-2 text-xs font-medium text-sky-700"
                          >
                            {
                              `View Registrations (${event.registrations.length})`
                            }
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

      {registrationModalEvent?.registrations?.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={closeRegistrationsModal} />
          <div className="campus-panel-strong relative z-10 w-full max-w-3xl rounded-[1.8rem] p-6 shadow-[0_30px_90px_rgba(7,2,18,0.45)]">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="campus-kicker">Registrations</div>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">{registrationModalEvent.title}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {registrationModalEvent.registrations.length} student{registrationModalEvent.registrations.length === 1 ? '' : 's'} registered
                </p>
              </div>
              <button
                onClick={closeRegistrationsModal}
                className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-900 hover:bg-slate-200"
              >
                Close
              </button>
            </div>

            <div className="campus-scroll mt-5 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {registrationModalEvent.registrations.map((reg, index) => {
                const profile = reg.profile || {};
                const studentName = profile.full_name || profile.display_name || 'Student';

                return (
                  <div key={`${reg.student_id}-${index}`} className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-slate-900">{studentName}</div>
                        <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                          <div>
                            <span className="block text-[11px] uppercase tracking-[0.18em] text-slate-400">Roll Number</span>
                            <span>{profile.roll_number || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="block text-[11px] uppercase tracking-[0.18em] text-slate-400">Branch</span>
                            <span>{profile.branch || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="block text-[11px] uppercase tracking-[0.18em] text-slate-400">Course</span>
                            <span>{profile.course || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="block text-[11px] uppercase tracking-[0.18em] text-slate-400">Registered</span>
                            <span>{reg.registered_at ? new Date(reg.registered_at).toLocaleDateString() : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-700">
                        Student #{index + 1}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
