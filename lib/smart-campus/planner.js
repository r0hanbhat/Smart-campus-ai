import { parseDateTimeLocal } from './utils.js';

export const PLANNER_CATEGORIES = [
    { id: 'study', label: 'Study', badgeClassName: 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100' },
    { id: 'class', label: 'Class', badgeClassName: 'border-violet-400/30 bg-violet-500/15 text-violet-100' },
    { id: 'assignment', label: 'Assignment', badgeClassName: 'border-amber-400/30 bg-amber-500/15 text-amber-100' },
    { id: 'meeting', label: 'Meeting', badgeClassName: 'border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-100' },
    { id: 'wellness', label: 'Wellness', badgeClassName: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100' },
    { id: 'personal', label: 'Personal', badgeClassName: 'border-white/15 bg-white/10 text-white' },
];

export const PLANNER_CATEGORY_MAP = Object.fromEntries(PLANNER_CATEGORIES.map((category) => [category.id, category]));
export const MIN_PLANNER_LEAD_MINUTES = 20;

const DEFAULT_EXTERNAL_DURATION_MINUTES = {
    deadline: 45,
    reminder: 30,
    event: 90,
};

function pad(value) {
    return `${value}`.padStart(2, '0');
}

export function toDateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getStartOfWeek(inputDate) {
    const date = new Date(inputDate);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + mondayOffset);
    return date;
}

export function addDays(inputDate, days) {
    const date = new Date(inputDate);
    date.setDate(date.getDate() + days);
    return date;
}

export function timeStringToMinutes(time) {
    const [hours, minutes] = `${time || ''}`.split(':').map((value) => Number(value));
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return 0;
    }
    return hours * 60 + minutes;
}

export function minutesToTimeString(totalMinutes) {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
    const hours = Math.floor(clamped / 60);
    const minutes = clamped % 60;
    return `${pad(hours)}:${pad(minutes)}`;
}

export function formatPlannerTime(time) {
    const minutes = timeStringToMinutes(time);
    const hours24 = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const suffix = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `${hours12}:${pad(mins)} ${suffix}`;
}

export function formatPlannerRange(startTime, endTime) {
    return `${formatPlannerTime(startTime)} - ${formatPlannerTime(endTime)}`;
}

export function getMinimumPlannerStartTime(dateKey, now = new Date()) {
    if (!dateKey || dateKey !== toDateKey(now)) {
        return '';
    }
    const minimumStartDate = new Date(now.getTime() + MIN_PLANNER_LEAD_MINUTES * 60 * 1000);
    return `${pad(minimumStartDate.getHours())}:${pad(minimumStartDate.getMinutes())}`;
}

export function getPlannerValidationError(entry, now = new Date()) {
    const dateKey = entry?.date;
    const startTime = entry?.startTime;
    const endTime = entry?.endTime;
    if (!dateKey || !startTime || !endTime) {
        return null;
    }
    const todayKey = toDateKey(now);
    if (dateKey < todayKey) {
        return 'You cannot create planner blocks for past dates.';
    }
    const minimumStartTime = getMinimumPlannerStartTime(dateKey, now);
    if (minimumStartTime && timeStringToMinutes(startTime) < timeStringToMinutes(minimumStartTime)) {
        return `Today's planner blocks must start at least ${MIN_PLANNER_LEAD_MINUTES} minutes from now.`;
    }
    if (timeStringToMinutes(endTime) <= timeStringToMinutes(startTime)) {
        return 'End time must be after the start time.';
    }
    return null;
}

