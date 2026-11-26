import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { hostelErrorResponse, readWardenSession } from '@/lib/server/hostel-auth';

async function getReviewer(request, supabase) {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (user?.id && !authError) {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle();
        if (error) {
            throw error;
        }
        if (profile?.role === 'admin') {
            return { kind: 'admin', userId: user.id };
        }
    }

    const warden = await readWardenSession(supabase);
    if (warden) {
        return { kind: 'warden', wardenId: warden.id };
    }
    throw Object.assign(
        new Error(authError ? 'Staff login required.' : 'Hostel staff access required.'),
        { status: authError ? 401 : 403 }
    );
}

export async function PATCH(request, { params }) {
    try {
        const { userId } = await params;
        const body = await request.json();
        const decision = typeof body?.decision === 'string' ? body.decision : '';
        const blockId = typeof body?.blockId === 'string' ? body.blockId.trim() : '';
        const roomNumber = typeof body?.roomNumber === 'string' ? body.roomNumber.trim() : '';
        const reviewNote = typeof body?.reviewNote === 'string' ? body.reviewNote.trim() : '';

        if (!userId || !['approved', 'rejected'].includes(decision)) {
            return Response.json({ error: 'A valid request and decision are required.' }, { status: 400 });
        }
        if (decision === 'approved' && (!blockId || !roomNumber || roomNumber.length > 32)) {
            return Response.json({ error: 'Choose a block and enter a room number up to 32 characters.' }, { status: 400 });
        }
        if (decision === 'rejected' && (blockId || roomNumber)) {
            return Response.json({ error: 'A block and room can only be set when approving.' }, { status: 400 });
        }
        if (reviewNote.length > 500) {
            return Response.json({ error: 'Review notes must be 500 characters or fewer.' }, { status: 400 });
        }

        const supabase = createSupabaseServiceRoleClient();
        const reviewer = await getReviewer(request, supabase);
        const { data: registrationRequest, error: requestError } = await supabase
            .from('hostel_registration_requests')
            .select('user_id, email, roll_number, status')
            .eq('user_id', userId)
            .maybeSingle();
        if (requestError) {
            throw requestError;
        }
        if (!registrationRequest || registrationRequest.status !== 'pending') {
            return Response.json({ error: 'This hostel registration request is no longer pending.' }, { status: 409 });
        }

        if (decision === 'approved') {
            const [{ data: authUserResult, error: authUserError }, { data: profile, error: profileError }] = await Promise.all([
                supabase.auth.admin.getUserById(userId),
                supabase
                    .from('profiles')
                    .select('role, email, roll_number')
                    .eq('user_id', userId)
                    .maybeSingle(),
            ]);
            if (authUserError) {
                throw authUserError;
            }
            if (profileError) {
                throw profileError;
            }
            const authUser = authUserResult.user;
            if (!authUser?.email_confirmed_at) {
                return Response.json({ error: 'The hosteller must verify their email before approval.' }, { status: 409 });
            }
            const profileEmail = profile?.email?.trim().toLowerCase() || authUser.email?.trim().toLowerCase();
            if (
                profile?.role !== 'student'
                || profile.roll_number !== registrationRequest.roll_number
                || profileEmail !== registrationRequest.email.trim().toLowerCase()
                || authUser.email?.trim().toLowerCase() !== registrationRequest.email.trim().toLowerCase()
            ) {
                return Response.json({ error: 'The verified student profile does not match this request.' }, { status: 409 });
            }

            if (reviewer.kind === 'warden') {
                const { data: blockAssignment, error: blockAssignmentError } = await supabase
                    .from('hostel_warden_blocks')
                    .select('block_id')
                    .eq('warden_id', reviewer.wardenId)
                    .eq('block_id', blockId)
                    .maybeSingle();
                if (blockAssignmentError) {
                    throw blockAssignmentError;
                }
                if (!blockAssignment) {
                    return Response.json({ error: 'You can only assign hostellers to your assigned blocks.' }, { status: 403 });
                }
            }
        }

        const { error: reviewError } = await supabase.rpc('review_hostel_registration_request', {
            target_user_id: userId,
            target_decision: decision,
            target_block_id: decision === 'approved' ? blockId : null,
            target_room_number: decision === 'approved' ? roomNumber : null,
            target_reviewer_user_id: reviewer.kind === 'admin' ? reviewer.userId : null,
            target_reviewer_warden_id: reviewer.kind === 'warden' ? reviewer.wardenId : null,
            target_review_note: reviewNote || null,
        });
        if (reviewError) {
            throw reviewError;
        }

        return Response.json({ success: true, status: decision });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel registration review error');
    }
}
