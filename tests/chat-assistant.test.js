import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCurrentContext, buildConversationSnapshot, buildSystemPrompt, detectAction, extractTimeFromMessage, parseDateFromMessage, } from '../lib/server/chat-assistant.js';
test('detectAction extracts reminder intent with date', () => {
    const action = detectAction('Remind me about AI Workshop on 2099-04-20');
    assert.ok(action);
    assert.equal(action?.type, 'set_reminder');
    if (action?.type === 'set_reminder') {
        assert.equal(action.eventName, 'AI Workshop');
        assert.equal(action.date, '2099-04-20');
    }
});
test('detectAction rejects past deadlines', () => {
    const action = detectAction('Set deadline for project report on 2020-01-01');
    assert.ok(action);
    assert.equal(action?.type, 'invalid_date');
});
test('detectAction requests a reminder date when one is missing', () => {
    const action = detectAction('Remind me about Hackathon registration');
    assert.ok(action);
    assert.equal(action?.type, 'set_reminder');
    if (action?.type === 'set_reminder') {
        assert.equal(action.eventName, 'Hackathon registration');
        assert.equal(action.needsDate, true);
        assert.match(action.confirmation, /what date should i set the reminder/i);
    }
});
test('detectAction requests a deadline time when only the date is provided', () => {
    const action = detectAction('Set deadline for design review on 2099-04-20');
    assert.ok(action);
    assert.equal(action?.type, 'add_deadline');
    if (action?.type === 'add_deadline') {
        assert.equal(action.title, 'design review');
        assert.equal(action.needsTime, true);
        assert.match(action.confirmation, /what time is the deadline/i);
    }
});
test('detectAction extracts navigation requests from campus phrasing', () => {
    const action = detectAction('Can you navigate me to Library?');
    assert.ok(action);
    assert.equal(action?.type, 'navigate');
    if (action?.type === 'navigate') {
        assert.equal(action.destination, 'Library');
    }
});
test('detectAction extracts club interest actions', () => {
    const action = detectAction('I want to join robotics club');
    assert.ok(action);
    assert.equal(action?.type, 'express_interest');
    if (action?.type === 'express_interest') {
        assert.equal(action.eventType, 'robotics club');
    }
});
test('extractTimeFromMessage parses 12-hour time', () => {
    assert.equal(extractTimeFromMessage('deadline at 11:59 pm'), '11:59 PM');
});
test('parseDateFromMessage resolves relative dates', () => {
    assert.ok(parseDateFromMessage('tomorrow') instanceof Date);
});
test('buildConversationSnapshot includes transcript markers', () => {
    const snapshot = buildConversationSnapshot([
        { role: 'user', content: 'Help me study graphs' },
        { role: 'assistant', content: 'Let us break it down.' },
    ]);
    assert.match(snapshot, /Recent Conversation:/);
    assert.match(snapshot, /User: Help me study graphs/);
});
test('buildCurrentContext summarizes joined clubs, reminders, and deadlines', () => {
    const context = buildCurrentContext({
        clubs: [
            { name: 'AI Club', joined: true },
            { name: 'Drama Club', joined: false },
        ],
        reminders: [{ eventName: 'AI Workshop', date: '2099-04-20', time: '2:00 PM' }],
        deadlines: [
            { title: 'Project Report', date: '2099-04-22', time: '11:59 PM', completed: false },
            { title: 'Old Task', date: '2099-04-10', completed: true },
        ],
        profile: { eventsAttended: 2, clubsJoined: 1 },
    });
    assert.match(context, /Clubs Joined: AI Club/);
    assert.match(context, /Active Reminders: AI Workshop \(2099-04-20 at 2:00 PM\)/);
    assert.match(context, /Pending Deadlines: Project Report \(due 2099-04-22 at 11:59 PM\)/);
    assert.match(context, /Total Events Attended: 2/);
});
test('buildSystemPrompt includes action confirmation guidance', () => {
    const prompt = buildSystemPrompt({
        currentContext: 'Current Session Data:\\nClubs Joined: AI Club',
        conversationSnapshot: 'Recent Conversation:\\nUser: Help me',
        action: {
            type: 'set_reminder',
            eventName: 'AI Workshop',
            date: '2099-04-20',
            time: '9:00 AM',
            confirmation: 'Should I set a reminder for "AI Workshop" on 2099-04-20?',
        },
    });
    assert.match(prompt, /You are a Smart Campus AI Assistant/);
    assert.match(prompt, /The user wants to:/);
    assert.match(prompt, /Respond naturally and ask for confirmation/);
});
