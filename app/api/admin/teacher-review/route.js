import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { sendTeacherVerificationDecisionEmail } from '@/lib/server/verification-mailer';
import { isMissingSchemaTableError } from '@/lib/supabase/schema-compat.js';

export async function POST(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const requestId = typeof body?.requestId === 'string' ? body.requestId : '';
        const userId = typeof body?.userId === 'string' ? body.userId : '';
        const action = typeof body?.action === 'string' ? body.action : '';
        const reviewNotes = typeof body?.reviewNotes === 'string' ? body.reviewNotes.trim() : '';
        if (!requestId || !userId || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Missing review fields.' }, { status: 400 });
        }
        const { data: adminProfile, error: adminProfileError } = await supabase
            .from('profiles')
            .select('role, display_name')
            .eq('user_id', user.id)
            .maybeSingle();
        if (adminProfileError || adminProfile?.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
        }

        const nextStatus = action === 'approve' ? 'approved' : 'rejected';
        const reviewedAt = new Date().toISOString();

        const { data: verificationRequest, error: requestError } = await supabase
            .from('teacher_verification_requests')
            .select('*')
            .eq('id', requestId)
            .eq('user_id', userId)
            .maybeSingle();
        if (requestError && isMissingSchemaTableError(requestError, 'teacher_verification_requests')) {
            return NextResponse.json({ error: 'Teacher verification is not available until the Supabase role panel schema is installed.' }, { status: 503 });
        }
        if (requestError || !verificationRequest) {
            return NextResponse.json({ error: 'Teacher verification request not found.' }, { status: 404 });
        }

        const adminSupabase = createSupabaseServiceRoleClient();
        
        const { error: updateRequestError } = await adminSupabase
            .from('teacher_verification_requests')
            .update({
                status: nextStatus,
                reviewed_at: reviewedAt,
                reviewed_by: user.id,
                review_notes: reviewNotes || null,
            })
            .eq('id', requestId);
        if (updateRequestError) {
            return NextResponse.json({ error: updateRequestError.message }, { status: 500 });
        }

        const { error: profileUpdateError } = await adminSupabase
            .from('profiles')
            .update({
                role: 'teacher',
                verification_status: nextStatus,
            })
            .eq('user_id', userId);
        if (profileUpdateError) {
            return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
        }

        const { error: logError } = await supabase.from('activity_logs').insert({
            user_id: user.id,
            role: 'admin',
            action: action === 'approve' ? 'approve_teacher' : 'reject_teacher',
            summary: `${adminProfile.display_name || 'Admin'} ${action === 'approve' ? 'approved' : 'rejected'} teacher request for ${verificationRequest.full_name || verificationRequest.email}.`,
            metadata: {
                requestId,
                targetUserId: userId,
                reviewNotes,
            },
        });
        if (logError && !isMissingSchemaTableError(logError, 'activity_logs')) {
            console.error('Teacher review log error:', logError.message);
        }

        try {
            await sendTeacherVerificationDecisionEmail({
                to: verificationRequest.email,
                fullName: verificationRequest.full_name,
                status: nextStatus,
                reviewNotes,
            });
        }
        catch (mailError) {
            console.error('Teacher review email error:', mailError);
        }

        return NextResponse.json({ success: true, status: nextStatus });
    }
    catch (error) {
        console.error('Teacher Review API Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to review teacher request.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
