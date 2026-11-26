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

function formatCampusDate(value) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'short' });
}

function formatCampusDateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'Date unavailable'
        : date.toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            weekday: 'long',
            day: 'numeric',
            month: 'short',
        });
}

function formatCampusTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: 'numeric',
            minute: '2-digit',
        });
}

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

export default function FacilityBookingPanel({ scope }) {
    const isHostel = scope === 'hostel';
    const [data, setData] = useState({ slots: [], bookings: [] });
    const [selectedDate, setSelectedDate] = useState(getCampusDate);
    const [loading, setLoading] = useState(true);
    const [workingKey, setWorkingKey] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const dateParam = isHostel ? `&date=${encodeURIComponent(selectedDate)}` : '';
            const payload = await requestJson(`/api/facilities?scope=${encodeURIComponent(scope)}${dateParam}`);
            setData({
                slots: Array.isArray(payload.slots) ? payload.slots : [],
                bookings: Array.isArray(payload.bookings) ? payload.bookings : [],
            });
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load facility availability.');
        } finally {
            setLoading(false);
        }
    }, [scope, isHostel, selectedDate]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const bookSlot = async (slot) => {
        const key = `${slot.schedule_id}:${slot.slot_date}:${slot.slot_start}`;
        setWorkingKey(key);
        setError('');
        setNotice('');
        try {
            await requestJson('/api/facilities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scheduleId: slot.schedule_id,
                    slotDate: slot.slot_date,
                    slotStart: slot.slot_start,
                }),
            });
            setNotice('Your facility slot is reserved.');
            await loadData();
        } catch (bookingError) {
            setError(bookingError instanceof Error ? bookingError.message : 'Unable to reserve this slot.');
        } finally {
            setWorkingKey('');
        }
    };

    const cancelBooking = async (bookingId) => {
        setWorkingKey(bookingId);
        setError('');
        setNotice('');
        try {
            await requestJson('/api/facilities', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId }),
            });
            setNotice('Your reservation was cancelled.');
            await loadData();
        } catch (cancelError) {
            setError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel this reservation.');
        } finally {
            setWorkingKey('');
        }
    };

    const resourceGroups = data.slots.reduce((groups, slot) => {
        const group = groups.get(slot.resource_id) || { name: slot.resource_name, slots: [] };
        group.slots.push(slot);
        groups.set(slot.resource_id, group);
        return groups;
    }, new Map());
    const panelClass = isHostel
        ? 'campus-panel rounded-[1.7rem] p-6 text-slate-900'
        : 'campus-panel-strong rounded-[1.7rem] p-6 text-white';
    const descriptionClass = isHostel ? 'text-slate-500' : 'text-white/60';
    const emptyClass = isHostel ? 'border-slate-200 text-slate-500' : 'border-white/15 text-white/60';

    return (
        <section className={`${panelClass} space-y-5`}>
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="campus-kicker">{isHostel ? 'Hostel facilities' : 'Campus facilities'}</div>
                    <h2 className="mt-2 text-2xl font-bold">{isHostel ? 'Laundry and reading room' : 'Library and cafeteria seats'}</h2>
                    <p className={`mt-1 text-sm ${descriptionClass}`}>
                        {isHostel
                            ? 'Choose a date to view slots. Laundry shows your assigned block and opens for booking on the Monday before that week. Reading-room slots are shared across blocks, with 200 seats; you can book one seat while a slot is in progress if more than 30 minutes remain.'
                            : 'Recurring availability is shown for the next 14 days. You can cancel before a reservation starts.'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void loadData()}
                    disabled={loading}
                    className="rounded-full border border-current/20 px-4 py-2 text-sm transition hover:bg-black/5 disabled:opacity-50"
                >
                    {loading ? 'Loading...' : 'Refresh'}
                </button>
            </header>

            {error ? <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {notice ? <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

            <div>
                {isHostel ? (
                    <label className="block max-w-xs text-sm font-medium">
                        View availability for
                        <input
                            type="date"
                            value={selectedDate}
                            min={getCampusDate()}
                            onChange={(event) => setSelectedDate(event.target.value)}
                            className="campus-input mt-1.5 w-full rounded-xl px-3 py-2.5"
                        />
                    </label>
                ) : null}
            </div>

            <div>
                <h3 className="text-lg font-semibold">My reservations</h3>
                {data.bookings.length === 0 ? (
                    <p className={`mt-2 text-sm ${descriptionClass}`}>No upcoming reservations.</p>
                ) : (
                    <div className="mt-3 space-y-2">
                        {data.bookings.map((booking) => (
                            <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-current/10 bg-black/[0.03] px-4 py-3">
                                <div>
                                    <div className="font-medium">{booking.resource?.name || 'Facility'}</div>
                                    <div className={`mt-1 text-sm ${descriptionClass}`}>
                                        {formatCampusDateTime(booking.starts_at)} · {formatCampusTime(booking.starts_at)}–{formatCampusTime(booking.ends_at)}
                                    </div>
                                </div>
                                {new Date(booking.starts_at).getTime() <= Date.now() ? (
                                    <span className="text-sm font-medium text-slate-500">In progress</span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => void cancelBooking(booking.id)}
                                        disabled={workingKey === booking.id}
                                        className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 hover:bg-red-500/15 disabled:opacity-50"
                                    >
                                        {workingKey === booking.id ? 'Cancelling...' : 'Cancel'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-lg font-semibold">Available slots</h3>
                {loading ? (
                    <div className="mt-3 space-y-2">
                        {[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-black/5" />)}
                    </div>
                ) : resourceGroups.size === 0 ? (
                    <div className={`mt-3 rounded-xl border border-dashed px-4 py-8 text-center text-sm ${emptyClass}`}>
                        No bookable slots are available for this date. Check the booking window or ask staff to publish availability.
                    </div>
                ) : (
                    <div className="mt-3 space-y-4">
                        {[...resourceGroups.entries()].map(([resourceId, group]) => (
                            <div key={resourceId} className="rounded-xl border border-current/10 p-4">
                                <h4 className="font-semibold">
                                    {group.name}
                                    {group.slots[0]?.resource_code === 'hostel_laundry' && group.slots[0]?.block_name
                                        ? ` · ${group.slots[0].block_name}`
                                        : ''}
                                </h4>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                    {group.slots.map((slot) => {
                                        const key = `${slot.schedule_id}:${slot.slot_date}:${slot.slot_start}`;
                                        const available = Number(slot.capacity) - Number(slot.booked_count);
                                        return (
                                            <div key={key} className="rounded-lg border border-current/10 bg-black/[0.025] px-3 py-3">
                                                <div className="text-sm font-medium">{formatCampusDate(slot.slot_date)}</div>
                                                <div className={`mt-1 text-sm ${descriptionClass}`}>
                                                    {formatCampusTime(slot.starts_at)}–{formatCampusTime(slot.ends_at)}
                                                </div>
                                                {slot.resource_code === 'hostel_reading_room' ? (
                                                    <div className={`mt-1 text-xs ${descriptionClass}`}>
                                                        200 seats total · {available} remaining
                                                    </div>
                                                ) : null}
                                                {slot.my_booking_id ? (
                                                    <div className="mt-2 text-sm font-semibold text-emerald-700">
                                                        {slot.resource_code === 'hostel_reading_room' ? 'Seat reserved by you' : 'Reserved by you'}
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => void bookSlot(slot)}
                                                        disabled={available < 1 || Boolean(workingKey)}
                                                        className="mt-2 w-full rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {workingKey === key
                                                            ? 'Reserving...'
                                                            : slot.resource_code === 'hostel_reading_room'
                                                                ? `Book a seat (${available} remaining)`
                                                                : `Reserve (${available} available)`}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
