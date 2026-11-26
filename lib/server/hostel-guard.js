import 'server-only';
import { cookies } from 'next/headers';
import { hashWardenSessionToken } from './hostel-auth';

export const GUARD_COOKIE = 'smart-campus-guard-session';

export async function currentGuard(db) {
    const token = (await cookies()).get(GUARD_COOKIE)?.value;
    if (!token) return null;
    const { data, error } = await db.from('hostel_guard_sessions')
        .select('guard_id, hostel_guards!inner(is_active)')
        .eq('token_hash', hashWardenSessionToken(token)).gt('expires_at', new Date().toISOString())
        .eq('hostel_guards.is_active', true).maybeSingle();
    if (error) throw error;
    return data?.guard_id ?? null;
}