export function normalizePlannerEntry(entry, now = new Date()) {
    const date = entry?.date || toDateKey(now);
    const defaultStartTime = getMinimumPlannerStartTime(date, now) || '09:00';
    const startTime = entry?.startTime || defaultStartTime;
    const fallbackEnd = minutesToTimeString(timeStringToMinutes(startTime) + 90);
    const category = PLANNER_CATEGORY_MAP[entry?.category] ? entry.category : 'study';
    return {
        id: entry?.id || `${Date.now()}`,
        title: entry?.title?.trim() || 'Untitled plan',
        date,
        startTime,
        endTime: entry?.endTime || fallbackEnd,
        category,
        notes: entry?.notes || '',
        recurrence: entry?.recurrence === 'weekly' ? 'weekly' : 'none',
        completed: Boolean(entry?.completed),
        sourceType: entry?.sourceType || 'manual',
        sourceId: entry?.sourceId || null,
        createdAt: entry?.createdAt || new Date().toISOString(),
    };
}

function expandEntryForWeek(entry, weekStart, weekEnd) {
    if (entry.recurrence !== 'weekly') {
        return entry.date >= toDateKey(weekStart) && entry.date <= toDateKey(weekEnd) ? [entry] : [];
    }
    const originalDate = new Date(`${entry.date}T00:00:00`);
    if (Number.isNaN(originalDate.getTime())) {
        return [];
    }
    const weekDate = addDays(weekStart, (originalDate.getDay() + 6) % 7);
    const occurrenceDate = toDateKey(weekDate);
    return [
        {
            ...entry,
            id: `${entry.id}-${occurrenceDate}`,
            originalId: entry.id,
            date: occurrenceDate,
            isRecurringOccurrence: true,
        },
    ];
}

function createScheduleItem(base) {
    const startMinutes = timeStringToMinutes(base.startTime);
    const endMinutes = timeStringToMinutes(base.endTime);
    return {
        ...base,
        startMinutes,
        endMinutes,
        durationMinutes: Math.max(0, endMinutes - startMinutes),
        timeLabel: formatPlannerRange(base.startTime, base.endTime),
    };
}

function createTimedExternalItem({ id, title, date, time, kind, category, subtitle, sourceId, sourceType, completed, }) {
    const durationMinutes = DEFAULT_EXTERNAL_DURATION_MINUTES[kind] || 60;
    const startDate = parseDateTimeLocal(date, time);
    if (Number.isNaN(startDate.getTime())) {
        return null;
    }
    const startTime = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;
    const endTime = minutesToTimeString(timeStringToMinutes(startTime) + durationMinutes);
    return createScheduleItem({
        id,
        title,
        date,
        startTime,
        endTime,
        kind,
        category,
        subtitle,
        sourceId,
        sourceType,
        completed: Boolean(completed),
        editable: false,
    });
}

function compareItemsByTime(a, b) {
    if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
    }
    if (a.startMinutes !== b.startMinutes) {
        return a.startMinutes - b.startMinutes;
    }
    return a.title.localeCompare(b.title);
}

