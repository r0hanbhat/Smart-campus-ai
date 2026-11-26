import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { hostelErrorResponse, readWardenSession } from '@/lib/server/hostel-auth';
import { normalizeHostelMaintenanceStatus } from '@/lib/smart-campus/hostel.js';

export async function PATCH(request, { params }) {
    try {
        const { id } = await params;
        if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
            return NextResponse.json({ error: 'A maintenance request ID is required.' }, { status: 400 });
        }

        const supabase = createSupabaseServiceRoleClient();
        const warden = await readWardenSession(supabase);
        if (!warden) {
            return NextResponse.json({ error: 'Warden login required.' }, { status: 401 });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
        }
        const status = normalizeHostelMaintenanceStatus(body?.status);
        const message = typeof body?.message === 'string' ? body.message.trim() : '';
        if (!status || !message || message.length > 1000) {
            return NextResponse.json({ error: 'Choose a valid status and enter an update of up to 1,000 characters.' }, { status: 400 });
        }

        const { data: updatedId, error } = await supabase.rpc('update_hostel_maintenance_request', {
            target_request_id: id,
            target_warden_id: warden.id,
            next_status: status,
            update_message: message,
        });
        if (error) {
            if (error.code === '42501') {
                return NextResponse.json({ error: 'This request is not in one of your assigned blocks.' }, { status: 403 });
            }
            throw error;
        }
        if (!updatedId) {
            return NextResponse.json({ error: 'Maintenance request was not updated.' }, { status: 404 });
        }

        return NextResponse.json({ success: true, requestId: updatedId });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel maintenance update error');
    }
}
