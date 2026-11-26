import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseAuthHeaders } from '../lib/supabase/auth-fetch.js';

test('auth headers share concurrent session reads without verifying user repeatedly', async () => {
    let sessionReads = 0;
    const supabase = {
        auth: {
            getUser: async () => {
                throw new Error('getUser should not be called for browser request headers');
            },
            getSession: async () => {
                sessionReads += 1;
                await new Promise((resolve) => setTimeout(resolve, 5));
                return {
                    data: {
                        session: {
                            access_token: 'current-access-token',
                            expires_at: Math.floor(Date.now() / 1000) + 3600,
                        },
                    },
                    error: null,
                };
            },
        },
    };

    const [first, second] = await Promise.all([
        createSupabaseAuthHeaders(supabase),
        createSupabaseAuthHeaders(supabase),
    ]);

    assert.equal(sessionReads, 1);
    assert.equal(first.get('Authorization'), 'Bearer current-access-token');
    assert.equal(second.get('Authorization'), 'Bearer current-access-token');
});

test('auth headers refresh a session that is about to expire', async () => {
    let refreshCalls = 0;
    const supabase = {
        auth: {
            getSession: async () => ({
                data: { session: { access_token: 'old-token', expires_at: Math.floor(Date.now() / 1000) + 5 } },
                error: null,
            }),
            refreshSession: async () => {
                refreshCalls += 1;
                return {
                    data: { session: { access_token: 'refreshed-token' } },
                    error: null,
                };
            },
        },
    };

    const headers = await createSupabaseAuthHeaders(supabase);

    assert.equal(refreshCalls, 1);
    assert.equal(headers.get('Authorization'), 'Bearer refreshed-token');
});
