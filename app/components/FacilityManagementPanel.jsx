'use client';

import { useCallback, useEffect, useState } from 'react';

const WEEKDAYS = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
];

function getLocalDateInput() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateValue, days) {
    const date = new Date(`${dateValue}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function getNextMondayDate() {
    const today = getLocalDateInput();
    const day = new Date(`${today}T00:00:00.000Z`).getUTCDay();
    return addDays(today, day === 1 ? 7 : (8 - day) % 7);
}

function getMonthStart(monthValue) {
    return `${monthValue}-01`;
}

function getMonthEnd(monthValue) {
    const date = new Date(`${monthValue}-01T00:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() + 1, 0);
    return date.toISOString().slice(0, 10);
}

function getDateWeekday(dateValue) {
    return new Date(`${dateValue}T00:00:00.000Z`).getUTCDay();
}

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

export default function FacilityManagementPanel({ scope } = {}) {
    const [data, setData] = useState({ resources: [], schedules: [], blocks: [] });
    const [form, setForm] = useState({
        resourceId: '',
        weekday: '1',
        allBlocks: true,
        blockIds: [],
        opensAt: '08:00',
        closesAt: '20:00',
        slotMinutes: '60',
        capacity: '10',
        activeFrom: getNextMondayDate(),
        activeUntil: '',
    });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const payload = await requestJson('/api/admin/facilities');
            const resources = Array.isArray(payload.resources) ? payload.resources : [];
            const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
            const scopedResources = scope ? resources.filter((resource) => resource.scope === scope) : resources;
            setData({
                resources,
                schedules: Array.isArray(payload.schedules) ? payload.schedules : [],
                blocks,
            });
            setForm((current) => ({
                ...current,
                resourceId: current.resourceId || scopedResources[0]?.id || '',
                weekday: !current.resourceId && scopedResources[0]?.code === 'hostel_laundry' ? 'every_day' : current.weekday,
                activeFrom: !current.resourceId && scopedResources[0]?.code === 'hostel_reading_room'
                    ? `${getLocalDateInput().slice(0, 7)}-01`
                    : current.activeFrom,
            }));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load facility schedules.');
        } finally {
            setLoading(false);
        }
    }, [scope]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleCreateSchedule = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        setNotice('');
        const isLaundryWeek = activeResource?.code === 'hostel_laundry';
        const isReadingRoomMonth = activeResource?.code === 'hostel_reading_room';
        const targetMonth = form.activeFrom.slice(0, 7);
        const selectedBlockIds = form.allBlocks ? 'all' : form.blockIds;
        if (isLaundryWeek && getDateWeekday(form.activeFrom) !== 1) {
            setError('Choose a Monday as the laundry week start.');
            setSubmitting(false);
            return;
        }
        if (isLaundryWeek && selectedBlockIds !== 'all' && selectedBlockIds.length === 0) {
            setError('Select at least one hostel block.');
            setSubmitting(false);
            return;
        }
        try {
            await requestJson('/api/admin/facilities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    weekday: isLaundryWeek
                        ? 'every_day'
                        : isReadingRoomMonth
                            ? 'every_day'
                            : form.weekday,
                    activeUntil: isLaundryWeek
                        ? addDays(form.activeFrom, 6)
                        : isReadingRoomMonth
                            ? getMonthEnd(targetMonth)
                            : form.activeUntil,
                    blockIds: isLaundryWeek ? selectedBlockIds : [],
                    capacity: isReadingRoomMonth ? '200' : form.capacity,
                }),
            });
            setNotice(isLaundryWeek
                ? `Laundry availability was published for the selected week${selectedBlockIds === 'all' ? ' across all blocks.' : ' for the selected blocks.'}`
                : isReadingRoomMonth
                    ? `Reading-room availability was published for ${targetMonth}.`
                    : 'Recurring facility availability was added.');
            await loadData();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Unable to save this schedule.');
        } finally {
            setSubmitting(false);
        }
    };

    const setScheduleActive = async (schedule, isActive) => {
        setError('');
        setNotice('');
        try {
            await requestJson('/api/admin/facilities', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduleId: schedule.id, isActive }),
            });
            setNotice(isActive ? 'The schedule is active.' : 'The schedule was paused.');
            await loadData();
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : 'Unable to update this schedule.');
        }
    };

    const resources = scope
        ? data.resources.filter((resource) => resource.scope === scope)
        : data.resources;
    const schedules = scope
        ? data.schedules.filter((schedule) => schedule.resource?.scope === scope)
        : data.schedules;
    const activeResource = resources.find((resource) => resource.id === form.resourceId);
    const isLaundry = activeResource?.code === 'hostel_laundry';
    const isReadingRoom = activeResource?.code === 'hostel_reading_room';
    const isDatedHostelSchedule = isLaundry || isReadingRoom;

    return (
        <section className="campus-panel space-y-5 rounded-[1.7rem] p-6">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="campus-kicker">{scope === 'hostel' ? 'Hostel facility management' : 'Facility management'}</div>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">Facility availability</h2>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                        {scope === 'hostel'
                            ? 'Publish laundry slots by block for a week, or reading-room slots for a full month. Times use India Standard Time.'
                            : 'Publish dated hostel facility slots or recurring campus library and cafeteria availability. Times use India Standard Time.'}
                    </p>
                </div>
                <button type="button" onClick={() => void loadData()} disabled={loading} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    Refresh
                </button>
            </header>

            {error ? <div role="alert" className="rounded-xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {notice ? <div role="status" className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}

            <form onSubmit={(event) => void handleCreateSchedule(event)} className="space-y-4 rounded-2xl border border-slate-200 bg-white/70 p-5">
                <h3 className="font-semibold text-slate-900">{isDatedHostelSchedule ? 'Publish availability' : 'Add weekly schedule'}</h3>
                {activeResource ? <p className="text-sm text-slate-500">{activeResource.scope === 'hostel' ? 'Hostel resource' : 'Campus resource'}: {activeResource.name}</p> : null}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="text-sm font-medium text-slate-700">
                        Facility
                        <select value={form.resourceId} onChange={(event) => {
                            const resource = resources.find((item) => item.id === event.target.value);
                            setForm((current) => ({
                                ...current,
                                resourceId: event.target.value,
                                weekday: resource?.code === 'hostel_laundry'
                                    ? 'every_day'
                                    : current.weekday === 'every_day'
                                        ? '1'
                                        : current.weekday,
                                allBlocks: true,
                                blockIds: [],
                                activeFrom: resource?.code === 'hostel_laundry'
                                    ? getNextMondayDate()
                                    : resource?.code === 'hostel_reading_room'
                                        ? `${getLocalDateInput().slice(0, 7)}-01`
                                        : current.activeFrom,
                                activeUntil: '',
                                capacity: resource?.code === 'hostel_reading_room'
                                    ? '200'
                                    : current.capacity === '200'
                                        ? '10'
                                        : current.capacity,
                            }));
                        }} required className="campus-input mt-1.5 w-full rounded-xl px-3 py-2.5">
                            <option value="">Choose facility</option>
                            {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} ({resource.scope})</option>)}
                        </select>
                    </label>
                    {!isDatedHostelSchedule ? <label className="text-sm font-medium text-slate-700">
                        Repeats every
                        <select value={form.weekday} onChange={(event) => setForm((current) => ({ ...current, weekday: event.target.value }))} className="campus-input mt-1.5 w-full rounded-xl px-3 py-2.5">
                            {WEEKDAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                        </select>
                    </label> : null}
                    <label className="text-sm font-medium text-slate-700">
                        Opens
                        <input type="time" value={form.opensAt} onChange={(event) => setForm((current) => ({ ...current, opensAt: event.target.value }))} required className="campus-input mt-1.5 w-full rounded-xl px-3 py-2.5" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                        Closes
                        <input type="time" value={form.closesAt} onChange={(event) => setForm((current) => ({ ...current, closesAt: event.target.value }))} required className="campus-input mt-1.5 w-full rounded-xl px-3 py-2.5" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                        Slot length
                        <select value={form.slotMinutes} onChange={(event) => setForm((current) => ({ ...current, slotMinutes: event.target.value }))} className="campus-input mt-1.5 w-full rounded-xl px-3 py-2.5">
                            {[15, 30, 45, 60, 90, 120, 180, 240].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
                        </select>
                    </label>
                    {isReadingRoom ? (
                        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
                            Reading room capacity <span className="font-semibold">200 seats per slot</span>
                        </div>
                    ) : (
                        <label className="text-sm font-medium text-slate-700">
                            Capacity per slot
                            <input type="number" min="1" max="1000" value={form.capacity} onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))} required className="campus-input mt-1.5 w-full rounded-xl px-3 py-2.5" />
                        </label>
                    )}
                    <label className="text-sm font-medium text-slate-700">
                        {isLaundry ? 'Week starting (Monday)' : isReadingRoom ? 'Availability month' : 'Starts on'}
                        <input
                            type={isReadingRoom ? 'month' : 'date'}
                            value={isReadingRoom ? form.activeFrom.slice(0, 7) : form.activeFrom}
                            min={isLaundry ? getNextMondayDate() : isReadingRoom ? getLocalDateInput().slice(0, 7) : undefined}
                            onChange={(event) => setForm((current) => ({
                                ...current,
                                activeFrom: isReadingRoom
                                    ? event.target.value
                                        ? getMonthStart(event.target.value)
                                        : ''
                                    : event.target.value,
                            }))}
                            required
                            className="campus-input mt-1.5 w-full rounded-xl px-3 py-2.5"
                        />
                    </label>
                    {!isDatedHostelSchedule ? <label className="text-sm font-medium text-slate-700">
                        Ends on (optional)
                        <input type="date" value={form.activeUntil} min={form.activeFrom} onChange={(event) => setForm((current) => ({ ...current, activeUntil: event.target.value }))} className="campus-input mt-1.5 w-full rounded-xl px-3 py-2.5" />
                    </label> : null}
                    {isLaundry ? (
                        <fieldset className="sm:col-span-2 xl:col-span-4">
                            <legend className="text-sm font-medium text-slate-700">Publish to blocks</legend>
                            <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={form.allBlocks}
                                    onChange={(event) => setForm((current) => ({ ...current, allBlocks: event.target.checked }))}
                                />
                                All blocks
                            </label>
                            {!form.allBlocks ? (
                                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                                    {data.blocks.map((block) => (
                                        <label key={block.id} className="inline-flex items-center gap-2 text-sm text-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={form.blockIds.includes(block.id)}
                                                onChange={(event) => setForm((current) => ({
                                                    ...current,
                                                    blockIds: event.target.checked
                                                        ? [...current.blockIds, block.id]
                                                        : current.blockIds.filter((blockId) => blockId !== block.id),
                                                }))}
                                            />
                                            {block.name}
                                        </label>
                                    ))}
                                </div>
                            ) : null}
                        </fieldset>
                    ) : null}
                </div>
                <p className="text-xs text-slate-500">
                    {isLaundry
                        ? `This publishes slots for all seven days, ${form.activeFrom || 'the selected Monday'} through ${form.activeFrom ? addDays(form.activeFrom, 6) : 'Sunday'}, separately for each selected block. Booking opens the Monday before that week.`
                        : isReadingRoom
                            ? 'This publishes availability for every day in the selected month, shared across all blocks. Each slot has 200 seats.'
                            : 'The opening window must divide evenly by the slot length. A schedule repeats on its selected weekday until paused or its end date.'}
                </p>
                <button type="submit" disabled={submitting || loading || resources.length === 0} className="campus-button rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                    {submitting ? 'Saving...' : isReadingRoom ? 'Publish month' : isLaundry ? 'Publish week' : 'Publish recurring slots'}
                </button>
            </form>

            <div>
                <h3 className="font-semibold text-slate-900">Published schedules</h3>
                {loading ? <p className="mt-3 text-sm text-slate-500">Loading schedules...</p> : schedules.length === 0 ? (
                    <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-7 text-center text-sm text-slate-500">No schedules published yet.</p>
                ) : (
                    <div className="mt-3 space-y-2">
                        {schedules.map((schedule) => (
                            <div key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
                                <div>
                                    <div className="font-medium text-slate-900">
                                        {schedule.resource?.name || 'Facility'}
                                        {schedule.resource?.code === 'hostel_laundry'
                                            ? ` · ${schedule.block?.name || 'Unassigned block'} · Week of ${schedule.active_from}`
                                            : schedule.resource?.code === 'hostel_reading_room'
                                                ? ` · Month from ${schedule.active_from}`
                                                : ` · ${WEEKDAYS[schedule.weekday]?.label || 'Weekday'}`}
                                    </div>
                                    <div className="mt-1 text-sm text-slate-500">
                                        {schedule.opens_at.slice(0, 5)}–{schedule.closes_at.slice(0, 5)} · {schedule.slot_minutes} min slots · capacity {schedule.capacity} · {schedule.active_from}{schedule.active_until ? ` to ${schedule.active_until}` : ' onward'}
                                    </div>
                                    <div className={`mt-1 text-xs font-medium ${schedule.is_active ? 'text-emerald-700' : 'text-slate-400'}`}>
                                        {schedule.is_active ? 'Active' : 'Paused'}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void setScheduleActive(schedule, !schedule.is_active)}
                                    className={`rounded-lg px-3 py-2 text-sm font-medium ${schedule.is_active ? 'border border-amber-300 bg-amber-50 text-amber-800' : 'border border-emerald-300 bg-emerald-50 text-emerald-800'}`}
                                >
                                    {schedule.is_active ? 'Pause' : 'Resume'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
