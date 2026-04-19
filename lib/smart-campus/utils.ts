import { APP_TABS, MAX_SAVED_MESSAGES } from './constants.ts';
import type {
  AttentionStats,
  Deadline,
  Message,
  PersistedMessage,
  Reminder,
} from './types.ts';

export function createInitialAttentionStats(): AttentionStats {
  return {
    chat: { focusedMs: 0, backgroundMs: 0, visits: 0 },
    events: { focusedMs: 0, backgroundMs: 0, visits: 0 },
    clubs: { focusedMs: 0, backgroundMs: 0, visits: 0 },
    reminders: { focusedMs: 0, backgroundMs: 0, visits: 0 },
    deadlines: { focusedMs: 0, backgroundMs: 0, visits: 0 },
    navigation: { focusedMs: 0, backgroundMs: 0, visits: 0 },
    attention: { focusedMs: 0, backgroundMs: 0, visits: 0 },
    dashboard: { focusedMs: 0, backgroundMs: 0, visits: 0 },
    profile: { focusedMs: 0, backgroundMs: 0, visits: 0 },
  };
}

export function formatDuration(totalMs: number) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function toPersistedMessages(messages: Message[]): PersistedMessage[] {
  return messages.slice(-MAX_SAVED_MESSAGES).map((message) => ({
    role: message.role,
    content: message.content,
    ...(typeof message.memoriesUsed === 'number' ? { memoriesUsed: message.memoriesUsed } : {}),
  }));
}

export function parseDateTimeLocal(date: string, time: string) {
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

  if (ampm === 'pm' && hours < 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;

  return new Date(ymd[0], ymd[1] - 1, ymd[2], hours, minutes, 0, 0);
}

export function dedupeReminderByEventName(reminders: Reminder[], nextReminder: Reminder) {
  return [...reminders.filter((reminder) => reminder.eventName !== nextReminder.eventName), nextReminder];
}

export function removeRemindersByEventName(reminders: Reminder[], eventName: string) {
  return reminders.filter((reminder) => reminder.eventName !== eventName);
}

export function getAttentionSummary(attentionStats: AttentionStats) {
  const totalFocusedMs = APP_TABS.reduce((sum, tab) => sum + attentionStats[tab].focusedMs, 0);
  const totalBackgroundMs = APP_TABS.reduce((sum, tab) => sum + attentionStats[tab].backgroundMs, 0);
  const totalVisits = APP_TABS.reduce((sum, tab) => sum + attentionStats[tab].visits, 0);
  const focusRatio = totalFocusedMs + totalBackgroundMs > 0
    ? totalFocusedMs / (totalFocusedMs + totalBackgroundMs)
    : 0;
  const averageFocusPerVisitMs = totalVisits > 0 ? totalFocusedMs / totalVisits : 0;
  const mostFocusedTab = APP_TABS.reduce(
    (best, tab) => (attentionStats[tab].focusedMs > attentionStats[best].focusedMs ? tab : best),
    APP_TABS[0]
  );
  const mostDistractedTab = APP_TABS.reduce(
    (best, tab) => (attentionStats[tab].backgroundMs > attentionStats[best].backgroundMs ? tab : best),
    APP_TABS[0]
  );

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
      focusedMs: attentionStats[tab].focusedMs,
      backgroundMs: attentionStats[tab].backgroundMs,
      visits: attentionStats[tab].visits,
      totalMs: attentionStats[tab].focusedMs + attentionStats[tab].backgroundMs,
    })).sort((a, b) => b.focusedMs - a.focusedMs),
  };
}

export function isDeadlineOpen(deadline: Deadline) {
  return !deadline.completed;
}
