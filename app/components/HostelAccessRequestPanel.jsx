'use client';

import { useEffect, useState } from 'react';

export default function HostelAccessRequestPanel() {
    const [status, setStatus] = useState('loading');
    const [reviewNote, setReviewNote] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let active = true;
        fetch('/api/hostel/registration-requests', { credentials: 'same-origin' })
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload.error || 'Unable to load your hostel access request.');
                }
                if (active) {
                    setStatus(payload.request?.status || 'not_requested');
                    setReviewNote(payload.request?.review_note || '');
                }
            })
            .catch((loadError) => {
                if (active) {
                    setError(loadError instanceof Error ? loadError.message : 'Unable to load your hostel access request.');
                    setStatus('not_requested');
                }
            });
        return () => {
            active = false;
        };
    }, []);

    const submitRequest = async () => {
        setSubmitting(true);
        setError('');
        try {
            const response = await fetch('/api/hostel/registration-requests', {
                method: 'POST',
                credentials: 'same-origin',
            });
            const payload = await response.json().catch(() => ({ error: 'Unable to submit your hostel access request.' }));
            if (!response.ok) {
                throw new Error(payload.error || 'Unable to submit your hostel access request.');
            }
            setStatus(payload.status || 'pending');
            setReviewNote('');
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Unable to submit your hostel access request.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="campus-panel rounded-[1.7rem] p-6">
            <div className="campus-kicker">Hostel access</div>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Request a hostel assignment</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
                Your verified student account will be reviewed by hostel staff. They will assign your block and room before hostel services are available.
            </p>
            {status === 'loading' ? <p className="mt-4 text-sm text-slate-500">Checking request status…</p> : null}
            {status === 'pending' ? (
                <p role="status" className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Your request is pending staff review.
                </p>
            ) : null}
            {status === 'rejected' ? (
                <div className="mt-4 rounded-xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <p>Your previous request was declined. You can submit a new request or contact hostel staff.</p>
                    {reviewNote ? <p className="mt-2">Staff note: {reviewNote}</p> : null}
                </div>
            ) : null}
            {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
            {status !== 'loading' && status !== 'pending' && status !== 'approved' ? (
                <button
                    type="button"
                    onClick={() => void submitRequest()}
                    disabled={submitting}
                    className="campus-button mt-5 rounded-xl px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {submitting ? 'Submitting…' : status === 'rejected' ? 'Submit a new request' : 'Request hostel access'}
                </button>
            ) : null}
        </section>
    );
}
