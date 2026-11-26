import { getCampusDate, getCampusDateTime } from './event-checkin.js';

function normalizeEventTime(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const match = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
    return match ? `${match[1]}:${match[2]}:${match[3] || '00'}` : fallback;
}

export function getPublishedEventState(event, now = new Date()) {
    const campusNow = getCampusDateTime(now);
    const startDateTime = `${event.proposed_date}T${normalizeEventTime(event.time_start, '00:00:00')}`;
    const endDate = event.event_end_date || event.proposed_date;
    const endDateTime = `${endDate}T${normalizeEventTime(event.time_end, '23:59:59')}`;
    const registrationStartsAt = event.registration_starts
        ? new Date(event.registration_starts).getTime()
        : null;
    const isPast = campusNow > endDateTime;
    const hasStarted = campusNow >= startDateTime;

    return {
        is_today: event.proposed_date === getCampusDate(now),
        is_past: isPast,
        has_started: hasStarted,
        registration_open: !isPast && (
            registrationStartsAt === null || now.getTime() >= registrationStartsAt
        ),
        is_upcoming: !hasStarted && !isPast
            && registrationStartsAt !== null
            && now.getTime() < registrationStartsAt,
    };
}
