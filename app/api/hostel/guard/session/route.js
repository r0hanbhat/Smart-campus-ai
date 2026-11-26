import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { createWardenSessionToken, hashWardenSessionToken, getWardenSessionCookieOptions } from '@/lib/server/hostel-auth';
import { currentGuard, GUARD_COOKIE } from '@/lib/server/hostel-guard';

export async function GET() {
    const guard = await currentGuard(createSupabaseServiceRoleClient());
    return NextResponse.json({ guard });
}

export async function POST(request) {
    const body = await request.json().catch(() => null);
    const id = typeof body?.guardId === 'string' ? body.guardId.trim().toUpperCase() : '';
    if (!id || id.length > 80 || typeof body?.password !== 'string' || !body.password || body.password.length > 72)
        return NextResponse.json({ error: 'Enter a guard ID and password.' }, { status: 400 });
    const token = createWardenSessionToken();
    const db = createSupabaseServiceRoleClient();
    const { data, error } = await db.rpc('login_hostel_guard', {
        login_id: id, passcode: body.password, session_hash: hashWardenSessionToken(token),
    });
    if (error) return NextResponse.json({ error: 'Guard login is unavailable. Check the guard database setup.' }, { status: 503 });
    if (!data) return NextResponse.json({ error: 'Invalid credentials or temporarily locked account.' }, { status: 401 });
    const response = NextResponse.json({ guard: id });
    response.cookies.set(GUARD_COOKIE, token, getWardenSessionCookieOptions());
    return response;
}

export async function DELETE() {
    const token = (await cookies()).get(GUARD_COOKIE)?.value;
    if (token) {
        const { error } = await createSupabaseServiceRoleClient().from('hostel_guard_sessions')
            .delete().eq('token_hash', hashWardenSessionToken(token));
        if (error) return NextResponse.json({ error: 'Sign-out failed. Please retry.' }, { status: 503 });
    }
    const response = NextResponse.json({ guard: null });
    response.cookies.set(GUARD_COOKIE, '', { ...getWardenSessionCookieOptions(), maxAge: 0 });
    return response;
}
