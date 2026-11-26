'use client';

import { useCallback, useEffect, useState } from 'react';

const STATUS_LABELS = {
    pending: 'Pending approval',
    approved: 'Approved',
    rejected: 'Rejected',
};

function formatDateTime(value) {
    return value ? new Date(value).toLocaleString() : '';
}

function getLocalDateTimeMinimum() {
    const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    return date.toISOString().slice(0, 16);
}

export default function HostelOutpassPanel() {
    const [role, setRole] = useState('');
    const [requests, setRequests] = useState([]);
    const [destination, setDestination] = useState('');
    const [purpose, setPurpose] = useState('');
    const [departureAt, setDepartureAt] = useState('');
    const [returnBy, setReturnBy] = useState('');
    const [reviewNotes, setReviewNotes] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const refresh = useCallback(async (showLoading = false) => {
        if (showLoading) {
            setLoading(true);
        }
        try {
            const response = await fetch('/api/hostel/outpasses', { credentials: 'same-origin' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || 'Unable to load outpass requests.');
            }
            setRole(payload.role || '');
            setRequests(Array.isArray(payload.requests) ? payload.requests : []);
            setError('');
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load outpass requests.');
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        void refresh(true);
        const timer = window.setInterval(() => { void refresh(); }, 30000);
        return () => window.clearInterval(timer);
    }, [refresh]);

    const submitRequest = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        setNotice('');
        try {
            const response = await fetch('/api/hostel/outpasses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    destination,
                    purpose,
                    departureAt: new Date(departureAt).toISOString(),
                    returnBy: new Date(returnBy).toISOString(),
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || 'Unable to submit outpass request.');
            }
            setDestination('');
            setPurpose('');
            setDepartureAt('');
            setReturnBy('');
            setNotice('Your outpass request has been submitted for review.');
            await refresh();
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Unable to submit outpass request.');
        } finally {
            setSubmitting(false);
        }
    };

    const reviewRequest = async (event, requestId, status) => {
        event.preventDefault();
        const message = (reviewNotes[requestId] || '').trim();
        if (!message) {
            setError('Add a short review note before approving or rejecting the request.');
            return;
        }

        setSubmitting(true);
        setError('');
        setNotice('');
        try {
            const response = await fetch(`/api/hostel/outpasses/${requestId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ status, message }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || 'Unable to review outpass request.');
            }
            setReviewNotes((current) => ({ ...current, [requestId]: '' }));
            setNotice(`Outpass request ${status}.`);
            await refresh();
        } catch (reviewError) {
            setError(reviewError instanceof Error ? reviewError.message : 'Unable to review outpass request.');
        } finally {
            setSubmitting(false);
        }
    };

    const canReview = role === 'warden' || role === 'admin';
    const minimumDateTime = getLocalDateTimeMinimum();

    return (
        <section className="campus-panel mx-auto w-full max-w-6xl rounded-[2rem] p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <div className="campus-kicker">Hostel services</div>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">Leave & outpass requests</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        Submit an outpass for review or follow the approval timeline for your requests.
                    </p>
                </div>
                <button type="button" onClick={() => { void refresh(true); }} disabled={loading} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {loading ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>
            {error ? <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {notice ? <p role="status" className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}

            {role === 'hosteller' ? (
                <form onSubmit={submitRequest} className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white/70 p-5 sm:grid-cols-2">
                    <h3 className="font-semibold text-slate-900 sm:col-span-2">Request an outpass</h3>
                    <label className="block text-sm font-medium text-slate-700">
                        Destination
                        <input value={destination} onChange={(event) => setDestination(event.target.value)} maxLength={160} required className="campus-input mt-2 w-full rounded-xl px-4 py-3" placeholder="Where are you going?" />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                        Reason
                        <input value={purpose} onChange={(event) => setPurpose(event.target.value)} maxLength={1000} required className="campus-input mt-2 w-full rounded-xl px-4 py-3" placeholder="Briefly explain the reason" />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                        Departure
                        <input type="datetime-local" value={departureAt} min={minimumDateTime} onChange={(event) => setDepartureAt(event.target.value)} required className="campus-input mt-2 w-full rounded-xl px-4 py-3" />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                        Expected return
                        <input type="datetime-local" value={returnBy} min={departureAt || minimumDateTime} onChange={(event) => setReturnBy(event.target.value)} required className="campus-input mt-2 w-full rounded-xl px-4 py-3" />
                    </label>
                    <button type="submit" disabled={submitting} className="campus-button justify-self-start rounded-xl px-5 py-3 font-semibold text-white disabled:opacity-50 sm:col-span-2">
                        {submitting ? 'Submitting…' : 'Submit for approval'}
                    </button>
                </form>
            ) : null}

            <div className="mt-6 space-y-4">
                {loading && requests.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-7 text-center text-sm text-slate-500">Loading outpass requests…</p>
                ) : requests.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-7 text-center text-sm text-slate-500">
                        {canReview ? 'No outpass requests are waiting in your authorized scope.' : 'You have not submitted any outpass requests.'}
                    </p>
                ) : requests.map((request) => (
                    <article key={request.id} className="rounded-2xl border border-slate-200 bg-white/70 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${request.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : request.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {STATUS_LABELS[request.status] || request.status}
                                </span>
                                <h3 className="mt-3 text-lg font-semibold text-slate-900">{request.destination}</h3>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{request.purpose}</p>
                                <p className="mt-2 text-xs leading-5 text-slate-500">
                                    {formatDateTime(request.departureAt)} → {formatDateTime(request.returnBy)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {request.blockName} · Room {request.roomNumber}
                                    {canReview ? ` · ${request.hosteller.name} (${request.hosteller.rollNumber || 'no roll number'})` : ''}
                                    {` · Submitted ${formatDateTime(request.createdAt)}`}
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 border-l-2 border-sky-200 pl-4">
                            <h4 className="text-sm font-semibold text-slate-800">Request timeline</h4>
                            <ol className="mt-3 space-y-4">
                                {request.timeline.map((update) => (
                                    <li key={update.id} className="relative">
                                        <span className="absolute -left-[1.37rem] top-1.5 h-2 w-2 rounded-full bg-sky-500" />
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-medium text-slate-800">{update.actorName}</span>
                                            <span className="text-xs text-slate-500">{update.actorRole === 'admin' ? 'Hostel admin' : update.actorRole === 'warden' ? 'Warden' : 'Hosteller'}</span>
                                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{STATUS_LABELS[update.status] || update.status}</span>
                                        </div>
                                        <p className="mt-1 text-sm leading-6 text-slate-600">{update.message}</p>
                                        <time className="mt-1 block text-xs text-slate-400">{formatDateTime(update.createdAt)}</time>
                                    </li>
                                ))}
                            </ol>
                        </div>

                        {canReview && request.status === 'pending' ? (
                            <form onSubmit={(event) => event.preventDefault()} className="mt-5 rounded-xl bg-slate-50 p-4">
                                <label className="block text-sm font-medium text-slate-700">
                                    Review note
                                    <textarea value={reviewNotes[request.id] || ''} onChange={(event) => setReviewNotes((current) => ({ ...current, [request.id]: event.target.value }))} maxLength={1000} required rows={2} className="campus-input mt-2 w-full rounded-xl px-3 py-2.5" placeholder="Add the decision or any conditions" />
                                </label>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button type="button" onClick={(event) => { void reviewRequest(event, request.id, 'approved'); }} disabled={submitting} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">Approve</button>
                                    <button type="button" onClick={(event) => { void reviewRequest(event, request.id, 'rejected'); }} disabled={submitting} className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">Reject</button>
                                </div>
                            </form>
                        ) : null}
                    </article>
                ))}
            </div>
        </section>
    );
}
