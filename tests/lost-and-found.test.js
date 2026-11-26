import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isValidLostFoundId,
    normalizeLostFoundClaimMessage,
    normalizeLostFoundItemInput,
    normalizeLostFoundResponse,
} from '../lib/smart-campus/lost-and-found.js';

test('lost and found item inputs are trimmed and reject invalid or future dates', () => {
    assert.deepEqual(normalizeLostFoundItemInput({
        title: 'Key ring',
        description: 'Silver keys with a blue tag.',
        foundLocation: 'Library',
        foundDate: '2026-05-01',
    }, '2026-05-01').value, {
        itemType: 'found',
        title: 'Key ring',
        description: 'Silver keys with a blue tag.',
        location: 'Library',
        date: '2026-05-01',
    });

    assert.deepEqual(normalizeLostFoundItemInput({
        title: '  Key ring ',
        description: '  Silver keys with a blue tag. ',
        itemType: 'found',
        location: ' Library ',
        date: '2026-05-01',
    }, '2026-05-01'), {
        value: {
            itemType: 'found',
            title: 'Key ring',
            description: 'Silver keys with a blue tag.',
            location: 'Library',
            date: '2026-05-01',
        },
    });

    assert.match(normalizeLostFoundItemInput({
        title: 'Key ring',
        description: 'Silver keys with a blue tag.',
        itemType: 'lost',
        location: 'Library',
        date: '2026-05-02',
    }, '2026-05-01').error, /not in the future/);
    assert.deepEqual(normalizeLostFoundItemInput({
        title: '  Keys ',
        description: '  Silver keys with a blue tag. ',
        itemType: 'lost',
        location: ' Library ',
        date: '2026-05-01',
    }, '2026-05-01').value, {
        itemType: 'lost',
        title: 'Keys',
        description: 'Silver keys with a blue tag.',
        location: 'Library',
        date: '2026-05-01',
    });
    assert.match(normalizeLostFoundItemInput({
        title: 'Key ring',
        description: 'Silver keys with a blue tag.',
        itemType: 'found',
        location: 'Library',
        date: '2026-02-31',
    }, '2026-05-01').error, /valid item date/);
    assert.match(normalizeLostFoundItemInput({
        title: 'Key ring',
        description: 'Silver keys with a blue tag.',
        itemType: 'missing',
        location: 'Library',
        date: '2026-05-01',
    }, '2026-05-01').error, /lost or found/);
});

test('private claim messages require useful identifying details and responses stay bounded', () => {
    assert.match(normalizeLostFoundClaimMessage('too short').error, /at least 10 characters/);
    assert.deepEqual(normalizeLostFoundClaimMessage('  The tag has my initials. '), {
        value: 'The tag has my initials.',
    });
    assert.deepEqual(normalizeLostFoundResponse('  Meet me at the library desk.  '), {
        value: 'Meet me at the library desk.',
    });
    assert.equal(normalizeLostFoundResponse('x'.repeat(1300)).value.length, 1200);
});

test('lost and found actions only accept UUID identifiers', () => {
    assert.equal(isValidLostFoundId('00000000-0000-4000-8000-000000000002'), true);
    assert.equal(isValidLostFoundId('not-a-uuid'), false);
});
