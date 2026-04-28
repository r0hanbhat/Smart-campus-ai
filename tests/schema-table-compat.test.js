import test from 'node:test';
import assert from 'node:assert/strict';
import { getMissingSchemaTable, isMissingSchemaTableError } from '../lib/supabase/schema-compat.js';

test('getMissingSchemaTable parses schema-cache table errors', () => {
    assert.equal(getMissingSchemaTable({ message: "Could not find the table 'public.students' in the schema cache" }), 'students');
    assert.equal(getMissingSchemaTable({ message: "Could not find the table 'teacher_verification_requests' in the schema cache" }), 'teacher_verification_requests');
});

test('isMissingSchemaTableError matches explicit table names and PGRST205', () => {
    assert.equal(isMissingSchemaTableError({ message: "Could not find the table 'public.students' in the schema cache" }, 'students'), true);
    assert.equal(isMissingSchemaTableError({ code: 'PGRST205', message: 'table missing' }, 'students'), true);
    assert.equal(isMissingSchemaTableError({ message: "Could not find the table 'public.profiles' in the schema cache" }, 'students'), false);
});
