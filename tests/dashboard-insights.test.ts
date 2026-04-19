import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInsights, buildInsightsPayload } from '../lib/server/dashboard-insights.ts';

test('buildInsights reports urgent deadlines', () => {
  const today = new Date();
  const inOneDay = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const inTwoDays = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
  const format = (date: Date) => date.toISOString().slice(0, 10);

  const insights = buildInsights({
    events: [],
    clubs: [],
    reminders: [],
    deadlines: [
      { title: 'Assignment 1', date: format(inOneDay), completed: false },
      { title: 'Assignment 2', date: format(inTwoDays), completed: false },
    ],
    attentionStats: {},
  });

  assert.ok(insights.some((line) => line.includes('deadlines landing within the next 3 days')));
});

test('buildInsights returns fallback when there are no signals', () => {
  const insights = buildInsights({
    events: [],
    clubs: [],
    reminders: [],
    deadlines: [],
    attentionStats: {},
  });

  assert.equal(insights.length, 1);
  assert.match(insights[0], /needs more signals/i);
});

test('buildInsights highlights follow-through gaps when reminders outpace attendance', () => {
  const insights = buildInsights({
    events: [
      { name: 'AI Workshop', checkedIn: true, type: 'tech' },
      { name: 'Research Talk', checkedIn: false, attending: true, type: 'tech' },
    ],
    clubs: [],
    reminders: [
      { eventName: 'AI Workshop' },
      { eventName: 'Research Talk' },
    ],
    deadlines: [],
    attentionStats: {},
  });

  assert.ok(insights.some((line) => line.includes('reminders have not turned into check-ins yet')));
});

test('buildInsights reports steady focus when active time dominates', () => {
  const insights = buildInsights({
    events: [],
    clubs: [],
    reminders: [],
    deadlines: [],
    attentionStats: {
      chat: { focusedMs: 600000, backgroundMs: 100000, visits: 3 },
      dashboard: { focusedMs: 180000, backgroundMs: 20000, visits: 1 },
    },
  });

  assert.ok(insights.some((line) => line.includes('focus habits look steady right now')));
});

test('buildInsightsPayload prefers request body values and falls back to stored state', () => {
  const payload = buildInsightsPayload(
    {
      reminders: [{ eventName: 'Body Reminder' }],
      attentionStats: { chat: { focusedMs: 1000 } },
    },
    {
      events: [{ name: 'Stored Event', checkedIn: true }],
      clubs: [{ name: 'Stored Club', joined: true }],
      reminders: [{ eventName: 'Stored Reminder' }],
      deadlines: [{ title: 'Stored Deadline', completed: false }],
    }
  );

  assert.equal(payload.events[0]?.name, 'Stored Event');
  assert.equal(payload.clubs[0]?.name, 'Stored Club');
  assert.equal(payload.reminders[0]?.eventName, 'Body Reminder');
  assert.equal(payload.deadlines[0]?.title, 'Stored Deadline');
  assert.equal(payload.attentionStats.chat?.focusedMs, 1000);
});
