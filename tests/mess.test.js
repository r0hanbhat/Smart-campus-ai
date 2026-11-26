import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MESS_DAYS,
    MESS_MEALS,
    isValidMessDate,
    normalizeMessMenuItems,
    summarizeMessRatings,
} from '../lib/smart-campus/mess.js';

test('normalizeMessMenuItems trims entries and skips blank meals', () => {
    assert.deepEqual(normalizeMessMenuItems([
        { dayOfWeek: 1, mealType: 'breakfast', menuText: '  Poha, tea  ' },
        { dayOfWeek: 1, mealType: 'lunch', menuText: '  ' },
    ]), [{ dayOfWeek: 1, mealType: 'breakfast', menuText: 'Poha, tea' }]);
});

test('normalizeMessMenuItems rejects invalid and duplicate meal entries', () => {
    assert.equal(normalizeMessMenuItems([{ dayOfWeek: 7, mealType: 'lunch', menuText: 'Rice' }]), null);
    assert.equal(normalizeMessMenuItems([
        { dayOfWeek: 2, mealType: 'dinner', menuText: 'Rice' },
        { dayOfWeek: 2, mealType: 'dinner', menuText: 'Dal' },
    ]), null);
    assert.equal(normalizeMessMenuItems([{ dayOfWeek: 2, mealType: 'lunch', menuText: 'x'.repeat(1001) }]), null);
});

test('isValidMessDate accepts calendar dates and rejects malformed dates', () => {
    assert.equal(isValidMessDate('2026-03-05'), true);
    assert.equal(isValidMessDate('2026-02-30'), false);
    assert.equal(isValidMessDate('05-03-2026'), false);
});

test('summarizeMessRatings returns anonymous averages with counts', () => {
    const summary = summarizeMessRatings([
        { meal_type: 'breakfast', rating: 4, hosteller_user_id: 'private-id' },
        { meal_type: 'breakfast', rating: 2, hosteller_user_id: 'another-private-id' },
        { meal_type: 'lunch', rating: 9 },
    ]);
    assert.deepEqual(summary, [{ dayOfWeek: null, mealType: 'breakfast', count: 2, average: 3 }]);
    assert.equal(Object.hasOwn(summary[0], 'hosteller_user_id'), false);
});

test('summarizeMessRatings can group recent ratings by menu weekday', () => {
    assert.deepEqual(summarizeMessRatings([
        { meal_date: '2026-03-08', meal_type: 'dinner', rating: 5 },
        { meal_date: '2026-03-08', meal_type: 'dinner', rating: 3 },
    ], true), [{
        dayOfWeek: 0,
        mealType: 'dinner',
        count: 2,
        average: 4,
    }]);
});

test('mess schedule includes a full week and the four standard meals', () => {
    assert.equal(MESS_DAYS.length, 7);
    assert.equal(MESS_MEALS.length, 4);
});
