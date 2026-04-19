import type { Deadline, Reminder } from '../smart-campus/types';

export type ReminderJobItemType = 'reminder' | 'deadline';
export type ReminderJobStatus = 'pending' | 'sent' | 'cancelled' | 'failed';

export type ReminderJobRecord = {
  user_id: string;
  recipient_email: string;
  job_key: string;
  item_id: string;
  item_name: string;
  item_type: ReminderJobItemType;
  date: string;
  time: string;
  offset_hours: number;
  delivery_reason: 'scheduled';
  event_at: string;
  scheduled_for: string;
  status: ReminderJobStatus;
  attempts: number;
  last_error: string | null;
};

const CAMPUS_TIME_ZONE_OFFSET = '+05:30';

function parseTimeParts(time: string) {
  const match = time.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  const meridiem = match[3].toUpperCase();

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    return null;
  }

  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  return {
    hours,
    minutes,
  };
}

function toCampusIso(date: string, time: string) {
  const timeParts = parseTimeParts(time);
  if (!timeParts) return null;

  const timestamp = new Date(
    `${date}T${String(timeParts.hours).padStart(2, '0')}:${String(timeParts.minutes).padStart(2, '0')}:00${CAMPUS_TIME_ZONE_OFFSET}`
  );

  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function buildScheduledJob(params: {
  userId: string;
  recipientEmail: string;
  itemId: string;
  itemName: string;
  itemType: ReminderJobItemType;
  date: string;
  time: string;
  offsetHours: number;
}) {
  const eventAt = toCampusIso(params.date, params.time);
  if (!eventAt) return null;

  const scheduledFor = new Date(new Date(eventAt).getTime() - params.offsetHours * 60 * 60 * 1000);
  if (scheduledFor.getTime() <= Date.now()) return null;

  return {
    user_id: params.userId,
    recipient_email: params.recipientEmail,
    job_key: `${params.itemType}:${params.itemId}:${params.offsetHours}h`,
    item_id: params.itemId,
    item_name: params.itemName,
    item_type: params.itemType,
    date: params.date,
    time: params.time,
    offset_hours: params.offsetHours,
    delivery_reason: 'scheduled' as const,
    event_at: eventAt,
    scheduled_for: scheduledFor.toISOString(),
    status: 'pending' as const,
    attempts: 0,
    last_error: null,
  };
}

export function buildReminderEmailJobs(params: {
  userId: string;
  recipientEmail: string;
  reminders: Reminder[];
  deadlines: Deadline[];
}) {
  const jobs: ReminderJobRecord[] = [];

  params.reminders.forEach((reminder) => {
    [6, 2, 0].forEach((offsetHours) => {
      const job = buildScheduledJob({
        userId: params.userId,
        recipientEmail: params.recipientEmail,
        itemId: reminder.id,
        itemName: reminder.eventName,
        itemType: 'reminder',
        date: reminder.date,
        time: reminder.time,
        offsetHours,
      });

      if (job) jobs.push(job);
    });
  });

  params.deadlines
    .filter((deadline) => !deadline.completed)
    .forEach((deadline) => {
      [6, 2].forEach((offsetHours) => {
        const job = buildScheduledJob({
          userId: params.userId,
          recipientEmail: params.recipientEmail,
          itemId: deadline.id,
          itemName: deadline.title,
          itemType: 'deadline',
          date: deadline.date,
          time: deadline.time,
          offsetHours,
        });

        if (job) jobs.push(job);
      });
    });

  return jobs.sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
}
