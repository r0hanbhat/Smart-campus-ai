import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { isMissingSchemaTableError } from '@/lib/supabase/schema-compat.js';

export async function POST(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const sessionKey = typeof body?.sessionKey === 'string' ? body.sessionKey.trim() : '';
        const deviceName = typeof body?.deviceName === 'string' ? body.deviceName.trim() : '';
        if (!sessionKey) {
            return NextResponse.json({ error: 'Missing session key.' }, { status: 400 });
        }
        const { data: adminProfile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle();
        if (profileError || adminProfile?.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
        }

        const forwardedFor = request.headers.get('x-forwarded-for') || '';
        const ipAddress = forwardedFor.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'Unknown';
        const country = request.headers.get('x-vercel-ip-country') || '';
        const city = request.headers.get('x-vercel-ip-city') || '';
        const locationLabel = [city, country].filter(Boolean).join(', ') || 'Unknown location';
        const userAgent = request.headers.get('user-agent') || '';

        const { error: sessionError } = await supabase.from('admin_sessions').upsert({
            admin_user_id: user.id,
            session_key: sessionKey,
            device_name: deviceName || 'Unknown device',
            ip_address: ipAddress,
            user_agent: userAgent,
            location_label: locationLabel,
            last_seen_at: new Date().toISOString(),
        }, { onConflict: 'session_key' });

        if (sessionError) {
            if (isMissingSchemaTableError(sessionError, 'admin_sessions')) {
                return NextResponse.json({ success: true, disabled: true });
            }
            return NextResponse.json({ error: sessionError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('Admin Session API Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to track admin session.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
