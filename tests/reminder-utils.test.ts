import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDateTimeLocal } from '../lib/smart-campus/utils.ts';

test('parseDateTimeLocal parses afternoon times', () => {
  const value = parseDateTimeLocal('2026-04-20', '2:30 PM');
  assert.equal(value.getFullYear(), 2026);
  assert.equal(value.getMonth(), 3);
  assert.equal(value.getDate(), 20);
  assert.equal(value.getHours(), 14);
  assert.equal(value.getMinutes(), 30);
});
