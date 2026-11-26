import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';
import { hostelErrorResponse, readWardenSession } from '@/lib/server/hostel-auth';
import { listHostelOutpassRequests } from '@/lib/server/hostel-outpass';
import { validateHostelOutpassRequest } from '@/lib/smart-campus/outpass.js';

async function getHosteller(supabase, request) {
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

export async function GET(request) {
    try {
        const supabase = createSupabaseServiceRoleClient();
        const warden = await readWardenSession(supabase);
        if (warden) {
            const { data: assignments, error } = await supabase
                .from('hostel_warden_blocks')
                .select('block_id')
                .eq('warden_id', warden.id);
            if (error) {
                throw error;
            }
            const requests = await listHostelOutpassRequests(
                supabase,
                { blockIds: (assignments || []).map((assignment) => assignment.block_id) },
            );
            return NextResponse.json({ role: 'warden', requests });
        }

        const { user, error: authError } = await getAuthenticatedUser(request);
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Hosteller or admin login required.' }, { status: 401 });
        }
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle();
        if (profileError) {
            throw profileError;
        }

        if (profile?.role === 'admin') {
            const requests = await listHostelOutpassRequests(supabase, { allRequests: true });
            return NextResponse.json({ role: 'admin', requests });
        }
        if (profile?.role !== 'student') {
            return NextResponse.json({ error: 'Hosteller or hostel admin access required.' }, { status: 403 });
        }

        const hosteller = await getHosteller(supabase, request);
        if (hosteller.response) {
            return hosteller.response;
        }
        const requests = await listHostelOutpassRequests(supabase, { hostellerUserId: hosteller.user.id });
        return NextResponse.json({ role: 'hosteller', requests });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel outpass list error');
    }
}

export async function POST(request) {
    try {
        const supabase = createSupabaseServiceRoleClient();
        const { user, response } = await getHosteller(supabase, request);
        if (response) {
            return response;
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
        }

        const destination = typeof body?.destination === 'string' ? body.destination.trim() : '';
        const purpose = typeof body?.purpose === 'string' ? body.purpose.trim() : '';
        const departureAt = typeof body?.departureAt === 'string' ? body.departureAt : '';
        const returnBy = typeof body?.returnBy === 'string' ? body.returnBy : '';
        const validationError = validateHostelOutpassRequest({ destination, purpose, departureAt, returnBy });
        if (validationError) {
            return NextResponse.json({ error: validationError }, { status: 400 });
        }

        const { data: requestId, error } = await supabase.rpc('create_hostel_outpass_request', {
            target_hosteller_user_id: user.id,
            request_destination: destination,
            request_purpose: purpose,
            request_departure_at: new Date(departureAt).toISOString(),
            request_return_by: new Date(returnBy).toISOString(),
        });
        if (error) {
            if (error.code === '42501') {
                return NextResponse.json({ error: 'A hostel room assignment is required to submit an outpass request.' }, { status: 403 });
            }
            throw error;
        }
        return NextResponse.json({ success: true, requestId }, { status: 201 });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel outpass submission error');
    }
}
