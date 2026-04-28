import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeklyPlannerView, getPlannerValidationError, getStartOfWeek, timeStringToMinutes } from '../lib/smart-campus/planner.js';

test('getStartOfWeek returns monday for a midweek date', () => {
    const start = getStartOfWeek(new Date('2026-04-22T14:00:00'));
    assert.equal(start.getDay(), 1);
    assert.equal(start.getDate(), 20);
});

test('timeStringToMinutes converts 24-hour time correctly', () => {
    assert.equal(timeStringToMinutes('09:30'), 570);
    assert.equal(timeStringToMinutes('18:05'), 1085);
});

test('buildWeeklyPlannerView expands recurring items and detects overlaps', () => {
    const planner = buildWeeklyPlannerView({
        plannerEntries: [
            {
                id: 'plan-1',
                title: 'Algorithms study',
                date: '2026-04-22',
                startTime: '10:00',
                endTime: '11:30',
                category: 'study',
                recurrence: 'weekly',
            },
            {
                id: 'plan-2',
                title: 'Project sync',
                date: '2026-04-22',
                startTime: '10:30',
                endTime: '11:15',
                category: 'meeting',
            },
        ],
        events: [],
        reminders: [],
        deadlines: [],
        weekStartDate: new Date('2026-04-22T09:00:00'),
    });

    assert.equal(planner.days.length, 7);
    assert.equal(planner.stats.plannerCount, 2);
    assert.equal(planner.conflicts.length, 1);
    assert.equal(planner.days[2].items[0].title, 'Algorithms study');
});

test('getPlannerValidationError blocks past dates and short-notice plans for today', () => {
    const now = new Date('2026-04-22T10:00:00');

    assert.equal(getPlannerValidationError({
        date: '2026-04-21',
        startTime: '11:00',
        endTime: '12:00',
    }, now), 'You cannot create planner blocks for past dates.');

    assert.equal(getPlannerValidationError({
        date: '2026-04-22',
        startTime: '10:15',
        endTime: '11:15',
    }, now), "Today's planner blocks must start at least 20 minutes from now.");

    assert.equal(getPlannerValidationError({
        date: '2026-04-22',
        startTime: '10:20',
        endTime: '11:15',
    }, now), null);
});
