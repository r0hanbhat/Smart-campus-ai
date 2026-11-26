'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MESS_DAYS, MESS_MEALS } from '@/lib/smart-campus/mess.js';

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
    return value ? new Date(value).toLocaleString() : '';
}

function getWeekdayLabel(dayOfWeek) {
    return MESS_DAYS.find((day) => day.value === dayOfWeek)?.label || '';
}

export default function HostelMessPanel() {
    const [mealDate, setMealDate] = useState('');
    const [role, setRole] = useState('');
    const [menu, setMenu] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [ratings, setRatings] = useState([]);
    const [myRatings, setMyRatings] = useState({});
    const [selectedRatings, setSelectedRatings] = useState({});
    const [loading, setLoading] = useState(true);
    const [savingMeal, setSavingMeal] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    useEffect(() => {
        setMealDate(getLocalDateString());
    }, []);

    const refresh = useCallback(async (showLoading = false) => {
        if (!mealDate) {
            return;
        }
        if (showLoading) {
            setLoading(true);
        }
        try {
            const response = await fetch(`/api/hostel/mess?date=${mealDate}`, { credentials: 'same-origin' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || 'Unable to load the mess menu.');
            }
            setRole(payload.role || '');
            setMenu(Array.isArray(payload.menu) ? payload.menu : []);
            setAnnouncements(Array.isArray(payload.announcements) ? payload.announcements : []);
            setRatings(Array.isArray(payload.ratings) ? payload.ratings : []);
            setMyRatings(payload.myRatings || {});
            setSelectedRatings((current) => Object.keys(current).length > 0 ? current : (payload.myRatings || {}));
            setError('');
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load the mess menu.');
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    }, [mealDate]);

    useEffect(() => {
        if (!mealDate) {
            return undefined;
        }
        void refresh(true);
        const timer = window.setInterval(() => { void refresh(); }, 60000);
        return () => window.clearInterval(timer);
    }, [mealDate, refresh]);

    const menuByDayAndMeal = useMemo(() => {
        const entries = new Map();
        for (const item of menu) {
            entries.set(`${item.dayOfWeek}:${item.mealType}`, item.menuText);
        }
        return entries;
    }, [menu]);

    const todayDay = mealDate ? new Date(`${mealDate}T00:00:00`).getDay() : null;

    const submitRating = async (event, mealType) => {
        event.preventDefault();
        const rating = Number(selectedRatings[mealType]);
        if (!rating) {
            setError('Choose a rating from 1 to 5 stars.');
            return;
        }
        setSavingMeal(mealType);
        setError('');
        setNotice('');
        try {
            const response = await fetch('/api/hostel/mess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ mealDate, mealType, rating }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || 'Unable to save your meal rating.');
            }
            setMyRatings((current) => ({ ...current, [mealType]: rating }));
            setNotice(`Your ${MESS_MEALS.find((meal) => meal.value === mealType)?.label.toLowerCase()} rating has been saved.`);
            await refresh();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Unable to save your meal rating.');
        } finally {
            setSavingMeal('');
        }
    };

    return (
        <section className="campus-panel mx-auto w-full max-w-6xl rounded-[2rem] p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <div className="campus-kicker">Hostel dining</div>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">Mess menu</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">View today’s meals, check the full weekly schedule, and follow menu-change announcements.</p>
                </div>
                <button type="button" onClick={() => { void refresh(true); }} disabled={loading || !mealDate} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {loading ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>

            {error ? <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {notice ? <p role="status" className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}

            <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50/70 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">Today{todayDay !== null ? ` — ${getWeekdayLabel(todayDay)}` : ''}</h3>
                    {mealDate ? <time className="text-sm text-slate-500">{new Date(`${mealDate}T00:00:00`).toLocaleDateString()}</time> : null}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {MESS_MEALS.map((meal) => {
                        const menuText = todayDay === null ? '' : menuByDayAndMeal.get(`${todayDay}:${meal.value}`);
                        const ratingSummary = ratings.find((rating) => rating.mealType === meal.value);
                        return (
                            <article key={meal.value} className="rounded-xl border border-white bg-white/80 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <h4 className="font-semibold text-slate-900">{meal.label}</h4>
                                    {ratingSummary ? <span className="text-xs font-medium text-amber-800">{ratingSummary.average} ★ · {ratingSummary.count} ratings</span> : null}
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{menuText || 'Menu not posted yet.'}</p>
                                {role === 'hosteller' ? (
                                    <form onSubmit={(event) => { void submitRating(event, meal.value); }} className="mt-4 border-t border-slate-100 pt-3">
                                        <fieldset>
                                            <legend className="text-xs font-medium text-slate-600">Rate this meal</legend>
                                            <div className="mt-2 flex items-center gap-1">
                                                {[1, 2, 3, 4, 5].map((value) => (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        aria-label={`${value} star${value === 1 ? '' : 's'}`}
                                                        aria-pressed={Number(selectedRatings[meal.value]) === value}
                                                        onClick={() => setSelectedRatings((current) => ({ ...current, [meal.value]: value }))}
                                                        className={`rounded px-1 text-2xl leading-none transition ${Number(selectedRatings[meal.value]) >= value ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                                                    >
                                                        ★
                                                    </button>
                                                ))}
                                                {myRatings[meal.value] ? <span className="ml-2 text-xs text-emerald-700">Your rating: {myRatings[meal.value]}/5</span> : null}
                                            </div>
                                        </fieldset>
                                        <button type="submit" disabled={savingMeal === meal.value || !selectedRatings[meal.value]} className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                                            {savingMeal === meal.value ? 'Saving…' : myRatings[meal.value] ? 'Update rating' : 'Submit rating'}
                                        </button>
                                    </form>
                                ) : null}
                            </article>
                        );
                    })}
                </div>
            </div>

            <div className="mt-7">
                <h3 className="text-lg font-semibold text-slate-900">Weekly menu</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {MESS_DAYS.map((day) => (
                        <article key={day.value} className={`rounded-xl border p-4 ${todayDay === day.value ? 'border-sky-300 bg-sky-50/40' : 'border-slate-200 bg-white/60'}`}>
                            <h4 className="font-semibold text-slate-900">{day.label}{todayDay === day.value ? ' · Today' : ''}</h4>
                            <dl className="mt-3 space-y-3">
                                {MESS_MEALS.map((meal) => (
                                    <div key={meal.value}>
                                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{meal.label}</dt>
                                        <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{menuByDayAndMeal.get(`${day.value}:${meal.value}`) || 'Not posted'}</dd>
                                    </div>
                                ))}
                            </dl>
                        </article>
                    ))}
                </div>
            </div>

            <div className="mt-7">
                <h3 className="text-lg font-semibold text-slate-900">Menu changes & announcements</h3>
                <div className="mt-3 space-y-3">
                    {announcements.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">No mess announcements yet.</p>
                    ) : announcements.map((announcement) => (
                        <article key={announcement.id} className="rounded-xl border border-slate-200 bg-white/70 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <h4 className="font-semibold text-slate-900">{announcement.title}</h4>
                                <time className="text-xs text-slate-500">{formatDateTime(announcement.created_at)}</time>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{announcement.message}</p>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
