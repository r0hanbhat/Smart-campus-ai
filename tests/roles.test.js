import test from 'node:test';
import assert from 'node:assert/strict';
import { isUniversityEmail, resolveAccountRole, resolveVerificationStatus } from '../lib/smart-campus/roles.js';

test('isUniversityEmail rejects common public inboxes and accepts academic domains', () => {
    assert.equal(isUniversityEmail('faculty@gmail.com'), false);
    assert.equal(isUniversityEmail('teacher@jcboseust.ac.in'), true);
});

test('role helpers fall back to metadata when profile is missing', () => {
    const user = {
        user_metadata: {
            role: 'teacher',
            verification_status: 'pending',
        },
    };
    assert.equal(resolveAccountRole(null, user), 'teacher');
    assert.equal(resolveVerificationStatus(null, user), 'pending');
});
