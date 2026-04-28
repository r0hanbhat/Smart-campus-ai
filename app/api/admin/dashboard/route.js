import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { isMissingSchemaTableError } from '@/lib/supabase/schema-compat.js';

function normalizeOptionalTableResult(result, tableName) {
    if (!result.error) {
        return { data: result.data || [], error: null };
    }
    if (isMissingSchemaTableError(result.error, tableName)) {
        return { data: [], error: null };
    }
    return { data: [], error: result.error };
}

export async function GET() {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { data: adminProfile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle();
        if (profileError || adminProfile?.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
        }

        const [requestResult, profilesResult, activityResult, sessionsResult] = await Promise.all([
            supabase.from('teacher_verification_requests').select('*').order('created_at', { ascending: false }),
            supabase.from('profiles').select('*').order('created_at', { ascending: false }),
            supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(20),
            supabase.from('admin_sessions').select('*').order('last_seen_at', { ascending: false }).limit(20),
        ]);

        const { data: teacherRequests, error: teacherRequestsError } = normalizeOptionalTableResult(requestResult, 'teacher_verification_requests');
        const { data: activityLogs, error: activityError } = normalizeOptionalTableResult(activityResult, 'activity_logs');
        const { data: sessions, error: sessionsError } = normalizeOptionalTableResult(sessionsResult, 'admin_sessions');

        if (profilesResult.error || teacherRequestsError || activityError || sessionsError) {
            return NextResponse.json({
                error: profilesResult.error?.message || teacherRequestsError?.message || activityError?.message || sessionsError?.message || 'Failed to load admin data.',
            }, { status: 500 });
        }

        return NextResponse.json({
            teacherRequests,
            profiles: profilesResult.data || [],
            activityLogs,
            sessions,
        });
    }
    catch (error) {
        console.error('Admin Dashboard API Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to load admin data.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
