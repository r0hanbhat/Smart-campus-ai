import { NextResponse } from 'next/server';
import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { isMissingSchemaColumnError, isMissingSchemaTableError } from '@/lib/supabase/schema-compat.js';

export const HOSTEL_WARDEN_SESSION_COOKIE = 'smart-campus-warden-session';
const WARDEN_SESSION_TTL_SECONDS = 60 * 60 * 8;

export function createWardenSessionToken() {
    return randomBytes(32).toString('base64url');
}

function hashSessionToken(token) {
    return createHash('sha256').update(token).digest('hex');
}

export async function readWardenSession(supabase = createSupabaseServiceRoleClient()) {
    const cookieStore = await cookies();
    const token = cookieStore.get(HOSTEL_WARDEN_SESSION_COOKIE)?.value;
    if (!token) {
        return null;
    }

    const { data: session, error: sessionError } = await supabase
        .from('hostel_warden_sessions')
        .select('warden_id')
        .eq('token_hash', hashSessionToken(token))
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

    if (sessionError) {
        throw sessionError;
    }
    if (!session) {
        return null;
    }

    const { data: warden, error: wardenError } = await supabase
        .from('hostel_wardens')
        .select('id, warden_id, display_name, is_active')
        .eq('id', session.warden_id)
        .maybeSingle();

    if (wardenError) {
        throw wardenError;
    }
    return warden?.is_active ? { ...warden, tokenHash: hashSessionToken(token) } : null;
}

export async function requireHostelAdmin(request) {
    const { user, supabase, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user?.id) {
        throw Object.assign(new Error('Unauthorized.'), { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

    if (profileError) {
        throw profileError;
    }
    if (profile?.role !== 'admin') {
        throw Object.assign(new Error('Admin access required.'), { status: 403 });
    }

    return createSupabaseServiceRoleClient();
}

export function hostelErrorResponse(error, label) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    if (
        ['PGRST202', '42883'].includes(error?.code)
        && [
            'review_hostel_registration_request',
            'create_hostel_maintenance_request',
            'update_hostel_maintenance_request',
            'replace_hostel_mess_menu',
            'submit_hostel_meal_rating',
            'create_hostel_outpass_request',
            'review_hostel_outpass_request',
        ]
            .some((functionName) => error?.message?.includes(functionName))
    ) {
        return Response.json({
                error: 'A required hostel database function is not installed. Apply the relevant hostel schema file in Supabase first.',
        }, { status: 503 });
    }
    const hostelTables = [
        'hostel_blocks',
        'hostel_wardens',
        'hostel_warden_blocks',
        'hostel_residents',
        'hostel_warden_sessions',
        'hostel_maintenance_requests',
        'hostel_maintenance_updates',
        'hostel_mess_menu',
        'hostel_mess_announcements',
        'hostel_meal_ratings',
        'hostel_outpass_requests',
        'hostel_outpass_updates',
        'hostel_registration_requests',
    ];
    if (hostelTables.some((tableName) => isMissingSchemaTableError(error, tableName))) {
        return Response.json({
            error: 'Hostel database is not installed. Apply supabase/hostel_schema.sql in Supabase first.',
        }, { status: 503 });
    }
    if (isMissingSchemaColumnError(error, 'roll_number')) {
        return Response.json({
            error: 'Student roll-number data is not installed. Apply supabase/attendance_schema.sql in Supabase first.',
        }, { status: 503 });
    }
    if (status >= 500) {
        console.error(`${label}:`, error);
    }
    const message = error instanceof Error ? error.message : 'Hostel request failed.';
    return Response.json({ error: message }, { status });
}

export function getWardenSessionCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: WARDEN_SESSION_TTL_SECONDS,
        path: '/',
    };
}

export function getWardenSessionExpiry() {
    return new Date(Date.now() + WARDEN_SESSION_TTL_SECONDS * 1000).toISOString();
}

export function hashWardenSessionToken(token) {
    return hashSessionToken(token);
}

export async function getHosteller(supabase, request) {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user?.id) {
        return { response: NextResponse.json({ error: 'Hosteller login required.' }, { status: 401 }) };
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
    if (profileError) {
        throw profileError;
    }
    if (profile?.role !== 'student') {
        return { response: NextResponse.json({ error: 'Hosteller portal access required.' }, { status: 403 }) };
    }

    const { data: resident, error: residentError } = await supabase
        .from('hostel_residents')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
    if (residentError) {
        throw residentError;
    }
    if (!resident) {
        return { response: NextResponse.json({ error: 'A hostel room assignment is required.' }, { status: 403 }) };
    }
    return { user };
}
