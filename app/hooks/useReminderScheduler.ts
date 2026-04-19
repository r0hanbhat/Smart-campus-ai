'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import { SEND_EMAIL_API_URL } from '@/lib/smart-campus/constants';
import { parseDateTimeLocal } from '@/lib/smart-campus/utils';
import type { Deadline, Reminder } from '@/lib/smart-campus/types';

type UseReminderSchedulerParams = {
  reminders: Reminder[];
  deadlines: Deadline[];
  isDataLoaded: boolean;
  userEmail: string;
};

export function useReminderScheduler({
  reminders,
  deadlines,
  isDataLoaded,
  userEmail,
}: UseReminderSchedulerParams) {
  const notificationTimersRef = useRef<Record<string, number>>({});
  const notificationPermissionRequestedRef = useRef(false);

  const ensureNotificationPermission = async () => {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    if (!notificationPermissionRequestedRef.current) {
      notificationPermissionRequestedRef.current = true;
      return (await Notification.requestPermission()) === 'granted';
    }
    return false;
  };

  const scheduleNotificationMoments = async (params: {
    itemId: string;
    title: string;
    bodyBuilder: (offsetHours: number) => string;
    date: string;
    time: string;
    offsets: number[];
  }) => {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) return false;
    if (!params?.date || !params?.time || !params?.title) return false;
    const permissionOk = await ensureNotificationPermission();
    if (!permissionOk) return false;

    const targetDate = parseDateTimeLocal(params.date, params.time);
    if (targetDate.getTime() <= Date.now()) return false;

    let scheduled = false;

    params.offsets.forEach((offsetHours) => {
      const timerKey = `${params.itemId}-${offsetHours}h`;
      if (notificationTimersRef.current[timerKey]) {
        scheduled = true;
        return;
      }

      const notifyAt = targetDate.getTime() - offsetHours * 60 * 60 * 1000;
      const timeUntil = notifyAt - Date.now();
      if (timeUntil <= 0) return;

      notificationTimersRef.current[timerKey] = window.setTimeout(() => {
        new Notification(params.title, {
          body: params.bodyBuilder(offsetHours),
          tag: timerKey,
        });
      }, timeUntil);

      scheduled = true;
    });

    return scheduled;
  };

  const scheduleNotificationForReminder = async (reminder: Reminder) => {
    if (!reminder?.date || !reminder?.time || !reminder?.eventName) return false;
    return scheduleNotificationMoments({
      itemId: reminder.id,
      title: 'Reminder Alert',
      bodyBuilder: (offsetHours) =>
        offsetHours === 0
          ? `${reminder.eventName} is happening now.`
          : `${reminder.eventName} is coming up in ${offsetHours} hours.`,
      date: reminder.date,
      time: reminder.time,
      offsets: [6, 2, 0],
    });
  };

  const scheduleNotificationForDeadline = async (deadline: Deadline) => {
    if (!deadline?.date || !deadline?.time || !deadline?.title || deadline.completed) return false;
    return scheduleNotificationMoments({
      itemId: deadline.id,
      title: 'Deadline Alert',
      bodyBuilder: (offsetHours) => `${deadline.title} is due in ${offsetHours} hours.`,
      date: deadline.date,
      time: deadline.time,
      offsets: [6, 2],
    });
  };

  const cancelScheduledNotification = (itemId: string) => {
    Object.keys(notificationTimersRef.current)
      .filter((key) => key === itemId || key.startsWith(`${itemId}-`))
      .forEach((key) => {
        clearTimeout(notificationTimersRef.current[key]);
        delete notificationTimersRef.current[key];
      });
  };

  const sendReminderEmailNow = async (payload: {
    email: string;
    itemName: string;
    itemType: 'reminder' | 'deadline';
    date: string;
    time: string;
    offsetHours: number;
    deliveryReason?: 'created' | 'scheduled';
  }) => {
    if (!SEND_EMAIL_API_URL) return;

    try {
      await fetch(SEND_EMAIL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: payload.itemName,
          itemType: payload.itemType,
          date: payload.date,
          time: payload.time,
          offsetHours: payload.offsetHours,
          deliveryReason: payload.deliveryReason ?? 'scheduled',
        }),
      });
    } catch {
      // Best effort only.
    }
  };

  const sendImmediateCreationEmail = async (params: {
    itemName: string;
    itemType: 'reminder' | 'deadline';
    date: string;
    time: string;
    email: string;
  }) => {
    if (!params.email) return;

    await sendReminderEmailNow({
      email: params.email,
      itemName: params.itemName,
      itemType: params.itemType,
      date: params.date,
      time: params.time,
      offsetHours: 0,
      deliveryReason: 'created',
    });
  };

  const syncServerEmailJobs = useEffectEvent(async () => {
    if (!isDataLoaded || !userEmail) return;

    try {
      const response = await fetch('/api/reminder-jobs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminders,
          deadlines,
        }),
      });

      if (!response.ok) {
        return;
      }
    } catch {
      // Best effort only. The next state change or refresh will re-sync.
    }
  });

  const scheduleLoadedReminder = useEffectEvent((reminder: Reminder, notificationsSupported: boolean) => {
    if (notificationsSupported && Notification.permission !== 'denied') {
      void scheduleNotificationForReminder(reminder);
    }
  });

  const scheduleLoadedDeadline = useEffectEvent((deadline: Deadline) => {
    if (deadline.completed) return;
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'denied') {
      void scheduleNotificationForDeadline(deadline);
    }
  });

  useEffect(() => {
    if (!isDataLoaded || typeof window === 'undefined') return;
    const notificationsSupported = 'Notification' in window;

    const seenEventNames = new Set<string>();
    reminders.forEach((reminder) => {
      if (seenEventNames.has(reminder.eventName)) return;
      seenEventNames.add(reminder.eventName);
      scheduleLoadedReminder(reminder, notificationsSupported);
    });
  }, [isDataLoaded, reminders, userEmail]);

  useEffect(() => {
    if (!isDataLoaded || typeof window === 'undefined') return;
    deadlines.forEach((deadline) => {
      scheduleLoadedDeadline(deadline);
    });
  }, [deadlines, isDataLoaded, userEmail]);

  useEffect(() => {
    if (!isDataLoaded) return;
    void syncServerEmailJobs();
  }, [deadlines, isDataLoaded, reminders, userEmail]);

  return {
    cancelScheduledNotification,
    sendImmediateCreationEmail,
    scheduleNotificationForDeadline,
    scheduleNotificationForReminder,
  };
}
