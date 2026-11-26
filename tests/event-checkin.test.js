import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createClubSessionToken,
    readClubSessionToken,
} from '../lib/server/club-auth.js';
import { getCampusDate, isValidEventCheckInId } from '../lib/smart-campus/event-checkin.js';
import { getPublishedEventState } from '../lib/smart-campus/published-events.js';

const SECRET = 'unit-test-session-secret';
const CLUB = {
    id: '00000000-0000-4000-8000-000000000001',
    club_name: 'Campus Arts',
};

test('signed club sessions accept valid unexpired tokens', () => {
    const now = 1_800_000_000_000;
    const token = createClubSessionToken(CLUB, SECRET, now);

    assert.deepEqual(readClubSessionToken(token, SECRET, now + 1000), {
        club_id: CLUB.id,
        club_name: CLUB.club_name,
    });
});

test('signed club sessions reject tampered, expired, and invalid tokens', () => {
    const now = 1_800_000_000_000;
    const token = createClubSessionToken(CLUB, SECRET, now);
    const [payload, signature] = token.split('.');

    assert.equal(readClubSessionToken(`${payload}.${signature.slice(0, -1)}x`, SECRET, now), null);
    assert.equal(readClubSessionToken(token, SECRET, now + 8 * 60 * 60 * 1000), null);
    assert.equal(readClubSessionToken(token, 'wrong-secret', now), null);
    assert.equal(readClubSessionToken('not-a-token', SECRET, now), null);
});

test('event ticket IDs only accept UUIDs and campus dates use the configured timezone', () => {
    assert.equal(isValidEventCheckInId('00000000-0000-4000-8000-000000000002'), true);
    assert.equal(isValidEventCheckInId('registration-id'), false);
    assert.equal(getCampusDate(new Date('2026-03-01T20:00:00.000Z')), '2026-03-02');
});

test('published events remain visible on their event date until their end time', () => {
    const event = {
        proposed_date: '2026-11-25',
        event_end_date: '2026-11-25',
        time_start: '18:00:00',
        time_end: '23:00:00',
        registration_starts: null,
    };

    assert.deepEqual(getPublishedEventState(event, new Date('2026-11-25T16:00:00.000Z')), {
        is_today: true,
        is_past: false,
        has_started: true,
        registration_open: true,
        is_upcoming: false,
    });
    assert.equal(getPublishedEventState(event, new Date('2026-11-25T18:00:01.000Z')).is_past, true);
});

test('published events with future registration windows appear under upcoming', () => {
    const state = getPublishedEventState({
        proposed_date: '2026-11-27',
        event_end_date: '2026-11-27',
        time_start: '10:00:00',
        time_end: '12:00:00',
        registration_starts: '2026-11-26T00:00:00.000Z',
    }, new Date('2026-11-25T16:00:00.000Z'));

    assert.equal(state.registration_open, false);
    assert.equal(state.is_upcoming, true);
});
