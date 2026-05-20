'use client';
import { useEffect, useEffectEvent, useRef } from 'react';
import { SEND_EMAIL_API_URL } from '@/lib/smart-campus/constants';
import { parseDateTimeLocal } from '@/lib/smart-campus/utils';
export function useReminderScheduler({ reminders, deadlines, isDataLoaded, userEmail, }) {
    const notificationTimersRef = useRef({});
    const notificationPermissionRequestedRef = useRef(false);
    const ensureNotificationPermission = async () => {
        if (typeof window === 'undefined')
            return false;
        if (!('Notification' in window))
            return false;
        if (Notification.permission === 'granted')
            return true;
        if (Notification.permission === 'denied')
            return false;
        if (!notificationPermissionRequestedRef.current) {
            notificationPermissionRequestedRef.current = true;
            return (await Notification.requestPermission()) === 'granted';
        }
        return false;
    };
    const scheduleNotificationMoments = async (params) => {
        if (typeof window === 'undefined')
            return false;
        if (!('Notification' in window))
            return false;
        if (!params?.date || !params?.time || !params?.title)
            return false;
        const permissionOk = await ensureNotificationPermission();
        if (!permissionOk)
            return false;
        const targetDate = parseDateTimeLocal(params.date, params.time);
        if (targetDate.getTime() <= Date.now())
            return false;
        let scheduled = false;
        params.offsets.forEach((offsetHours) => {
            const timerKey = `${params.itemId}-${offsetHours}h`;
            if (notificationTimersRef.current[timerKey]) {
                scheduled = true;
                return;
            }
            const notifyAt = targetDate.getTime() - offsetHours * 60 * 60 * 1000;
            const timeUntil = notifyAt - Date.now();
            if (timeUntil <= 0)
                return;
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
    const scheduleNotificationForReminder = async (reminder) => {
        if (!reminder?.date || !reminder?.time || !reminder?.eventName)
            return false;
        const offsets = Array.isArray(reminder?.offsets) && reminder.offsets.length > 0
            ? reminder.offsets.filter((offset) => Number.isFinite(offset) && offset >= 0)
            : [6, 2, 0];
        return scheduleNotificationMoments({
            itemId: reminder.id,
            title: 'Reminder Alert',
            bodyBuilder: (offsetHours) => offsetHours === 0
                ? `${reminder.eventName} is happening now.`
                : `${reminder.eventName} is coming up in ${offsetHours} hours.`,
            date: reminder.date,
            time: reminder.time,
            offsets,
        });
    };
    const scheduleNotificationForDeadline = async (deadline) => {
        if (!deadline?.date || !deadline?.time || !deadline?.title || deadline.completed)
            return false;
        const offsets = Array.isArray(deadline?.offsets) && deadline.offsets.length > 0
            ? deadline.offsets.filter((offset) => Number.isFinite(offset) && offset >= 0)
            : [6, 2, 0];
        return scheduleNotificationMoments({
            itemId: deadline.id,
            title: 'Deadline Alert',
            bodyBuilder: (offsetHours) => offsetHours === 0
                ? `${deadline.title} is due now.`
                : `${deadline.title} is due in ${offsetHours} hours.`,
            date: deadline.date,
            time: deadline.time,
            offsets,
        });
    };
    const cancelScheduledNotification = (itemId) => {
        Object.keys(notificationTimersRef.current)
            .filter((key) => key === itemId || key.startsWith(`${itemId}-`))
            .forEach((key) => {
            clearTimeout(notificationTimersRef.current[key]);
            delete notificationTimersRef.current[key];
        });
    };
    const sendReminderEmailNow = async (payload) => {
        if (!SEND_EMAIL_API_URL)
            return;
        try {
            const response = await fetch(SEND_EMAIL_API_URL, {
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
            if (!response.ok) {
                const details = await response.text();
                console.error('Reminder email request failed:', response.status, details);
            }
        }
        catch (error) {
            console.error('Reminder email request crashed:', error);
        }
    };
    const sendImmediateCreationEmail = async (params) => {
        if (!params.email)
            return;
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
        if (!isDataLoaded || !userEmail)
            return;
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
        }
        catch {
            // Best effort only. The next state change or refresh will re-sync.
        }
    });
    const scheduleLoadedReminder = useEffectEvent((reminder, notificationsSupported) => {
        if (notificationsSupported && Notification.permission !== 'denied') {
            void scheduleNotificationForReminder(reminder);
        }
    });
    const scheduleLoadedDeadline = useEffectEvent((deadline) => {
        if (deadline.completed)
            return;
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'denied') {
            void scheduleNotificationForDeadline(deadline);
        }
    });
    useEffect(() => {
        if (!isDataLoaded || typeof window === 'undefined')
            return;
        const notificationsSupported = 'Notification' in window;
        const seenEventNames = new Set();
        reminders.forEach((reminder) => {
            if (seenEventNames.has(reminder.eventName))
                return;
            seenEventNames.add(reminder.eventName);
            scheduleLoadedReminder(reminder, notificationsSupported);
        });
    }, [isDataLoaded, reminders, userEmail]);
    useEffect(() => {
        if (!isDataLoaded || typeof window === 'undefined')
            return;
        deadlines.forEach((deadline) => {
            scheduleLoadedDeadline(deadline);
        });
    }, [deadlines, isDataLoaded, userEmail]);
    useEffect(() => {
        if (!isDataLoaded)
            return;
        void syncServerEmailJobs();
    }, [deadlines, isDataLoaded, reminders, userEmail]);
    return {
        cancelScheduledNotification,
        sendImmediateCreationEmail,
        scheduleNotificationForDeadline,
        scheduleNotificationForReminder,
    };
}
