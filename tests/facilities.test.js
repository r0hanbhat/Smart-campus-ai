import test from 'node:test';
import assert from 'node:assert/strict';
import {
    FACILITY_RESOURCE_CODES,
    normalizeFacilityBookingInput,
    normalizeFacilitySchedule,
} from '../lib/smart-campus/facilities.js';

test('facility resource catalog separates hostel and campus locations', () => {
    assert.equal(FACILITY_RESOURCE_CODES.hostel_laundry.scope, 'hostel');
    assert.equal(FACILITY_RESOURCE_CODES.hostel_reading_room.scope, 'hostel');
    assert.equal(FACILITY_RESOURCE_CODES.campus_library_seat.scope, 'campus');
    assert.equal(FACILITY_RESOURCE_CODES.campus_cafeteria_seat.scope, 'campus');
});

test('normalizeFacilitySchedule accepts a valid recurring weekday schedule', () => {
    assert.deepEqual(normalizeFacilitySchedule({
        resourceId: '00000000-0000-4000-8000-000000000001',
        weekday: '1',
        opensAt: '08:00',
        closesAt: '12:00',
        slotMinutes: '60',
        capacity: '8',
        activeFrom: '2026-04-01',
        activeUntil: '',
    }), {
        value: {
            resourceId: '00000000-0000-4000-8000-000000000001',
            weekdays: [1],
            blockIds: [],
            opensAt: '08:00:00',
            closesAt: '12:00:00',
            slotMinutes: 60,
            capacity: 8,
            activeFrom: '2026-04-01',
            activeUntil: null,
        },
    });
});

test('laundry schedules target selected blocks for all seven days of one Monday-to-Sunday week', () => {
    assert.deepEqual(normalizeFacilitySchedule({
        resourceId: '00000000-0000-4000-8000-000000000001',
        weekday: 'every_day',
        blockIds: [
            '00000000-0000-4000-8000-000000000002',
            '00000000-0000-4000-8000-000000000003',
        ],
        opensAt: '06:00',
        closesAt: '22:00',
        slotMinutes: '60',
        capacity: '10',
        activeFrom: '2026-04-06',
        activeUntil: '2026-04-12',
    }, { resourceCode: 'hostel_laundry' }).value, {
        resourceId: '00000000-0000-4000-8000-000000000001',
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        blockIds: [
            '00000000-0000-4000-8000-000000000002',
            '00000000-0000-4000-8000-000000000003',
        ],
        opensAt: '06:00:00',
        closesAt: '22:00:00',
        slotMinutes: 60,
        capacity: 10,
        activeFrom: '2026-04-06',
        activeUntil: '2026-04-12',
    });
    assert.equal(normalizeFacilitySchedule({
        resourceId: '00000000-0000-4000-8000-000000000001',
        weekday: 'every_day',
        blockIds: ['00000000-0000-4000-8000-000000000002'],
        opensAt: '06:00',
        closesAt: '22:00',
        slotMinutes: '60',
        capacity: '10',
        activeFrom: '2026-04-07',
        activeUntil: '2026-04-13',
    }, { resourceCode: 'hostel_laundry' }).error, 'Laundry availability must cover one Monday–Sunday week.');
    assert.equal(normalizeFacilitySchedule({
        resourceId: '00000000-0000-4000-8000-000000000001',
        weekday: 'every_day',
        opensAt: '06:00',
        closesAt: '22:00',
        slotMinutes: '60',
        capacity: '10',
        activeFrom: '2026-04-06',
        activeUntil: '2026-04-12',
    }, { resourceCode: 'hostel_laundry' }).error, 'Choose one or more valid hostel blocks for laundry availability.');
});

test('reading-room schedules cover a whole month at the fixed 200-seat capacity', () => {
    const schedule = {
        resourceId: '00000000-0000-4000-8000-000000000001',
        weekday: 'every_day',
        opensAt: '08:00',
        closesAt: '12:00',
        slotMinutes: '60',
        capacity: '200',
        activeFrom: '2026-04-01',
        activeUntil: '2026-04-30',
    };
    assert.deepEqual(normalizeFacilitySchedule(schedule, { resourceCode: 'hostel_reading_room' }).value.weekdays, [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(normalizeFacilitySchedule({
        ...schedule,
        capacity: '199',
    }, { resourceCode: 'hostel_reading_room' }).error, 'Reading-room availability must cover one calendar month with 200 seats per slot.');
});

test('normalizeFacilitySchedule rejects invalid weekdays, slot boundaries, capacity, and dates', () => {
    const valid = {
        resourceId: '00000000-0000-4000-8000-000000000001',
        weekday: 1,
        opensAt: '08:00',
        closesAt: '12:00',
        slotMinutes: 60,
        capacity: 8,
        activeFrom: '2026-04-01',
        activeUntil: '',
    };
    assert.equal(normalizeFacilitySchedule({ ...valid, weekday: 7 }).error, 'Choose a valid weekday.');
    assert.equal(normalizeFacilitySchedule({ ...valid, slotMinutes: 90 }).error, 'The opening window must divide evenly into slots.');
    assert.equal(normalizeFacilitySchedule({ ...valid, capacity: 0 }).error, 'Capacity must be between 1 and 1,000.');
    assert.equal(normalizeFacilitySchedule({ ...valid, activeUntil: '2026-02-30' }).error, 'Enter a valid active date range.');
});

test('normalizeFacilityBookingInput validates dates and exact slot times', () => {
    assert.deepEqual(normalizeFacilityBookingInput({
        scheduleId: '00000000-0000-4000-8000-000000000002',
        slotDate: '2026-04-01',
        slotStart: '08:00:00',
    }), {
        value: {
            scheduleId: '00000000-0000-4000-8000-000000000002',
            slotDate: '2026-04-01',
            slotStart: '08:00:00',
        },
    });
    assert.equal(normalizeFacilityBookingInput({
        scheduleId: '00000000-0000-4000-8000-000000000002',
        slotDate: '2026-02-30',
        slotStart: '25:00',
    }).error, 'Choose a valid available slot.');
});
