'use client';

import { useCallback, useEffect, useState } from 'react';
import { getCampusDate } from '@/lib/smart-campus/event-checkin.js';

function formatDate(value) {
    if (!value) return '—';
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function ClaimStatus({ status, itemType }) {
    const tone = status === 'accepted'
        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
        : status === 'declined'
            ? 'border-slate-400/30 bg-slate-500/10 text-slate-300'
            : 'border-amber-400/30 bg-amber-500/10 text-amber-200';
    const label = status === 'accepted'
        ? itemType === 'lost' ? 'Recovery confirmed' : 'Claim accepted'
        : status === 'declined' ? 'Declined'
            : itemType === 'lost' ? 'Awaiting owner' : 'Awaiting finder';
    return <span className={`rounded-full border px-3 py-1 text-xs ${tone}`}>{label}</span>;
}

export default function LostAndFoundPanel() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState({
        itemType: 'found',
        title: '',
        description: '',
        location: '',
        date: getCampusDate(),
    });
    const [claimDrafts, setClaimDrafts] = useState({});
    const [responseDrafts, setResponseDrafts] = useState({});
    const [activeClaimId, setActiveClaimId] = useState('');
    const [busyAction, setBusyAction] = useState('');
    const [message, setMessage] = useState('');

    const loadItems = useCallback(async () => {
        setLoadError('');
        try {
            const response = await fetch('/api/lost-and-found', { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not load Lost & Found.');
            setItems(data.items || []);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'Could not load Lost & Found.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadItems();
    }, [loadItems]);

    const submitItem = async (event) => {
        event.preventDefault();
        setBusyAction('create');
        setMessage('');
        const itemType = form.itemType;
        try {
            const response = await fetch('/api/lost-and-found', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not post this item.');
            setForm({ itemType, title: '', description: '', location: '', date: getCampusDate() });
            setFormOpen(false);
            setMessage(itemType === 'lost' ? 'Lost item posted.' : 'Found item posted.');
            await loadItems();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not post this item.');
        } finally {
            setBusyAction('');
        }
    };

    const submitClaim = async (event, item) => {
        event.preventDefault();
        setBusyAction(`claim-${item.id}`);
        setMessage('');
        try {
            const response = await fetch(`/api/lost-and-found/${encodeURIComponent(item.id)}/claims`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: claimDrafts[item.id] || '' }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not send this claim.');
            setActiveClaimId('');
            setClaimDrafts((current) => ({ ...current, [item.id]: '' }));
            setMessage(item.item_type === 'lost'
                ? 'Private finder response sent to the owner.'
                : 'Private claim request sent to the finder.');
            await loadItems();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not send this claim.');
        } finally {
            setBusyAction('');
        }
    };

    const respondToClaim = async (claim, decision, item) => {
        setBusyAction(`response-${claim.id}`);
        setMessage('');
        try {
            const response = await fetch(`/api/lost-and-found/claims/${encodeURIComponent(claim.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    decision,
                    response: responseDrafts[claim.id] || '',
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not update this claim.');
            setMessage(decision === 'accepted'
                ? item.item_type === 'lost'
                    ? 'Finder confirmed; the item is now marked recovered.'
                    : 'Claim accepted; the item is now marked returned.'
                : 'Response declined.');
            await loadItems();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not update this claim.');
        } finally {
            setBusyAction('');
        }
    };

    const markReturned = async (item) => {
        setBusyAction(`close-${item.id}`);
        setMessage('');
        try {
            const response = await fetch(`/api/lost-and-found/${encodeURIComponent(item.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'mark_returned' }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not close this post.');
            setMessage(item.item_type === 'lost' ? 'Post marked as recovered.' : 'Post marked as returned.');
            await loadItems();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not close this post.');
        } finally {
            setBusyAction('');
        }
    };

    return (
        <div className="space-y-5">
            <div className="campus-panel-strong flex flex-wrap items-center justify-between gap-4 rounded-[1.7rem] p-6">
                <div>
                    <div className="campus-kicker">Campus community</div>
                    <h2 className="mt-2 text-2xl font-bold text-white">Lost &amp; Found</h2>
                    <p className="mt-1 text-sm text-white/55">Post a lost or found item. Owners and finders can connect through private responses.</p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => void loadItems()} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white">
                        Refresh
                    </button>
                    <button type="button" onClick={() => setFormOpen((current) => !current)} className="rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-2 text-sm font-medium text-white">
                        {formOpen ? 'Close form' : 'Post an item'}
                    </button>
                </div>
            </div>

            {formOpen && (
                <form onSubmit={submitItem} className="campus-panel rounded-[1.7rem] p-6">
                    <h3 className="text-lg font-semibold text-white">Post a {form.itemType} item</h3>
                    <p className="mt-1 text-xs text-white/50">Keep personal contact details and sensitive item identifiers out of the public post.</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <label className="text-sm text-white/70">
                            Post type
                            <select value={form.itemType} onChange={(event) => setForm((current) => ({ ...current, itemType: event.target.value }))} className="campus-input mt-1 w-full rounded-xl px-3 py-2.5">
                                <option value="lost">I lost an item</option>
                                <option value="found">I found an item</option>
                            </select>
                        </label>
                        <label className="text-sm text-white/70">
                            Item name
                            <input required maxLength={100} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Blue water bottle" className="campus-input mt-1 w-full rounded-xl px-3 py-2.5" />
                        </label>
                        <label className="text-sm text-white/70">
                            {form.itemType === 'lost' ? 'Last seen location' : 'Found location'}
                            <input required maxLength={160} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Building, floor, or campus area" className="campus-input mt-1 w-full rounded-xl px-3 py-2.5" />
                        </label>
                        <label className="text-sm text-white/70">
                            {form.itemType === 'lost' ? 'Lost date' : 'Found date'}
                            <input required type="date" max={getCampusDate()} value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className="campus-input mt-1 w-full rounded-xl px-3 py-2.5" />
                        </label>
                        <label className="text-sm text-white/70 md:col-span-2">
                            Description
                            <textarea required minLength={10} maxLength={1500} rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the item without revealing private contact information." className="campus-input mt-1 w-full rounded-xl px-3 py-2.5" />
                        </label>
                    </div>
                    <button type="submit" disabled={busyAction === 'create'} className="mt-4 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                        {busyAction === 'create' ? 'Posting…' : `Publish ${form.itemType} item`}
                    </button>
                </form>
            )}

            {message && <div role="status" className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{message}</div>}
            {loadError && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{loadError}</div>}
            {loading ? (
                <div className="campus-panel rounded-[1.5rem] p-8 text-center text-white/55">Loading posts…</div>
            ) : items.length === 0 ? (
                <div className="campus-panel rounded-[1.7rem] p-12 text-center text-white/60">
                    <div className="mb-3 text-5xl">🔎</div>
                    <p>No open lost or found posts right now.</p>
                    <p className="mt-2 text-sm text-white/35">Post an item to help the campus community.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {items.map((item) => (
                        <article key={item.id} className="campus-panel rounded-[1.7rem] p-5 sm:p-6">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-lg font-bold text-white">{item.title}</h3>
                                        <span className="rounded-full border border-purple-400/25 bg-purple-500/10 px-2.5 py-1 text-[11px] text-purple-200">{item.item_type === 'lost' ? 'Lost item' : 'Found item'}</span>
                                        {item.is_mine && <span className="rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-200">Your post</span>}
                                    </div>
                                    <p className="mt-1 text-sm text-white/55">📍 {item.item_type === 'lost' ? 'Last seen near' : 'Found at'} {item.found_location} · {item.item_type === 'lost' ? 'Lost' : 'Found'} {formatDate(item.found_date)}</p>
                                </div>
                                <span className={`rounded-full border px-3 py-1 text-xs ${item.status === 'open' ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200' : 'border-slate-400/25 bg-slate-500/10 text-slate-300'}`}>
                                    {item.status === 'open'
                                        ? item.item_type === 'lost' ? 'Looking for item' : 'Looking for owner'
                                        : item.item_type === 'lost' ? 'Recovered' : 'Returned'}
                                </span>
                            </div>
                            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-white/75">{item.description}</p>

                            {item.is_mine && item.status === 'open' && (
                                <button type="button" disabled={busyAction === `close-${item.id}`} onClick={() => void markReturned(item)} className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 disabled:opacity-50">
                                    {busyAction === `close-${item.id}` ? 'Updating…' : item.item_type === 'lost' ? 'Mark as recovered' : 'Mark as returned'}
                                </button>
                            )}

                            {!item.is_mine && item.my_claim && (
                                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h4 className="text-sm font-semibold text-white">{item.item_type === 'lost' ? 'Your private finder response' : 'Your private claim request'}</h4>
                                        <ClaimStatus status={item.my_claim.status} itemType={item.item_type} />
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap text-sm text-white/65">{item.my_claim.message}</p>
                                    {item.my_claim.response && <p className="mt-3 rounded-xl bg-white/[0.04] p-3 text-sm text-white/75">{item.item_type === 'lost' ? 'Owner' : 'Finder'}&apos;s response: {item.my_claim.response}</p>}
                                </div>
                            )}

                            {!item.is_mine && item.status === 'open' && !item.my_claim && (
                                <div className="mt-4">
                                    {activeClaimId === item.id ? (
                                        <form onSubmit={(event) => void submitClaim(event, item)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                            <label className="block text-sm text-white/75">
                                                {item.item_type === 'lost' ? 'Where and when did you find this item?' : 'What details can verify this item is yours?'}
                                                <textarea required minLength={10} maxLength={1200} rows={3} value={claimDrafts[item.id] || ''} onChange={(event) => setClaimDrafts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={item.item_type === 'lost' ? 'Share where you found it or how the owner can identify it privately.' : 'Share identifying details privately with the finder. Do not include passwords or sensitive account details.'} className="campus-input mt-2 w-full rounded-xl px-3 py-2.5" />
                                            </label>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button type="submit" disabled={busyAction === `claim-${item.id}`} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                                                    {busyAction === `claim-${item.id}` ? 'Sending…' : item.item_type === 'lost' ? 'Send finder response' : 'Send private claim'}
                                                </button>
                                                <button type="button" onClick={() => setActiveClaimId('')} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70">Cancel</button>
                                            </div>
                                        </form>
                                    ) : (
                                        <button type="button" onClick={() => setActiveClaimId(item.id)} className="rounded-xl border border-sky-400/25 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-100">
                                            {item.item_type === 'lost' ? 'I found this item' : 'I think this is mine'}
                                        </button>
                                    )}
                                </div>
                            )}

                            {item.is_mine && item.claims?.length > 0 && (
                                <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
                                    <h4 className="text-sm font-semibold text-white">{item.item_type === 'lost' ? 'Private finder responses' : 'Private claim requests'} ({item.claims.length})</h4>
                                    {item.claims.map((claim) => (
                                        <div key={claim.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="text-sm font-medium text-white">{claim.claimant?.display_name || claim.claimant?.full_name || 'Student'}</div>
                                                <ClaimStatus status={claim.status} itemType={item.item_type} />
                                            </div>
                                            <p className="mt-2 whitespace-pre-wrap text-sm text-white/65">{claim.message}</p>
                                            {claim.status === 'pending' ? (
                                                <div className="mt-3 space-y-2">
                                                    <textarea maxLength={1200} rows={2} value={responseDrafts[claim.id] || ''} onChange={(event) => setResponseDrafts((current) => ({ ...current, [claim.id]: event.target.value }))} placeholder="Optional private reply or safe meeting instructions" className="campus-input w-full rounded-xl px-3 py-2.5 text-sm" />
                                                    <div className="flex flex-wrap gap-2">
                                                        <button type="button" disabled={busyAction === `response-${claim.id}`} onClick={() => void respondToClaim(claim, 'accepted', item)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{item.item_type === 'lost' ? 'Confirm found & recover' : 'Accept & mark returned'}</button>
                                                        <button type="button" disabled={busyAction === `response-${claim.id}`} onClick={() => void respondToClaim(claim, 'declined', item)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 disabled:opacity-50">Decline</button>
                                                    </div>
                                                </div>
                                            ) : claim.response && <p className="mt-3 text-sm text-white/55">Your response: {claim.response}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
