import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { hostelErrorResponse, readWardenSession } from '@/lib/server/hostel-auth';
import { listHostelMaintenanceRequests } from '@/lib/server/hostel-maintenance';
import {
    normalizeHostelMaintenanceCategory,
    validateHostelMaintenanceReport,
} from '@/lib/smart-campus/hostel.js';

export async function GET(request) {
    try {
        const supabase = createSupabaseServiceRoleClient();
        const warden = await readWardenSession(supabase);
        if (warden) {
            const { data: assignments, error: assignmentError } = await supabase
                .from('hostel_warden_blocks')
                .select('block_id')
                .eq('warden_id', warden.id);
            if (assignmentError) {
                throw assignmentError;
            }
            const blockIds = (assignments || []).map((assignment) => assignment.block_id);
            const requests = await listHostelMaintenanceRequests(supabase, { blockIds });
            return NextResponse.json({ role: 'warden', requests });
        }

        const { user, error: authError } = await getAuthenticatedUser(request);
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Hosteller login required.' }, { status: 401 });
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
            return NextResponse.json({ error: 'Hosteller portal access required.' }, { status: 403 });
        }

        const requests = await listHostelMaintenanceRequests(supabase, { reporterUserId: user.id });
        return NextResponse.json({ role: 'hosteller', requests });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel maintenance list error');
    }
}

export async function POST(request) {
    try {
        const { user, error: authError } = await getAuthenticatedUser(request);
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Hosteller login required.' }, { status: 401 });
        }

        const supabase = createSupabaseServiceRoleClient();
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle();
        if (profileError) {
            throw profileError;
        }
        if (profile?.role !== 'student') {
            return NextResponse.json({ error: 'Hosteller portal access required.' }, { status: 403 });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
        }
        const title = typeof body?.title === 'string' ? body.title.trim() : '';
        const description = typeof body?.description === 'string' ? body.description.trim() : '';
        const category = normalizeHostelMaintenanceCategory(body?.category);
        const validationError = validateHostelMaintenanceReport({ title, description, category });
        if (validationError) {
            return NextResponse.json({ error: validationError }, { status: 400 });
        }

        const { data: requestId, error: createError } = await supabase.rpc('create_hostel_maintenance_request', {
            target_reporter_user_id: user.id,
            request_title: title,
            request_description: description,
            request_category: category,
        });
        if (createError) {
            if (createError.code === '42501') {
                return NextResponse.json({ error: 'A hostel block and room must be assigned before reporting maintenance.' }, { status: 403 });
            }
            throw createError;
        }

        return NextResponse.json({ success: true, requestId }, { status: 201 });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel maintenance submission error');
    }
}
