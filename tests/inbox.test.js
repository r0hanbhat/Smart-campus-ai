import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInboxItems, getInboxReadStorageKey } from '../lib/smart-campus/inbox.js';

test('buildInboxItems combines requested sources with stable keys and actions', () => {
    const items = buildInboxItems({
        reminders: [{ id: 'reminder-1', eventName: 'Lab', date: '2026-04-02', time: '10:00 AM' }],
        deadlines: [
            { id: 'deadline-open', title: 'Assignment', date: '2026-04-03' },
            { id: 'deadline-done', title: 'Submitted', completed: true },
        ],
        issues: [{
            id: 'issue-1',
            title: 'WiFi',
            timeline: [{ id: 'timeline-1', title: 'Assigned', notes: 'IT is investigating.', createdAt: '2026-04-01T10:00:00Z' }],
        }],
        notices: [{ id: 'notice-1', source: 'teacher_announcement', title: 'Room change', message: 'Lab moved.', created_at: '2026-04-01T11:00:00Z' }],
        hostelAnnouncements: [{ id: 'hostel-1', title: 'Water shutdown', message: 'Tomorrow.', created_at: '2026-04-01T12:00:00Z' }],
        registeredEvents: [{
            id: 'event-1',
            title: 'Hackathon',
            user_registered: true,
            registered_at: '2026-03-01T10:00:00Z',
            updated_at: '2026-03-02T10:00:00Z',
            proposed_date: '2026-04-05',
        }],
        chatNotifications: [{ id: 'chat-1', title: 'Friend request', body: 'A student sent a request.', is_read: false, created_at: '2026-04-01T13:00:00Z' }],
    });

    assert.deepEqual(new Set(items.map((item) => item.source)), new Set([
        'reminder',
        'deadline',
        'issue',
        'notice',
        'hostel',
        'event-update',
        'chat',
    ]));
    assert.equal(items.some((item) => item.key === 'deadline:deadline-done'), false);
    assert.equal(items.find((item) => item.source === 'hostel').actionHref, '/hostel');
    assert.equal(items.find((item) => item.source === 'event-update').actionTab, 'events');
    assert.equal(items.find((item) => item.source === 'chat').isRead, false);
});

test('buildInboxItems only reports changes made after event registration', () => {
    const items = buildInboxItems({
        registeredEvents: [
            { id: 'changed', title: 'Changed', user_registered: true, registered_at: '2026-03-02T10:00:00Z', updated_at: '2026-03-03T10:00:00Z' },
            { id: 'unchanged', title: 'Unchanged', user_registered: true, registered_at: '2026-03-03T10:00:00Z', updated_at: '2026-03-02T10:00:00Z' },
            { id: 'not-registered', title: 'Not registered', user_registered: false, registered_at: null, updated_at: '2026-03-03T10:00:00Z' },
        ],
    });

    assert.deepEqual(items.map((item) => item.key), ['event-update:changed:2026-03-03T10%3A00%3A00.000Z']);
});

test('read state is scoped to the signed-in user', () => {
    assert.equal(getInboxReadStorageKey('user-a'), 'smart-campus-inbox-read:user-a');
    assert.notEqual(getInboxReadStorageKey('user-a'), getInboxReadStorageKey('user-b'));
});

test('buildInboxItems respects browser read markers and existing chat read state', () => {
    const items = buildInboxItems({
        reminders: [{ id: 'reminder-1', eventName: 'Lab' }],
        chatNotifications: [{ id: 'chat-1', title: 'Friend request', is_read: true }],
        readKeys: ['reminder:reminder-1'],
    });

    assert.equal(items.find((item) => item.source === 'reminder').isRead, true);
    assert.equal(items.find((item) => item.source === 'chat').isRead, true);
});
