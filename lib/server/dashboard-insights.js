export function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function formatList(items) {
    if (items.length === 0)
        return '';
    if (items.length === 1)
        return items[0];
    if (items.length === 2)
        return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
function getDaysUntil(dateText) {
    if (!dateText)
        return null;
    const parsed = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(parsed.getTime()))
        return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    const diffMs = target.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
export function buildInsights({ events, clubs, reminders, deadlines, attentionStats, }) {
    const insights = [];
    const joinedClubs = clubs.filter((club) => club.joined);
    const attendedEvents = events.filter((event) => event.checkedIn);
    const attendingEvents = events.filter((event) => event.attending);
    const pendingDeadlines = deadlines.filter((deadline) => !deadline.completed);
    const completedDeadlines = deadlines.filter((deadline) => deadline.completed);
    const eventTypeCounts = events.reduce((acc, event) => {
        const type = event.type?.trim().toLowerCase();
        if (!type)
            return acc;
        acc[type] = (acc[type] ?? 0) + 1;
        return acc;
    }, {});
    const topEventTypes = Object.entries(eventTypeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([type]) => type);
    const clubCategoryCounts = clubs.reduce((acc, club) => {
        if (!club.joined)
            return acc;
        const category = club.category?.trim().toLowerCase();
        if (!category)
            return acc;
        acc[category] = (acc[category] ?? 0) + 1;
        return acc;
    }, {});
    const topClubCategories = Object.entries(clubCategoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([category]) => category);
    const urgentDeadlines = pendingDeadlines
        .map((deadline) => ({
        ...deadline,
        daysUntil: getDaysUntil(deadline.date),
    }))
        .filter((deadline) => deadline.daysUntil !== null && deadline.daysUntil <= 3)
        .sort((a, b) => (a.daysUntil ?? Number.MAX_SAFE_INTEGER) - (b.daysUntil ?? Number.MAX_SAFE_INTEGER));
    const remindersWithoutAttendance = reminders.filter((reminder) => !events.some((event) => event.name === reminder.eventName && event.checkedIn));
    if (urgentDeadlines.length >= 2) {
        insights.push(`You have ${urgentDeadlines.length} deadlines landing within the next 3 days, so this is a crunch window where protecting study blocks matters.`);
    }
    else if (pendingDeadlines.length >= 3) {
        insights.push(`You are juggling ${pendingDeadlines.length} open deadlines right now, which makes you look most productive when tasks are broken into smaller checkpoints.`);
    }
    else if (completedDeadlines.length > 0 && pendingDeadlines.length === 0) {
        insights.push('You have cleared every tracked deadline so far, which suggests you are closing the loop well once work is scheduled.');
    }
    if (topEventTypes.length > 0) {
        insights.push(`Your event activity leans toward ${formatList(topEventTypes)}, so the app can start prioritizing those opportunities in your dashboard and chat suggestions.`);
    }
    if (topClubCategories.length > 0) {
        insights.push(`Your club choices cluster around ${formatList(topClubCategories)}, which points to a consistent campus identity instead of one-off signups.`);
    }
    else if (joinedClubs.length >= 2) {
        insights.push(`You have already committed to ${joinedClubs.length} clubs, so recurring communities seem to matter more to you than one-time campus drop-ins.`);
    }
    if (attendedEvents.length > 0 && remindersWithoutAttendance.length > 0) {
        insights.push(`You do follow through on some events, but ${remindersWithoutAttendance.length} reminders have not turned into check-ins yet, so nudging yourself earlier may help convert intent into attendance.`);
    }
    else if (attendingEvents.length > attendedEvents.length && attendingEvents.length > 0) {
        insights.push('You mark interest in more events than you check in to, which suggests discovery is strong but follow-through could use tighter reminders.');
    }
    const tabBreakdown = Object.entries(attentionStats).map(([tab, stat]) => ({
        tab,
        focusedMs: stat.focusedMs ?? 0,
        backgroundMs: stat.backgroundMs ?? 0,
        visits: stat.visits ?? 0,
    }));
    const totalFocusedMs = tabBreakdown.reduce((sum, tab) => sum + tab.focusedMs, 0);
    const totalBackgroundMs = tabBreakdown.reduce((sum, tab) => sum + tab.backgroundMs, 0);
    const mostFocusedTab = tabBreakdown.reduce((best, current) => (!best || current.focusedMs > best.focusedMs ? current : best), null);
    if (totalFocusedMs > 0 && mostFocusedTab) {
        const focusRatio = totalFocusedMs / Math.max(1, totalFocusedMs + totalBackgroundMs);
        if (focusRatio >= 0.7) {
            insights.push(`Your focus habits look steady right now: most of your active time stays in ${mostFocusedTab.tab}, with relatively little background drift.`);
        }
        else if (totalBackgroundMs > totalFocusedMs) {
            insights.push('Your focus pattern is getting interrupted often, with more background time than active focus, so shorter sessions and stronger reminders may work better than long plans.');
        }
        else {
            insights.push(`Your strongest concentration zone is ${mostFocusedTab.tab}, but there is still enough background switching to suggest your routine is only partly settled.`);
        }
    }
    if (insights.length === 0) {
        insights.push('Your campus coach is ready, but it needs more signals. Join a club, add a deadline, set a reminder, or spend time in the app to build a stronger pattern profile.');
    }
    return insights.slice(0, 6);
}
export function buildInsightsPayload(body, state) {
    return {
        events: asArray(body?.events ?? state?.events),
        clubs: asArray(body?.clubs ?? state?.clubs),
        reminders: asArray(body?.reminders ?? state?.reminders),
        deadlines: asArray(body?.deadlines ?? state?.deadlines),
        attentionStats: body?.attentionStats ?? {},
    };
}