export function buildWeeklyPlannerView({ plannerEntries, events, reminders, deadlines, weekStartDate = new Date(), }) {
    const weekStart = getStartOfWeek(weekStartDate);
    const weekEnd = addDays(weekStart, 6);
    weekEnd.setHours(23, 59, 59, 999);
    const normalizedEntries = (plannerEntries || []).map((entry) => normalizePlannerEntry(entry));
    const manualItems = normalizedEntries.flatMap((entry) => expandEntryForWeek(entry, weekStart, weekEnd)).map((entry) => createScheduleItem({
        id: entry.id,
        sourceId: entry.originalId || entry.id,
        sourceType: entry.sourceType,
        title: entry.title,
        subtitle: entry.notes || (entry.recurrence === 'weekly' ? 'Repeats every week.' : 'Planner block you created.'),
        date: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        kind: 'planner',
        category: entry.category,
        completed: entry.completed,
        recurrence: entry.recurrence,
        editable: true,
    }));
    const reminderItems = (reminders || [])
        .map((reminder) => createTimedExternalItem({
        id: `reminder-${reminder.id}`,
        title: reminder.eventName,
        date: reminder.date,
        time: reminder.time,
        kind: 'reminder',
        category: 'personal',
        subtitle: 'Reminder imported from your reminder list.',
        sourceId: reminder.id,
        sourceType: 'reminder',
        completed: false,
    }))
        .filter(Boolean)
        .filter((item) => item.date >= toDateKey(weekStart) && item.date <= toDateKey(weekEnd));
    const deadlineItems = (deadlines || [])
        .filter((deadline) => !deadline.completed)
        .map((deadline) => createTimedExternalItem({
        id: `deadline-${deadline.id}`,
        title: deadline.title,
        date: deadline.date,
        time: deadline.time || '11:59 PM',
        kind: 'deadline',
        category: 'assignment',
        subtitle: 'Open deadline imported from your task list.',
        sourceId: deadline.id,
        sourceType: 'deadline',
        completed: false,
    }))
        .filter(Boolean)
        .filter((item) => item.date >= toDateKey(weekStart) && item.date <= toDateKey(weekEnd));
    const eventItems = (events || [])
        .filter((event) => !event.checkedIn)
        .map((event) => createTimedExternalItem({
        id: `event-${event.id}`,
        title: event.name,
        date: event.date,
        time: event.time,
        kind: 'event',
        category: event.attending ? 'meeting' : 'personal',
        subtitle: event.location ? `${event.location}${event.attending ? ' | RSVPed' : ' | Optional event'}` : 'Campus event',
        sourceId: event.id,
        sourceType: 'event',
        completed: Boolean(event.checkedIn),
    }))
        .filter(Boolean)
        .filter((item) => item.date >= toDateKey(weekStart) && item.date <= toDateKey(weekEnd));
    const scheduleItems = [...manualItems, ...deadlineItems, ...reminderItems, ...eventItems].sort(compareItemsByTime);
    const conflictMap = new Map();
    const conflicts = [];
    for (let index = 0; index < scheduleItems.length; index += 1) {
        for (let compareIndex = index + 1; compareIndex < scheduleItems.length; compareIndex += 1) {
            const current = scheduleItems[index];
            const next = scheduleItems[compareIndex];
            if (current.date !== next.date) {
                continue;
            }
            if (current.endMinutes <= next.startMinutes || next.endMinutes <= current.startMinutes) {
                continue;
            }
            conflictMap.set(current.id, true);
            conflictMap.set(next.id, true);
            conflicts.push({
                id: `${current.id}-${next.id}`,
                date: current.date,
                title: `${current.title} overlaps ${next.title}`,
            });
        }
    }
    const days = Array.from({ length: 7 }, (_, offset) => {
        const date = addDays(weekStart, offset);
        const dateKey = toDateKey(date);
        const todayKey = toDateKey(new Date());
        const items = scheduleItems.filter((item) => item.date === dateKey).map((item) => ({
            ...item,
            isConflicting: conflictMap.has(item.id),
        }));
        const totalMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
        return {
            id: dateKey,
            date,
            dateKey,
            dayLabel: date.toLocaleDateString([], { weekday: 'short' }),
            dateLabel: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            isToday: dateKey === todayKey,
            isPast: dateKey < todayKey,
            items,
            totalMinutes,
        };
    });
    const manualMinutes = manualItems.reduce((sum, item) => sum + item.durationMinutes, 0);
    const busiestDay = days.reduce((best, day) => (day.totalMinutes > best.totalMinutes ? day : best), days[0]);
    return {
        weekLabel: `${weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${addDays(weekStart, 6).toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
        weekStart,
        days,
        conflicts,
        stats: {
            totalScheduledHours: Math.round((scheduleItems.reduce((sum, item) => sum + item.durationMinutes, 0) / 60) * 10) / 10,
            manualScheduledHours: Math.round((manualMinutes / 60) * 10) / 10,
            busyDayLabel: busiestDay?.totalMinutes ? `${busiestDay.dayLabel} (${Math.round((busiestDay.totalMinutes / 60) * 10) / 10}h)` : 'No heavy day yet',
            conflictCount: conflicts.length,
            plannerCount: manualItems.length,
        },
    };
}
