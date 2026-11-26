import test from 'node:test';
import assert from 'node:assert/strict';
import {
    HOSTEL_MAINTENANCE_CATEGORIES,
    HOSTEL_MAINTENANCE_STATUSES,
    normalizeHostelBlockName,
    normalizeHostelMaintenanceCategory,
    normalizeHostelMaintenanceStatus,
    normalizeWardenId,
    validateHostelMaintenanceReport,
} from '../lib/smart-campus/hostel.js';

test('normalizeWardenId trims whitespace and ignores letter case', () => {
    assert.equal(normalizeWardenId('  wd-104 '), 'WD-104');
    assert.equal(normalizeWardenId(null), '');
});

test('normalizeHostelBlockName trims and collapses whitespace', () => {
    assert.equal(normalizeHostelBlockName('  Block    A  '), 'Block A');
    assert.equal(normalizeHostelBlockName('   '), '');
});

test('maintenance categories and statuses reject unsupported values', () => {
    assert.equal(normalizeHostelMaintenanceCategory('Plumbing'), 'Plumbing');
    assert.equal(normalizeHostelMaintenanceCategory('unknown'), '');
    assert.equal(normalizeHostelMaintenanceStatus('in_progress'), 'in_progress');
    assert.equal(normalizeHostelMaintenanceStatus('closed'), '');
    assert.ok(HOSTEL_MAINTENANCE_CATEGORIES.includes('WiFi'));
    assert.ok(HOSTEL_MAINTENANCE_STATUSES.includes('resolved'));
});

test('maintenance report validation rejects blank, invalid, and oversized input', () => {
    assert.equal(validateHostelMaintenanceReport({
        title: 'Water leak',
        description: 'The sink is leaking.',
        category: 'Plumbing',
    }), '');
    assert.notEqual(validateHostelMaintenanceReport({
        title: '  ',
        description: 'The sink is leaking.',
        category: 'Plumbing',
    }), '');
    assert.notEqual(validateHostelMaintenanceReport({
        title: 'Water leak',
        description: 'The sink is leaking.',
        category: 'Otherish',
    }), '');
    assert.notEqual(validateHostelMaintenanceReport({
        title: 'x'.repeat(121),
        description: 'The sink is leaking.',
        category: 'Plumbing',
    }), '');
});
