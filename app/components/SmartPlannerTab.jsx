'use client';

import { useState } from 'react';
import { PLANNER_CATEGORIES, PLANNER_CATEGORY_MAP, MIN_PLANNER_LEAD_MINUTES, formatPlannerRange, getMinimumPlannerStartTime, getPlannerValidationError, normalizePlannerEntry, toDateKey } from '@/lib/smart-campus/planner.js';

function getKindBadgeClasses(kind) {
    if (kind === 'deadline') {
        return 'border-amber-400/30 bg-amber-500/15 text-amber-100';
    }
    if (kind === 'reminder') {
        return 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100';
    }
    if (kind === 'planner') {
        return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100';
    }
    return 'border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-100';
}

function getRiskAccentClasses(item) {
    if (item.isOverdue) {
        return 'border-red-400/30 bg-red-500/10';
    }
    if (item.urgencyLabel === 'overlap' || item.score >= 95) {
        return 'border-amber-400/30 bg-amber-500/10';
    }
    return 'border-white/10 bg-white/5';
}

function PlannerSection({ title, description, emptyMessage, items, onSelectTab, onItemAction }) {
    return (
        <div className="campus-panel rounded-[1.8rem] p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <p className="text-sm text-white/55">{description}</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/55">
                    {items.length} items
                </div>
            </div>

            {items.length === 0 ? (
                <div className="mt-5 rounded-[1.4rem] border border-dashed border-white/15 px-5 py-8 text-center text-white/50">
                    {emptyMessage}
                </div>
            ) : (
                <div className="mt-5 space-y-3">
                    {items.map((item) => (
                        <div key={item.id} className={`rounded-[1.4rem] border p-5 transition hover:-translate-y-0.5 ${getRiskAccentClasses(item)}`}>
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getKindBadgeClasses(item.kind)}`}>
                                            {item.kind}
                                        </span>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
                                            {item.urgencyLabel}
                                        </span>
                                    </div>
                                    <h4 className="mt-3 text-lg font-semibold text-white">{item.title}</h4>
                                    <p className="mt-2 text-sm text-white/65">{item.subtitle}</p>
                                    <div className="mt-3 text-sm text-white/75">{item.dueLabel}</div>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-3">
                                    <button onClick={() => onItemAction(item)} className="rounded-[0.95rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-4 py-2.5 text-sm font-medium text-slate-950">
                                        {item.primaryActionLabel}
                                    </button>
                                    <button onClick={() => onSelectTab(item.tabTarget)} className="rounded-[0.95rem] border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white">
                                        Open {item.tabTarget}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PlannerComposer({ draft, isEditing, validationError, onChange, onClose, onSave }) {
    const todayKey = toDateKey(new Date());
    const minimumStartTime = getMinimumPlannerStartTime(draft.date);
    const minimumEndTime = draft.startTime || minimumStartTime;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950 p-6 text-white shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="campus-kicker">Weekly Planner Block</div>
                        <h3 className="mt-2 text-2xl font-bold">{isEditing ? 'Edit planner block' : 'Create planner block'}</h3>
                        <p className="mt-2 text-sm text-white/60">Save study, class, meeting, and personal blocks directly into your weekly planner.</p>
                    </div>
                    <button onClick={onClose} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
                        Close
                    </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                        <div className="text-sm text-white/65">Title</div>
                        <input value={draft.title} onChange={(event) => onChange('title', event.target.value)} className="campus-input w-full rounded-[1rem] px-4 py-3" placeholder="Deep work for DBMS" />
                    </label>
                    <label className="space-y-2">
                        <div className="text-sm text-white/65">Category</div>
                        <select value={draft.category} onChange={(event) => onChange('category', event.target.value)} className="campus-input w-full rounded-[1rem] px-4 py-3">
                            {PLANNER_CATEGORIES.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-2">
                        <div className="text-sm text-white/65">Date</div>
                        <input type="date" min={todayKey} value={draft.date} onChange={(event) => onChange('date', event.target.value)} className="campus-input w-full rounded-[1rem] px-4 py-3" />
                    </label>
                    <label className="space-y-2">
                        <div className="text-sm text-white/65">Repeats</div>
                        <select value={draft.recurrence} onChange={(event) => onChange('recurrence', event.target.value)} className="campus-input w-full rounded-[1rem] px-4 py-3">
                            <option value="none">Does not repeat</option>
                            <option value="weekly">Repeats weekly</option>
                        </select>
                    </label>
                    <label className="space-y-2">
                        <div className="text-sm text-white/65">Start time</div>
                        <input type="time" min={minimumStartTime || undefined} value={draft.startTime} onChange={(event) => onChange('startTime', event.target.value)} className="campus-input w-full rounded-[1rem] px-4 py-3" />
                    </label>
                    <label className="space-y-2">
                        <div className="text-sm text-white/65">End time</div>
                        <input type="time" min={minimumEndTime || undefined} value={draft.endTime} onChange={(event) => onChange('endTime', event.target.value)} className="campus-input w-full rounded-[1rem] px-4 py-3" />
                    </label>
                </div>

                <label className="mt-4 block space-y-2">
                    <div className="text-sm text-white/65">Notes</div>
                    <textarea value={draft.notes} onChange={(event) => onChange('notes', event.target.value)} className="campus-input min-h-28 w-full rounded-[1rem] px-4 py-3" placeholder="What should happen in this block?" />
                </label>

                {validationError ? (
                    <div className="mt-4 rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                        {validationError}
                    </div>
                ) : draft.date === todayKey ? (
                    <div className="mt-4 rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                        Today&apos;s blocks must start at least {MIN_PLANNER_LEAD_MINUTES} minutes from the current time.
                    </div>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                    <button onClick={onSave} disabled={Boolean(validationError)} className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
                        Save block
                    </button>
                    <button onClick={onClose} className="rounded-[1rem] border border-white/10 bg-white/5 px-5 py-3 text-sm text-white">
                        Cancel
                    </button>
                    <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                        Time range: {formatPlannerRange(draft.startTime, draft.endTime)}
                    </div>
                </div>
            </div>
        </div>
    );
}

function DayColumn({ day, onCreate, onEdit, onDelete, onToggle, onOpenSource }) {
    return (
        <div className={`rounded-[1.5rem] border p-4 ${day.isToday ? 'border-cyan-400/35 bg-cyan-500/10' : 'border-white/10 bg-white/5'}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-white">{day.dayLabel}</div>
                    <div className="text-xs uppercase tracking-[0.2em] text-white/45">{day.dateLabel}</div>
                </div>
                <button onClick={() => onCreate(day.dateKey)} disabled={day.isPast} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/70 disabled:cursor-not-allowed disabled:opacity-40">
                    + Add
                </button>
            </div>

            <div className="mt-4 space-y-3">
                {day.items.length === 0 ? (
                    <div className="rounded-[1rem] border border-dashed border-white/10 px-3 py-5 text-center text-xs text-white/40">
                        Free day space
                    </div>
                ) : (
                    day.items.map((item) => {
                        const categoryMeta = PLANNER_CATEGORY_MAP[item.category] || PLANNER_CATEGORY_MAP.study;
                        return (
                            <div key={item.id} className={`rounded-[1rem] border p-3 ${item.isConflicting ? 'border-amber-400/30 bg-amber-500/10' : 'border-white/10 bg-slate-950/45'} ${item.completed ? 'opacity-60' : ''}`}>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${categoryMeta.badgeClassName}`}>
                                        {categoryMeta.label}
                                    </span>
                                    <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${getKindBadgeClasses(item.kind)}`}>
                                        {item.kind}
                                    </span>
                                </div>
                                <div className="mt-3 text-sm font-semibold text-white">{item.title}</div>
                                <div className="mt-1 text-xs text-white/55">{item.timeLabel}</div>
                                <div className="mt-2 text-xs leading-5 text-white/65">{item.subtitle}</div>
                                {item.isConflicting ? <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-amber-200">Schedule overlap</div> : null}
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {item.editable ? (
                                        <>
                                            <button onClick={() => onToggle(item.sourceId)} className="rounded-lg bg-emerald-500/20 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-100">
                                                {item.completed ? 'Reopen' : 'Done'}
                                            </button>
                                            <button onClick={() => onEdit(item)} className="rounded-lg bg-white/10 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white">
                                                Edit
                                            </button>
                                            <button onClick={() => onDelete(item.sourceId)} className="rounded-lg bg-red-500/15 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-red-100">
                                                Delete
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => onOpenSource(item.sourceType)} className="rounded-lg bg-white/10 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white">
                                            Open source
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export function SmartPlannerTab({
    todayItems,
    weekItems,
    highRiskItems,
    guidance,
    focusRatio,
    attentionLevel,
    openDeadlinesCount,
    upcomingRemindersCount,
    attendedEventsCount,
    plannerWeekData,
    onSelectTab,
    onItemAction,
    onSavePlannerEntry,
    onDeletePlannerEntry,
    onTogglePlannerEntryCompletion,
}) {
    const [composerOpen, setComposerOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const defaultComposerDate = plannerWeekData.days.find((day) => !day.isPast)?.dateKey || plannerWeekData.days[plannerWeekData.days.length - 1]?.dateKey;
    const [draft, setDraft] = useState(() => normalizePlannerEntry({ date: defaultComposerDate }));
    const validationError = getPlannerValidationError(draft);

    const handleChangeDraft = (field, value) => {
        setDraft((current) => {
            const nextDraft = { ...current, [field]: value };
            if (field !== 'date') {
                return nextDraft;
            }
            const minimumStartTime = getMinimumPlannerStartTime(value);
            if (!minimumStartTime) {
                return nextDraft;
            }
            const shouldAdjustStartTime = !nextDraft.startTime || nextDraft.startTime < minimumStartTime;
            const adjustedStartTime = shouldAdjustStartTime ? minimumStartTime : nextDraft.startTime;
            const adjustedEndTime = !nextDraft.endTime || nextDraft.endTime <= adjustedStartTime
                ? normalizePlannerEntry({ date: value, startTime: adjustedStartTime }).endTime
                : nextDraft.endTime;
            return {
                ...nextDraft,
                startTime: adjustedStartTime,
                endTime: adjustedEndTime,
            };
        });
    };

    const closeComposer = () => {
        setComposerOpen(false);
        setIsEditing(false);
        setDraft(normalizePlannerEntry({ date: defaultComposerDate }));
    };

    const openNewComposer = (dateKey) => {
        if (dateKey && dateKey < toDateKey(new Date())) {
            return;
        }
        setIsEditing(false);
        setDraft(normalizePlannerEntry({ date: dateKey || defaultComposerDate }));
        setComposerOpen(true);
    };

    const openEditComposer = (item) => {
        setIsEditing(true);
        setDraft(normalizePlannerEntry({
            id: item.sourceId,
            title: item.title,
            date: item.date,
            startTime: item.startTime,
            endTime: item.endTime,
            category: item.category,
            notes: item.subtitle === 'Planner block you created.' ? '' : item.subtitle,
            recurrence: item.recurrence || 'none',
            completed: item.completed,
        }));
        setComposerOpen(true);
    };

    const handleSave = () => {
        if (!draft.title.trim() || !draft.date || !draft.startTime || !draft.endTime) {
            return;
        }
        if (validationError) {
            return;
        }
        onSavePlannerEntry(draft);
        closeComposer();
    };

    return (
        <div className="space-y-6">
            <div className="campus-panel-strong rounded-[2rem] p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-3xl">
                        <div className="campus-kicker">Smart Weekly Planner</div>
                        <h2 className="mt-2 text-3xl font-bold text-white">One plan, not five separate lists</h2>
                        <p className="mt-3 text-sm leading-7 text-white/65">
                            This planner combines deadlines, reminders, events, attention patterns, and your own saved blocks into a weekly calendar you can actually act on.
                        </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 xl:w-[28rem]">
                        <div className="rounded-[1.4rem] border border-amber-400/25 bg-amber-500/10 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Open deadlines</div>
                            <div className="mt-3 text-3xl font-bold text-white">{openDeadlinesCount}</div>
                        </div>
                        <div className="rounded-[1.4rem] border border-cyan-400/25 bg-cyan-500/10 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Upcoming reminders</div>
                            <div className="mt-3 text-3xl font-bold text-white">{upcomingRemindersCount}</div>
                        </div>
                        <div className="rounded-[1.4rem] border border-emerald-400/25 bg-emerald-500/10 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Focus ratio</div>
                            <div className="mt-3 text-3xl font-bold text-white">{Math.round(focusRatio * 100)}%</div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                        <div className="text-xs uppercase tracking-[0.2em] text-white/45">Planner guidance</div>
                        <div className="mt-4 space-y-3">
                            {guidance.map((line, index) => (
                                <div key={`planner-guidance-${index}`} className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                                    {line}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                        <div className="text-xs uppercase tracking-[0.2em] text-white/45">Behavior snapshot</div>
                        <div className="mt-4 space-y-3 text-sm text-white/75">
                            <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">
                                Attention state: <span className="font-semibold text-white">{attentionLevel}</span>
                            </div>
                            <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">
                                High risk queue: <span className="font-semibold text-white">{highRiskItems.length} items</span>
                            </div>
                            <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">
                                Events already attended: <span className="font-semibold text-white">{attendedEventsCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="campus-panel-strong rounded-[2rem] p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="campus-kicker">Weekly Calendar</div>
                        <h3 className="mt-2 text-2xl font-bold text-white">{plannerWeekData.weekLabel}</h3>
                        <p className="mt-2 max-w-3xl text-sm text-white/60">
                            Your manual blocks sit alongside imported deadlines, reminders, and events so you can spot pressure before the week gets messy.
                        </p>
                    </div>
                    <button onClick={() => openNewComposer(defaultComposerDate)} className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950">
                        Add planner block
                    </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-4">
                    <div className="rounded-[1.3rem] border border-white/10 bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Scheduled hours</div>
                        <div className="mt-3 text-3xl font-bold text-white">{plannerWeekData.stats.totalScheduledHours}</div>
                    </div>
                    <div className="rounded-[1.3rem] border border-white/10 bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Your blocks</div>
                        <div className="mt-3 text-3xl font-bold text-white">{plannerWeekData.stats.plannerCount}</div>
                    </div>
                    <div className="rounded-[1.3rem] border border-white/10 bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Busiest day</div>
                        <div className="mt-3 text-lg font-bold text-white">{plannerWeekData.stats.busyDayLabel}</div>
                    </div>
                    <div className="rounded-[1.3rem] border border-white/10 bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Conflicts</div>
                        <div className="mt-3 text-3xl font-bold text-white">{plannerWeekData.stats.conflictCount}</div>
                    </div>
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-7">
                    {plannerWeekData.days.map((day) => (
                        <DayColumn
                            key={day.id}
                            day={day}
                            onCreate={openNewComposer}
                            onEdit={openEditComposer}
                            onDelete={onDeletePlannerEntry}
                            onToggle={onTogglePlannerEntryCompletion}
                            onOpenSource={(sourceType) => onSelectTab(sourceType === 'event' ? 'events' : sourceType === 'deadline' ? 'deadlines' : 'reminders')}
                        />
                    ))}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Legend</div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {PLANNER_CATEGORIES.map((category) => (
                                <span key={category.id} className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.18em] ${category.badgeClassName}`}>
                                    {category.label}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Conflict watch</div>
                        <div className="mt-4 space-y-3">
                            {plannerWeekData.conflicts.length === 0 ? (
                                <div className="rounded-[1rem] border border-dashed border-white/10 px-4 py-5 text-sm text-white/55">
                                    No overlaps right now. Your weekly plan is structurally clean.
                                </div>
                            ) : (
                                plannerWeekData.conflicts.map((conflict) => (
                                    <div key={conflict.id} className="rounded-[1rem] border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                                        {conflict.date}: {conflict.title}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <PlannerSection title="Today" description="Items that are already due, happening today, or need immediate attention." emptyMessage="Today looks relatively clear. Use this space for deeper work or prep for upcoming tasks." items={todayItems} onItemAction={onItemAction} onSelectTab={onSelectTab} />
                <PlannerSection title="High Risk Items" description="Tasks pushed up by urgency, overlap, and your current focus signals." emptyMessage="No high-risk items right now. Your upcoming workload is looking manageable." items={highRiskItems} onItemAction={onItemAction} onSelectTab={onSelectTab} />
            </div>

            <PlannerSection title="This Week" description="A prioritized weekly runway built from deadlines, reminders, events, and your saved planner blocks." emptyMessage="Nothing is scheduled for the next 7 days yet." items={weekItems} onItemAction={onItemAction} onSelectTab={onSelectTab} />

            {composerOpen ? (
                <PlannerComposer
                    draft={draft}
                    isEditing={isEditing}
                    validationError={validationError}
                    onChange={handleChangeDraft}
                    onClose={closeComposer}
                    onSave={handleSave}
                />
            ) : null}
        </div>
    );
}
