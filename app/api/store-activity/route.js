import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { isMissingSchemaTableError } from '@/lib/supabase/schema-compat.js';

export async function POST(request) {
    try {
        const body = await request.json();
        const action = typeof body?.action === 'string' ? body.action.trim() : '';
        if (!action) {
            return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
        }

        const { user, supabase } = await getAuthenticatedUser();
        if (!user?.id) {
            return NextResponse.json({ success: true, message: 'Activity skipped because there is no authenticated user.' });
        }
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle();

        const summaryParts = [];
        if (body.eventName) {
            summaryParts.push(`Event: ${body.eventName}`);
        }
        if (body.clubName) {
            summaryParts.push(`Club: ${body.clubName}`);
        }
        if (body.eventType) {
            summaryParts.push(`Type: ${body.eventType}`);
        }

        const { error } = await supabase.from('activity_logs').insert({
            user_id: user.id,
            role: profile?.role || 'student',
            action,
            summary: summaryParts.join(' • ') || `Tracked action: ${action}`,
            metadata: body,
        });
        if (error) {
            if (isMissingSchemaTableError(error, 'activity_logs')) {
                return NextResponse.json({
                    success: true,
                    message: 'Activity logging is not available until the Supabase role panel schema is installed.',
                });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Activity stored successfully.',
        });
    }
    catch (error) {
        console.error('Store Activity Error:', error);
        return NextResponse.json({ error: 'Failed to store activity' }, { status: 500 });
    }
}
