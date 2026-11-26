import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';
import { hostelErrorResponse, readWardenSession } from '@/lib/server/hostel-auth';
import { normalizeHostelOutpassDecision } from '@/lib/smart-campus/outpass.js';

export async function PATCH(request, { params }) {
    try {
        const { id } = await params;
        if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
            return NextResponse.json({ error: 'A valid outpass request ID is required.' }, { status: 400 });
        }

        const supabase = createSupabaseServiceRoleClient();
        const warden = await readWardenSession(supabase);
        let staffRole;
        let staffId;
        if (warden) {
            staffRole = 'warden';
            staffId = warden.id;
        } else {
            const { user, error: authError } = await getAuthenticatedUser(request);
            if (authError || !user?.id) {
                return NextResponse.json({ error: 'Authorized hostel staff login required.' }, { status: 401 });
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
                return NextResponse.json({ error: 'Only assigned wardens or hostel admins can review outpasses.' }, { status: 403 });
            }
            staffRole = 'admin';
            staffId = user.id;
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
        }
        const status = normalizeHostelOutpassDecision(body?.status);
        const message = typeof body?.message === 'string' ? body.message.trim() : '';
        if (!status || !message || message.length > 1000) {
            return NextResponse.json({ error: 'Choose approve or reject and provide a review note of up to 1,000 characters.' }, { status: 400 });
        }

        const { data: updatedId, error } = await supabase.rpc('review_hostel_outpass_request', {
            target_request_id: id,
            staff_role: staffRole,
            staff_id: staffId,
            next_status: status,
            decision_message: message,
        });
        if (error) {
            if (error.code === '42501') {
                return NextResponse.json({ error: 'This request is not in one of your assigned blocks.' }, { status: 403 });
            }
            if (error.code === '55000') {
                return NextResponse.json({ error: 'This request has already been reviewed.' }, { status: 409 });
            }
            if (error.code === 'P0002') {
                return NextResponse.json({ error: 'Outpass request not found.' }, { status: 404 });
            }
            throw error;
        }
        if (!updatedId) {
            return NextResponse.json({ error: 'Outpass request was not updated.' }, { status: 404 });
        }
        return NextResponse.json({ success: true, requestId: updatedId });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel outpass review error');
    }
}
