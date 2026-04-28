import { APP_TABS, MAX_SAVED_MESSAGES } from './constants.js';

function createEmptyAttentionBucket() {
    return { focusedMs: 0, backgroundMs: 0, visits: 0 };
}

export function createInitialAttentionStats() {
    return Object.fromEntries(APP_TABS.map((tab) => [tab, createEmptyAttentionBucket()]));
}
export function formatDuration(totalMs) {
    const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0)
        return `${hours}h ${minutes}m`;
    if (minutes > 0)
        return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}
export function toPersistedMessages(messages) {
    return messages.slice(-MAX_SAVED_MESSAGES).map((message) => ({
        role: message.role,
        content: message.content,
        ...(typeof message.memoriesUsed === 'number' ? { memoriesUsed: message.memoriesUsed } : {}),
    }));
}
export function parseDateTimeLocal(date, time) {
    const timeParts = time.trim().split(/\s+/);
    if (timeParts.length < 2) {
        return new Date(`${date} ${time}`);
    }
    const ampm = timeParts[1]?.toLowerCase();
    const hm = timeParts[0];
    const [hStr, mStr] = hm.split(':');
    const ymd = date.split('-').map((x) => Number(x));
    if (ymd.length !== 3 || Number.isNaN(ymd[0]) || Number.isNaN(ymd[1]) || Number.isNaN(ymd[2])) {
        return new Date(`${date} ${time}`);
    }
    let hours = Number(hStr);
    const minutes = mStr ? Number(mStr) : 0;
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return new Date(`${date} ${time}`);
    }
    if (ampm === 'pm' && hours < 12)
        hours += 12;
    if (ampm === 'am' && hours === 12)
        hours = 0;
    return new Date(ymd[0], ymd[1] - 1, ymd[2], hours, minutes, 0, 0);
}
export function dedupeReminderByEventName(reminders, nextReminder) {
    return [...reminders.filter((reminder) => reminder.eventName !== nextReminder.eventName), nextReminder];
}
export function removeRemindersByEventName(reminders, eventName) {
    return reminders.filter((reminder) => reminder.eventName !== eventName);
}
export function getAttentionSummary(attentionStats) {
    const normalizedAttentionStats = Object.fromEntries(APP_TABS.map((tab) => [tab, {
        ...createEmptyAttentionBucket(),
        ...(attentionStats?.[tab] && typeof attentionStats[tab] === 'object' ? attentionStats[tab] : {}),
    }]));
    const totalFocusedMs = APP_TABS.reduce((sum, tab) => sum + normalizedAttentionStats[tab].focusedMs, 0);
    const totalBackgroundMs = APP_TABS.reduce((sum, tab) => sum + normalizedAttentionStats[tab].backgroundMs, 0);
    const totalVisits = APP_TABS.reduce((sum, tab) => sum + normalizedAttentionStats[tab].visits, 0);
    const focusRatio = totalFocusedMs + totalBackgroundMs > 0
        ? totalFocusedMs / (totalFocusedMs + totalBackgroundMs)
        : 0;
    const averageFocusPerVisitMs = totalVisits > 0 ? totalFocusedMs / totalVisits : 0;
    const mostFocusedTab = APP_TABS.reduce((best, tab) => (normalizedAttentionStats[tab].focusedMs > normalizedAttentionStats[best].focusedMs ? tab : best), APP_TABS[0]);
    const mostDistractedTab = APP_TABS.reduce((best, tab) => (normalizedAttentionStats[tab].backgroundMs > normalizedAttentionStats[best].backgroundMs ? tab : best), APP_TABS[0]);
    return {
        totalFocusedMs,
        totalBackgroundMs,
        totalVisits,
        focusRatio,
        averageFocusPerVisitMs,
        mostFocusedTab,
        mostDistractedTab,
        tabAttentionBreakdown: APP_TABS.map((tab) => ({
            id: tab,
            focusedMs: normalizedAttentionStats[tab].focusedMs,
            backgroundMs: normalizedAttentionStats[tab].backgroundMs,
            visits: normalizedAttentionStats[tab].visits,
            totalMs: normalizedAttentionStats[tab].focusedMs + normalizedAttentionStats[tab].backgroundMs,
        })).sort((a, b) => b.focusedMs - a.focusedMs),
    };
}
export function isDeadlineOpen(deadline) {
    return !deadline.completed;
}
