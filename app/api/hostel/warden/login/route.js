import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import {
    createWardenSessionToken,
    getWardenSessionCookieOptions,
    getWardenSessionExpiry,
    hashWardenSessionToken,
    hostelErrorResponse,
} from '@/lib/server/hostel-auth';
import { normalizeWardenId } from '@/lib/smart-campus/hostel.js';

export async function POST(request) {
    try {
        const body = await request.json();
        const wardenId = normalizeWardenId(body?.wardenId);
        const passcode = typeof body?.passcode === 'string' ? body.passcode : '';
        if (!wardenId || !passcode) {
            return NextResponse.json({ error: 'Warden ID and passcode are required.' }, { status: 400 });
        }

        const supabase = createSupabaseServiceRoleClient();
        const { data: warden, error } = await supabase
            .from('hostel_wardens')
            .select('id, warden_id, password_hash, display_name, is_active, locked_until')
            .eq('warden_id', wardenId)
            .maybeSingle();

        if (error) {
            throw error;
        }
        if (!warden?.is_active) {
            return NextResponse.json({ error: 'Invalid Warden ID or passcode.' }, { status: 401 });
        }
        if (warden.locked_until && new Date(warden.locked_until).getTime() > Date.now()) {
            return NextResponse.json({ error: 'Too many unsuccessful attempts. Try again in 15 minutes.' }, { status: 429 });
        }
        if (!(await bcrypt.compare(passcode, warden.password_hash))) {
            const { error: attemptError } = await supabase.rpc('record_hostel_warden_login_failure', {
                target_warden_id: warden.id,
            });
            if (attemptError) {
                throw attemptError;
            }
            return NextResponse.json({ error: 'Invalid Warden ID or passcode.' }, { status: 401 });
        }

        const { error: resetError } = await supabase
            .from('hostel_wardens')
            .update({ failed_login_count: 0, locked_until: null })
            .eq('id', warden.id);
        if (resetError) {
            throw resetError;
        }

        const token = createWardenSessionToken();
        const expiresAt = getWardenSessionExpiry();
        const { error: sessionError } = await supabase
            .from('hostel_warden_sessions')
            .insert({
                token_hash: hashWardenSessionToken(token),
                warden_id: warden.id,
                expires_at: expiresAt,
            });

        if (sessionError) {
            throw sessionError;
        }

        const response = NextResponse.json({
            warden: { wardenId: warden.warden_id, displayName: warden.display_name },
        });
        response.cookies.set('smart-campus-warden-session', token, getWardenSessionCookieOptions());
        return response;
    } catch (error) {
        return hostelErrorResponse(error, 'Warden login error');
    }
}

export async function DELETE() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('smart-campus-warden-session')?.value;
        if (token) {
            const supabase = createSupabaseServiceRoleClient();
            const { error } = await supabase
                .from('hostel_warden_sessions')
                .delete()
                .eq('token_hash', hashWardenSessionToken(token));
            if (error) {
                throw error;
            }
        }

        const response = NextResponse.json({ success: true });
        response.cookies.set('smart-campus-warden-session', '', { ...getWardenSessionCookieOptions(), maxAge: 0 });
        return response;
    } catch (error) {
        return hostelErrorResponse(error, 'Warden logout error');
    }
}
