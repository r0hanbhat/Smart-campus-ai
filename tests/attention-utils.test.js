import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialAttentionStats, getAttentionSummary } from '../lib/smart-campus/utils.js';

test('createInitialAttentionStats includes every configured app tab', async () => {
    const stats = createInitialAttentionStats();
    assert.ok(stats.issues);
    assert.deepEqual(stats.issues, { focusedMs: 0, backgroundMs: 0, visits: 0 });
});

test('getAttentionSummary safely fills in missing tab buckets', async () => {
    const summary = getAttentionSummary({
        chat: { focusedMs: 1500, backgroundMs: 500, visits: 2 },
    });
    assert.equal(summary.totalFocusedMs, 1500);
    assert.equal(summary.totalBackgroundMs, 500);
    assert.equal(summary.totalVisits, 2);
    assert.ok(summary.tabAttentionBreakdown.some((entry) => entry.id === 'issues'));
});
