import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReminderEmailJobs } from '../lib/server/reminder-jobs.js';
test('buildReminderEmailJobs creates reminder and deadline email jobs', () => {
    const jobs = buildReminderEmailJobs({
        userId: 'user-1',
        recipientEmail: 'student@example.com',
        reminders: [
            {
                id: 'reminder-1',
                eventName: 'AI Workshop',
                date: '2099-04-20',
                time: '2:30 PM',
            },
        ],
        deadlines: [
            {
                id: 'deadline-1',
                title: 'Project Report',
                date: '2099-04-21',
                time: '11:59 PM',
                type: 'custom',
            },
            {
                id: 'deadline-2',
                title: 'Completed Quiz',
                date: '2099-04-21',
                time: '11:59 PM',
                type: 'custom',
                completed: true,
            },
        ],
    });
    assert.equal(jobs.length, 5);
    assert.deepEqual(jobs.map((job) => [job.item_type, job.item_id, job.offset_hours]), [
        ['reminder', 'reminder-1', 6],
        ['reminder', 'reminder-1', 2],
        ['reminder', 'reminder-1', 0],
        ['deadline', 'deadline-1', 6],
        ['deadline', 'deadline-1', 2],
    ]);
    assert.ok(jobs.every((job) => job.recipient_email === 'student@example.com'));
    assert.ok(jobs.every((job) => job.status === 'pending'));
});
test('buildReminderEmailJobs skips invalid reminder times', () => {
    const jobs = buildReminderEmailJobs({
        userId: 'user-1',
        recipientEmail: 'student@example.com',
        reminders: [
            {
                id: 'reminder-1',
                eventName: 'Broken Reminder',
                date: '2099-04-20',
                time: '25:99 PM',
            },
        ],
        deadlines: [],
    });
    assert.equal(jobs.length, 0);
});
