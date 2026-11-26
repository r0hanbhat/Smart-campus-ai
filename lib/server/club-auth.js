import { createHmac, timingSafeEqual } from 'node:crypto';

export const CLUB_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function signPayload(payload, secret) {
    return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createClubSessionToken(club, secret, now = Date.now()) {
    if (!secret) {
        throw new Error('Club session signing secret is not configured.');
    }

    const payload = Buffer.from(JSON.stringify({
        club_id: club.id,
        club_name: club.club_name,
        expires_at: now + CLUB_SESSION_MAX_AGE_SECONDS * 1000,
    })).toString('base64url');

    return `${payload}.${signPayload(payload, secret)}`;
}

export function readClubSessionToken(token, secret, now = Date.now()) {
    if (!token || !secret) {
        return null;
    }

    const [payload, signature, ...extra] = token.split('.');
    if (!payload || !signature || extra.length > 0) {
        return null;
    }

    const expected = Buffer.from(signPayload(payload, secret));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
        return null;
    }

    try {
        const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (
            typeof session.club_id !== 'string'
            || typeof session.club_name !== 'string'
            || !Number.isFinite(session.expires_at)
            || session.expires_at <= now
        ) {
            return null;
        }
        return { club_id: session.club_id, club_name: session.club_name };
    } catch {
        return null;
    }
}

export async function readClubSession(cookieStore) {
    return readClubSessionToken(
        cookieStore.get('club_session')?.value,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}
