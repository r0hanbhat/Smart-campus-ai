'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

function getCampusDate() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function formatDateTime(value) {
    return value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

function TicketDialog({ event, onClose }) {
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        fetch(`/api/events/${encodeURIComponent(event.id)}/ticket`)
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Could not load your ticket.');
                return data;
            })
            .then((data) => {
                if (active) setTicket(data);
            })
            .catch((requestError) => {
                if (active) setError(requestError.message || 'Could not load your ticket.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [event.id]);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-labelledby="event-ticket-title">
            <button type="button" className="absolute inset-0 cursor-default" aria-label="Close event ticket" onClick={onClose} />
            <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
                <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">✕</button>
                <h3 id="event-ticket-title" className="pr-6 text-left text-lg font-bold text-slate-900">{event.title}</h3>
                <p className="mt-1 text-left text-sm text-slate-500">Show this QR code to the event organizer.</p>
                {loading ? (
                    <p className="py-12 text-sm text-slate-500">Loading ticket…</p>
                ) : error ? (
                    <p role="alert" className="py-8 text-sm text-red-700">{error}</p>
                ) : ticket?.checkedInAt ? (
                    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left text-sm text-emerald-900">
                        You are checked in.
                        <div className="mt-1 text-xs">{formatDateTime(ticket.checkedInAt)}</div>
                    </div>
                ) : ticket?.ticketToken ? (
                    <div className="mt-5 space-y-3">
                        <div className="inline-block rounded-2xl border border-slate-200 bg-white p-3">
                            <QRCodeSVG value={ticket.ticketToken} size={224} level="M" marginSize={4} title={`Check-in ticket for ${event.title}`} />
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left">
                            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Ticket number</div>
                            <code className="mt-1 block break-all text-sm text-slate-900">{ticket.ticketToken}</code>
                        </div>
                    </div>
                ) : (
                    <p className="py-8 text-sm text-red-700">A ticket is not available for this registration.</p>
                )}
                <button type="button" onClick={onClose} className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">
                    Close
                </button>
            </div>
        </div>
    );
}

export function EventTicketButton({ event }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button type="button" onClick={() => setIsOpen(true)} className="mt-4 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-2 text-sm font-medium text-white">
                Show check-in QR
            </button>
            {isOpen && <TicketDialog event={event} onClose={() => setIsOpen(false)} />}
        </>
    );
}

export default function EventActivityHistoryPanel() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        let active = true;
        fetch('/api/events/history')
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Could not load event history.');
                return data;
            })
            .then((data) => {
                if (active) setEvents(data.events || []);
            })
            .catch((requestError) => {
                if (active) setError(requestError.message || 'Could not load event history.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [refreshKey]);

    const today = getCampusDate();

    if (loading) {
        return <div className="campus-panel rounded-[1.5rem] p-8 text-center text-white/60">Loading your event activity…</div>;
    }
    if (error) {
        return <div role="alert" className="campus-panel rounded-[1.5rem] p-6 text-sm text-rose-200">{error}</div>;
    }
    if (events.length === 0) {
        return (
            <div className="campus-panel rounded-[1.7rem] p-12 text-center text-white/60">
                <div className="mb-3 text-5xl">🗓️</div>
                <p>No event registrations yet.</p>
                <p className="mt-2 text-sm text-white/35">Events you register for will appear here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Event activity history</h2>
                <button
                    type="button"
                    onClick={() => {
                        setLoading(true);
                        setError('');
                        setRefreshKey((current) => current + 1);
                    }}
                    className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white"
                >
                    Refresh
                </button>
            </div>
            {events.map((event) => {
                const eventEndDate = event.event_end_date || event.proposed_date;
                const canShowTicket = event.is_published && !event.checked_in_at && today <= eventEndDate;
                const eventHasEnded = today > eventEndDate;
                return (
                    <article key={event.registration_id} className="campus-panel rounded-[1.5rem] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-white">{event.title}</h3>
                                <p className="mt-1 text-sm text-white/55">
                                    {event.proposed_date}{eventEndDate !== event.proposed_date ? ` – ${eventEndDate}` : ''}
                                    {event.time_start ? ` · ${event.time_start}` : ''}
                                    {event.venue ? ` · ${event.venue}` : ''}
                                </p>
                                {event.club?.club_name && <p className="mt-1 text-xs text-white/45">{event.club.club_name}</p>}
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-xs ${event.checked_in_at ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200' : 'border-amber-400/30 bg-amber-500/10 text-amber-100'}`}>
                                {event.checked_in_at ? 'Attended' : eventHasEnded ? 'No check-in recorded' : 'Registered'}
                            </span>
                        </div>
                        <div className="mt-3 text-xs text-white/45">
                            Registered {formatDateTime(event.registered_at)}
                            {event.checked_in_at && ` · Checked in ${formatDateTime(event.checked_in_at)}`}
                        </div>
                        {canShowTicket && (
                            <EventTicketButton event={event} />
                        )}
                        {!event.is_published && <p className="mt-3 text-xs text-amber-200/80">This event is no longer available.</p>}
                    </article>
                );
            })}
        </div>
    );
}
