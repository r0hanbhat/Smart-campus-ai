function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function makeTimestamp(...values) {
    for (const value of values) {
        if (!value) {
            continue;
        }
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            return date.toISOString();
        }
    }
    return new Date(0).toISOString();
}

function makeKeyPart(value) {
    return encodeURIComponent(String(value || 'unknown'));
}

export function buildInboxItems({
    reminders = [],
    deadlines = [],
    issues = [],
    notices = [],
    hostelAnnouncements = [],
    registeredEvents = [],
    chatNotifications = [],
    readKeys = [],
} = {}) {
    const readKeySet = new Set(readKeys);
    const items = [];
    const addItem = (item) => {
        items.push({
            ...item,
            isRead: readKeySet.has(item.key) || Boolean(item.source === 'chat' && item.isRead),
        });
    };

    for (const reminder of asArray(reminders)) {
        if (!reminder || typeof reminder !== 'object') {
            continue;
        }
        const title = text(reminder.eventName) || text(reminder.title) || 'Reminder';
        const id = text(reminder.id) || `${title}|${text(reminder.date)}|${text(reminder.time)}`;
        const when = [text(reminder.date), text(reminder.time)].filter(Boolean).join(' at ');
        addItem({
            key: `reminder:${makeKeyPart(id)}`,
            source: 'reminder',
            category: 'Reminder',
            title,
            message: when ? `Scheduled for ${when}.` : 'You have a reminder saved.',
            timestamp: makeTimestamp(reminder.createdAt, reminder.created_at, reminder.date),
            actionTab: 'reminders',
        });
    }

    for (const deadline of asArray(deadlines)) {
        if (!deadline || typeof deadline !== 'object' || deadline.completed) {
            continue;
        }
        const title = text(deadline.title) || 'Deadline';
        const id = text(deadline.id) || `${title}|${text(deadline.date)}|${text(deadline.time)}`;
        const when = [text(deadline.date), text(deadline.time)].filter(Boolean).join(' at ');
        addItem({
            key: `deadline:${makeKeyPart(id)}`,
            source: 'deadline',
            category: 'Deadline',
            title,
            message: when ? `Due ${when}.` : 'You have an open deadline.',
            timestamp: makeTimestamp(deadline.date, deadline.createdAt, deadline.created_at),
            actionTab: 'deadlines',
        });
    }

    for (const issue of asArray(issues)) {
        if (!issue || typeof issue !== 'object') {
            continue;
        }
        for (const entry of asArray(issue.timeline)) {
            if (!entry || typeof entry !== 'object') {
                continue;
            }
            const id = text(entry.id) || `${text(entry.createdAt)}|${text(entry.title)}`;
            const issueTitle = text(issue.title) || 'Campus issue';
            const entryTitle = text(entry.title) || 'Issue updated';
            const notes = text(entry.notes);
            addItem({
                key: `issue:${makeKeyPart(issue.id)}:${makeKeyPart(id)}`,
                source: 'issue',
                category: 'Issue update',
                title: `${issueTitle}: ${entryTitle}`,
                message: notes || `Status: ${text(entry.status) || text(issue.status) || 'updated'}.`,
                timestamp: makeTimestamp(entry.createdAt, entry.created_at),
                actionTab: 'issues',
            });
        }
    }

    for (const notice of asArray(notices)) {
        if (!notice || typeof notice !== 'object') {
            continue;
        }
        const id = text(notice.id) || `${text(notice.title)}|${text(notice.created_at)}`;
        const sourceName = notice.source === 'teacher_announcement' ? 'Teacher notice' : 'Campus notice';
        addItem({
            key: `notice:${makeKeyPart(notice.source)}:${makeKeyPart(id)}`,
            source: 'notice',
            category: sourceName,
            title: text(notice.title) || sourceName,
            message: text(notice.message),
            timestamp: makeTimestamp(notice.created_at),
            actionTab: 'notices',
        });
    }

    for (const announcement of asArray(hostelAnnouncements)) {
        if (!announcement || typeof announcement !== 'object') {
            continue;
        }
        const id = text(announcement.id) || `${text(announcement.title)}|${text(announcement.created_at)}`;
        addItem({
            key: `hostel:${makeKeyPart(id)}`,
            source: 'hostel',
            category: 'Hostel notice',
            title: text(announcement.title) || 'Hostel announcement',
            message: text(announcement.message),
            timestamp: makeTimestamp(announcement.created_at),
            actionHref: '/hostel',
        });
    }

    for (const event of asArray(registeredEvents)) {
        if (!event || typeof event !== 'object' || !event.user_registered) {
            continue;
        }
        const updatedAt = makeTimestamp(event.updated_at);
        const registeredAt = makeTimestamp(event.registered_at);
        if (new Date(updatedAt).getTime() <= new Date(registeredAt).getTime()) {
            continue;
        }
        const title = text(event.title) || 'Registered event';
        const details = [
            event.proposed_date ? `Date: ${event.proposed_date}` : '',
            event.time_start ? `Time: ${event.time_start}` : '',
            text(event.venue) ? `Venue: ${text(event.venue)}` : '',
        ].filter(Boolean).join(' | ');
        addItem({
            key: `event-update:${makeKeyPart(event.id)}:${makeKeyPart(updatedAt)}`,
            source: 'event-update',
            category: 'Event update',
            title: `${title} details changed`,
            message: details || 'Check the event details for the latest information.',
            timestamp: updatedAt,
            actionTab: 'events',
        });
    }

    for (const notification of asArray(chatNotifications)) {
        if (!notification || typeof notification !== 'object') {
            continue;
        }
        const id = text(notification.id) || `${text(notification.title)}|${text(notification.created_at)}`;
        addItem({
            key: `chat:${makeKeyPart(id)}`,
            source: 'chat',
            category: 'Chat alert',
            title: text(notification.title) || 'Campus Chat alert',
            message: text(notification.body),
            timestamp: makeTimestamp(notification.created_at),
            actionTab: 'chat',
            isRead: Boolean(notification.is_read),
        });
    }

    return items.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
}

export function getInboxReadStorageKey(userId) {
    return `smart-campus-inbox-read:${String(userId || 'unknown')}`;
}

export function readInboxReadKeys(userId) {
    if (typeof window === 'undefined') {
        return [];
    }
    try {
        const value = JSON.parse(window.localStorage.getItem(getInboxReadStorageKey(userId)) || '[]');
        return Array.isArray(value) ? value.filter((key) => typeof key === 'string') : [];
    } catch {
        return [];
    }
}

export function writeInboxReadKeys(userId, keys) {
    if (typeof window === 'undefined') {
        return false;
    }
    try {
        window.localStorage.setItem(getInboxReadStorageKey(userId), JSON.stringify([...new Set(keys)]));
        return true;
    } catch {
        return false;
    }
}
