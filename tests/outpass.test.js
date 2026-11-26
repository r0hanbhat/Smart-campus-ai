import test from 'node:test';
import assert from 'node:assert/strict';
import {
    HOSTEL_OUTPASS_STATUSES,
    normalizeHostelOutpassDecision,
    validateHostelOutpassRequest,
} from '../lib/smart-campus/outpass.js';

test('outpass validation accepts a future trip with a later return', () => {
    assert.equal(validateHostelOutpassRequest({
        destination: 'City center',
        purpose: 'Family visit',
        departureAt: '2027-01-10T09:00:00.000Z',
        returnBy: '2027-01-10T18:00:00.000Z',
    }, Date.parse('2027-01-01T00:00:00.000Z')), '');
});

test('outpass validation rejects missing details, past departures, and invalid return order', () => {
    assert.notEqual(validateHostelOutpassRequest({
        destination: ' ',
        purpose: 'Visit',
        departureAt: '2027-01-10T09:00:00.000Z',
        returnBy: '2027-01-10T18:00:00.000Z',
    }), '');
    assert.notEqual(validateHostelOutpassRequest({
        destination: 'City center',
        purpose: 'Family visit',
        departureAt: '2026-01-10T09:00:00.000Z',
        returnBy: '2026-01-10T18:00:00.000Z',
    }, Date.parse('2026-06-01T00:00:00.000Z')), '');
    assert.notEqual(validateHostelOutpassRequest({
        destination: 'City center',
        purpose: 'Family visit',
        departureAt: '2027-01-10T18:00:00.000Z',
        returnBy: '2027-01-10T09:00:00.000Z',
    }, Date.parse('2027-01-01T00:00:00.000Z')), '');
});

test('outpass decision normalization only allows staff outcomes', () => {
    assert.deepEqual(HOSTEL_OUTPASS_STATUSES, ['pending', 'approved', 'rejected']);
    assert.equal(normalizeHostelOutpassDecision('approved'), 'approved');
    assert.equal(normalizeHostelOutpassDecision('pending'), '');
    assert.equal(normalizeHostelOutpassDecision('cancelled'), '');
});
