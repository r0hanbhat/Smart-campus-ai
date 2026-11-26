'use client';

import { useCallback, useEffect, useState } from 'react';

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
    });
    const payload = await response.json().catch(() => ({ error: 'The request could not be completed.' }));
    if (!response.ok) {
        throw new Error(payload.error || 'The request could not be completed.');
    }
    return payload;
}

export default function HostelRegistrationRequestsPanel() {
    const [requests, setRequests] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [assignments, setAssignments] = useState({});
    const [loading, setLoading] = useState(true);
    const [submittingId, setSubmittingId] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const loadRequests = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const payload = await requestJson('/api/hostel/registration-requests');
            setRequests(payload.requests || []);
            setBlocks(payload.blocks || []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load registration requests.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadRequests();
    }, [loadRequests]);

    const updateAssignment = (userId, field, value) => {
        setAssignments((current) => ({
            ...current,
            [userId]: { ...current[userId], [field]: value },
        }));
    };

    const reviewRequest = async (registrationRequest, decision) => {
        const assignment = assignments[registrationRequest.user_id] || {};
        setSubmittingId(registrationRequest.user_id);
        setError('');
        setNotice('');
        try {
            await requestJson(`/api/hostel/registration-requests/${encodeURIComponent(registrationRequest.user_id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    decision,
                    blockId: decision === 'approved' ? assignment.blockId : '',
                    roomNumber: decision === 'approved' ? assignment.roomNumber : '',
                }),
            });
            setNotice(decision === 'approved' ? 'Request approved and hostel assignment saved.' : 'Request declined.');
            await loadRequests();
        } catch (reviewError) {
            setError(reviewError instanceof Error ? reviewError.message : 'Unable to review this request.');
        } finally {
            setSubmittingId('');
        }
    };

    return (
        <section className="campus-panel rounded-[1.7rem] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Hosteller registration requests</h2>
                    <p className="mt-1 text-sm text-slate-500">Approve verified students by assigning a block and room, or decline the request.</p>
                </div>
                <button type="button" onClick={() => void loadRequests()} disabled={loading} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    Refresh
                </button>
            </div>
            {error ? <p role="alert" className="mt-4 rounded-xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {notice ? <p role="status" className="mt-4 rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}
            <div className="mt-5 space-y-4">
                {loading ? <p className="text-sm text-slate-500">Loading requests…</p> : null}
                {!loading && requests.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">No pending hostel registration requests.</p> : null}
                {requests.map((registrationRequest) => {
                    const assignment = assignments[registrationRequest.user_id] || {};
                    return (
                        <article key={registrationRequest.user_id} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                            <div className="flex flex-wrap justify-between gap-2">
                                <span className="font-semibold text-slate-900">Roll number: {registrationRequest.roll_number}</span>
                                <span className="text-xs text-slate-500">{new Date(registrationRequest.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="mt-1 break-all text-sm text-slate-600">{registrationRequest.email}</p>
                            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                                <select
                                    value={assignment.blockId || ''}
                                    onChange={(event) => updateAssignment(registrationRequest.user_id, 'blockId', event.target.value)}
                                    className="campus-input min-w-0 rounded-xl px-3 py-2.5"
                                    aria-label={`Block for ${registrationRequest.roll_number}`}
                                >
                                    <option value="">Choose block</option>
                                    {blocks.map((block) => <option key={block.id} value={block.id}>{block.name}</option>)}
                                </select>
                                <input
                                    value={assignment.roomNumber || ''}
                                    onChange={(event) => updateAssignment(registrationRequest.user_id, 'roomNumber', event.target.value)}
                                    maxLength={32}
                                    className="campus-input min-w-0 rounded-xl px-3 py-2.5"
                                    placeholder="Room number"
                                    aria-label={`Room number for ${registrationRequest.roll_number}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => void reviewRequest(registrationRequest, 'approved')}
                                    disabled={submittingId === registrationRequest.user_id || !assignment.blockId || !assignment.roomNumber?.trim()}
                                    className="campus-button rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                    {submittingId === registrationRequest.user_id ? 'Saving…' : 'Approve'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void reviewRequest(registrationRequest, 'rejected')}
                                    disabled={submittingId === registrationRequest.user_id}
                                    className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                    Decline
                                </button>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
