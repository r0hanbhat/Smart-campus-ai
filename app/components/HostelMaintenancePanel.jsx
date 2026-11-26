'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    HOSTEL_MAINTENANCE_CATEGORIES,
    HOSTEL_MAINTENANCE_STATUSES,
} from '@/lib/smart-campus/hostel.js';

const STATUS_LABELS = {
    submitted: 'Submitted',
    in_progress: 'In progress',
    awaiting_student: 'Awaiting student',
    resolved: 'Resolved',
};

function MaintenanceStatus({ status }) {
    return (
        <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-800">
            {STATUS_LABELS[status] || status}
        </span>
    );
}

function formatDate(value) {
    return value ? new Date(value).toLocaleString() : '';
}

export default function HostelMaintenancePanel() {
    const [role, setRole] = useState('');
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState(HOSTEL_MAINTENANCE_CATEGORIES[0]);
    const [drafts, setDrafts] = useState({});

    const refresh = useCallback(async (showLoading = false) => {
        if (showLoading) {
            setLoading(true);
        }
        try {
            const response = await fetch('/api/hostel/maintenance', { credentials: 'same-origin' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || 'Unable to load maintenance requests.');
            }
            setRole(payload.role || '');
            setRequests(Array.isArray(payload.requests) ? payload.requests : []);
            setError('');
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load maintenance requests.');
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

    const submitReport = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setNotice('');
        try {
            const response = await fetch('/api/hostel/maintenance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ title, description, category }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || 'Unable to submit maintenance request.');
            }
            setTitle('');
            setDescription('');
            setNotice('Your maintenance request has been submitted.');
            await refresh();
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Unable to submit maintenance request.');
        } finally {
            setSaving(false);
        }
    };

    const saveUpdate = async (event, requestId) => {
        event.preventDefault();
        const draft = drafts[requestId] || {};
        setSaving(true);
        setError('');
        setNotice('');
        try {
            const response = await fetch(`/api/hostel/maintenance/${requestId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ status: draft.status, message: draft.message }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || 'Unable to update maintenance request.');
            }
            setDrafts((current) => ({ ...current, [requestId]: { ...current[requestId], message: '' } }));
            setNotice('The request timeline has been updated.');
            await refresh();
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : 'Unable to update maintenance request.');
        } finally {
            setSaving(false);
        }
    };

    const updateDraft = (requestId, key, value, requestStatus) => {
        setDrafts((current) => ({
            ...current,
            [requestId]: {
                status: current[requestId]?.status || requestStatus,
                message: current[requestId]?.message || '',
                [key]: value,
            },
        }));
    };

    return (
        <section className="campus-panel mx-auto w-full max-w-6xl rounded-[2rem] p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <div className="campus-kicker">Hostel services</div>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">Maintenance requests</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        Follow each status change and message in the request timeline.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => { void refresh(true); }}
                    disabled={loading}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                    {loading ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>

            {error ? <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {notice ? <p role="status" className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}

            {role === 'hosteller' ? (
                <form onSubmit={submitReport} className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white/70 p-5">
                    <h3 className="font-semibold text-slate-900">Report a maintenance issue</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-700">
                            Category
                            <select value={category} onChange={(event) => setCategory(event.target.value)} className="campus-input mt-2 w-full rounded-xl px-4 py-3">
                                {HOSTEL_MAINTENANCE_CATEGORIES.map((item) => <option key={item} value={item}>{item === 'WiFi' ? 'Wi-Fi' : item}</option>)}
                            </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                            Title
                            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required className="campus-input mt-2 w-full rounded-xl px-4 py-3" placeholder="Briefly describe the issue" />
                        </label>
                    </div>
                    <label className="block text-sm font-medium text-slate-700">
                        Description
                        <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} required rows={3} className="campus-input mt-2 w-full rounded-xl px-4 py-3" placeholder="Add details that will help the warden address it" />
                    </label>
                    <button type="submit" disabled={saving} className="campus-button justify-self-start rounded-xl px-5 py-3 font-semibold text-white disabled:opacity-50">
                        {saving ? 'Submitting…' : 'Submit request'}
                    </button>
                </form>
            ) : null}

            <div className="mt-6 space-y-4">
                {loading && requests.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-7 text-center text-sm text-slate-500">Loading maintenance requests…</p>
                ) : requests.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-7 text-center text-sm text-slate-500">
                        {role === 'warden' ? 'No maintenance requests for your assigned blocks.' : 'You have not submitted any maintenance requests.'}
                    </p>
                ) : requests.map((item) => {
                    const draft = drafts[item.id] || { status: item.status, message: '' };
                    return (
                        <article key={item.id} className="rounded-2xl border border-slate-200 bg-white/70 p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.category === 'WiFi' ? 'Wi-Fi' : item.category}</span>
                                        <MaintenanceStatus status={item.status} />
                                    </div>
                                    <h3 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h3>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                                    <p className="mt-2 text-xs text-slate-500">
                                        {item.blockName} · Room {item.roomNumber}
                                        {role === 'warden' ? ` · ${item.reporter.name} (${item.reporter.rollNumber || 'no roll number'})` : ''}
                                        {` · Reported ${formatDate(item.createdAt)}`}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 border-l-2 border-sky-200 pl-4">
                                <h4 className="text-sm font-semibold text-slate-800">Updates</h4>
                                <ol className="mt-3 space-y-4">
                                    {item.timeline.map((update) => (
                                        <li key={update.id} className="relative">
                                            <span className="absolute -left-[1.37rem] top-1.5 h-2 w-2 rounded-full bg-sky-500" />
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-medium text-slate-800">{update.actorName}</span>
                                                <span className="text-xs text-slate-500">{update.actorRole === 'warden' ? 'Warden' : 'Hosteller'}</span>
                                                <MaintenanceStatus status={update.status} />
                                            </div>
                                            <p className="mt-1 text-sm leading-6 text-slate-600">{update.message}</p>
                                            <time className="mt-1 block text-xs text-slate-400">{formatDate(update.createdAt)}</time>
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            {role === 'warden' ? (
                                <form onSubmit={(event) => { void saveUpdate(event, item.id); }} className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)_auto] sm:items-end">
                                    <label className="block text-sm font-medium text-slate-700">
                                        Update status
                                        <select value={draft.status} onChange={(event) => updateDraft(item.id, 'status', event.target.value, item.status)} className="campus-input mt-2 w-full rounded-xl px-3 py-2.5">
                                            {HOSTEL_MAINTENANCE_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                                        </select>
                                    </label>
                                    <label className="block text-sm font-medium text-slate-700">
                                        Message for hosteller
                                        <input value={draft.message} onChange={(event) => updateDraft(item.id, 'message', event.target.value, item.status)} maxLength={1000} required className="campus-input mt-2 w-full rounded-xl px-3 py-2.5" placeholder="Describe the progress or next step" />
                                    </label>
                                    <button type="submit" disabled={saving} className="campus-button rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                                        {saving ? 'Saving…' : 'Post update'}
                                    </button>
                                </form>
                            ) : null}
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
