'use client';

import { useCallback, useEffect, useState } from 'react';
import { MESS_DAYS, MESS_MEALS } from '@/lib/smart-campus/mess.js';

async function requestJson(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const payload = await response.json().catch(() => ({ error: 'The request could not be completed.' }));
    if (!response.ok) {
        throw new Error(payload.error || 'The request could not be completed.');
    }
    return payload;
}

function entryKey(dayOfWeek, mealType) {
    return `${dayOfWeek}:${mealType}`;
}

function formatDateTime(value) {
    return value ? new Date(value).toLocaleString() : '';
}

export default function HostelMessAdminPanel() {
    const [menuValues, setMenuValues] = useState({});
    const [announcements, setAnnouncements] = useState([]);
    const [ratings, setRatings] = useState([]);
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await requestJson('/api/hostel/admin/mess');
            const values = {};
            for (const item of data.menu || []) {
                values[entryKey(item.dayOfWeek, item.mealType)] = item.menuText;
            }
            setMenuValues(values);
            setAnnouncements(data.announcements || []);
            setRatings(data.ratings || []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load mess data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const saveMenu = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setNotice('');
        try {
            const items = Object.entries(menuValues)
                .map(([key, menuText]) => {
                    const [dayOfWeek, mealType] = key.split(':');
                    return { dayOfWeek: Number(dayOfWeek), mealType, menuText };
                })
                .filter((item) => item.menuText.trim());
            const result = await requestJson('/api/hostel/admin/mess', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
            });
            setNotice(`Weekly menu saved (${result.savedCount} meal entries).`);
            await loadData();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Unable to save the weekly menu.');
        } finally {
            setSaving(false);
        }
    };

    const publishAnnouncement = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setNotice('');
        try {
            await requestJson('/api/hostel/admin/mess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, message }),
            });
            setTitle('');
            setMessage('');
            setNotice('Mess announcement published to the hostel portal.');
            await loadData();
        } catch (publishError) {
            setError(publishError instanceof Error ? publishError.message : 'Unable to publish the announcement.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="campus-panel rounded-[1.7rem] p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <div className="campus-kicker">Hostel administration</div>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Mess menu & feedback</h2>
                    <p className="mt-1 text-sm text-slate-500">Manage the shared weekly menu, post changes, and review anonymous meal-rating aggregates from the last 30 days.</p>
                </div>
                <button type="button" onClick={() => void loadData()} disabled={loading} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {loading ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>
            {error ? <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {notice ? <p role="status" className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}

            <form onSubmit={(event) => void saveMenu(event)} className="mt-5">
                <div className="grid gap-4 lg:grid-cols-2">
                    {MESS_DAYS.map((day) => (
                        <fieldset key={day.value} className="rounded-xl border border-slate-200 bg-white/60 p-4">
                            <legend className="px-1 font-semibold text-slate-900">{day.label}</legend>
                            <div className="mt-2 space-y-3">
                                {MESS_MEALS.map((meal) => {
                                    const key = entryKey(day.value, meal.value);
                                    return (
                                        <label key={key} className="block text-sm font-medium text-slate-700">
                                            {meal.label}
                                            <textarea
                                                value={menuValues[key] || ''}
                                                onChange={(event) => setMenuValues((current) => ({ ...current, [key]: event.target.value }))}
                                                maxLength={1000}
                                                rows={2}
                                                className="campus-input mt-1.5 w-full rounded-lg px-3 py-2"
                                                placeholder="Menu items, separated by commas"
                                            />
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>
                    ))}
                </div>
                <button type="submit" disabled={saving || loading} className="campus-button mt-4 rounded-xl px-5 py-3 font-semibold text-white disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save weekly menu'}
                </button>
            </form>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Announce a menu change</h3>
                    <form onSubmit={(event) => void publishAnnouncement(event)} className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white/60 p-4">
                        <label className="block text-sm font-medium text-slate-700">
                            Title
                            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required className="campus-input mt-1.5 w-full rounded-lg px-3 py-2.5" placeholder="For example, Dinner menu update" />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                            Announcement
                            <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} required rows={4} className="campus-input mt-1.5 w-full rounded-lg px-3 py-2.5" placeholder="Describe the change and when it takes effect" />
                        </label>
                        <button type="submit" disabled={saving} className="campus-button rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                            {saving ? 'Publishing…' : 'Publish announcement'}
                        </button>
                    </form>
                    <div className="mt-4 space-y-2">
                        {announcements.slice(0, 5).map((announcement) => (
                            <article key={announcement.id} className="rounded-xl border border-slate-200 bg-white/60 p-3">
                                <div className="flex flex-wrap justify-between gap-2">
                                    <h4 className="text-sm font-semibold text-slate-900">{announcement.title}</h4>
                                    <time className="text-xs text-slate-500">{formatDateTime(announcement.created_at)}</time>
                                </div>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{announcement.message}</p>
                            </article>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Recent meal ratings</h3>
                    <p className="mt-1 text-xs text-slate-500">Anonymous aggregates for the past 30 days; individual ratings and hosteller identities are not shown.</p>
                    {ratings.length === 0 ? (
                        <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">No ratings received yet.</p>
                    ) : (
                        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white/60">
                            <table className="w-full min-w-[22rem] text-left text-sm">
                                <thead className="text-xs uppercase tracking-wide text-slate-500">
                                    <tr><th className="px-3 py-2">Day</th><th className="px-3 py-2">Meal</th><th className="px-3 py-2">Average</th><th className="px-3 py-2">Ratings</th></tr>
                                </thead>
                                <tbody>
                                    {ratings.map((rating) => (
                                        <tr key={`${rating.dayOfWeek}-${rating.mealType}`} className="border-t border-slate-200">
                                            <td className="px-3 py-2">{MESS_DAYS.find((day) => day.value === rating.dayOfWeek)?.label || 'Unknown'}</td>
                                            <td className="px-3 py-2">{MESS_MEALS.find((meal) => meal.value === rating.mealType)?.label || rating.mealType}</td>
                                            <td className="px-3 py-2 font-semibold">{rating.average} / 5</td>
                                            <td className="px-3 py-2">{rating.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
