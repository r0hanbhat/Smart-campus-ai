import test from 'node:test';
import assert from 'node:assert/strict';
import { getMissingSchemaColumn, withMissingSelectColumnsFallback } from '../lib/supabase/schema-compat.js';

test('getMissingSchemaColumn parses PostgREST and PostgreSQL missing-column errors', () => {
    assert.equal(getMissingSchemaColumn({ message: "Could not find the 'age' column of 'profiles' in the schema cache" }), 'age');
    assert.equal(getMissingSchemaColumn({ message: 'column profiles.age does not exist' }), 'age');
    assert.equal(getMissingSchemaColumn({ message: 'column "profiles"."phone_number" does not exist' }), 'phone_number');
});

test('withMissingSelectColumnsFallback retries when PostgreSQL reports a missing column', async () => {
    const requestedColumns = [];
    const result = await withMissingSelectColumnsFallback(async (nextColumns) => {
        requestedColumns.push([...nextColumns]);
        if (nextColumns.includes('age')) {
            return {
                data: null,
                error: { message: 'column profiles.age does not exist' },
            };
        }
        return {
            data: { user_id: 'user-1', display_name: 'Ada' },
            error: null,
        };
    }, ['user_id', 'display_name', 'age'], ['age']);

    assert.deepEqual(requestedColumns, [
        ['user_id', 'display_name', 'age'],
        ['user_id', 'display_name'],
    ]);
    assert.deepEqual(result, {
        data: { user_id: 'user-1', display_name: 'Ada' },
        error: null,
    });
});
