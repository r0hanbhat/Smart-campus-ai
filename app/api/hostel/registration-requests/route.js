import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { hostelErrorResponse, readWardenSession } from '@/lib/server/hostel-auth';

async function getAccountRole(supabase, userId) {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        throw error;
    }
    return profile?.role || null;
}

export async function GET(request) {
    try {
        const supabase = createSupabaseServiceRoleClient();
        const { user, error: authError } = await getAuthenticatedUser(request);

        if (user?.id && !authError) {
            const role = await getAccountRole(supabase, user.id);
            if (role === 'student') {
                const { data: registrationRequest, error } = await supabase
                    .from('hostel_registration_requests')
                    .select('status, review_note, created_at')
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (error) {
                    throw error;
                }
                return Response.json({ request: registrationRequest || null });
            }
            if (role === 'admin') {
                const [{ data: requests, error: requestsError }, { data: blocks, error: blocksError }] = await Promise.all([
                    supabase
                        .from('hostel_registration_requests')
                        .select('user_id, roll_number, email, status, created_at')
                        .eq('status', 'pending')
                        .order('created_at', { ascending: true }),
                    supabase.from('hostel_blocks').select('id, name').order('name', { ascending: true }),
                ]);
                if (requestsError) {
                    throw requestsError;
                }
                if (blocksError) {
                    throw blocksError;
                }
                return Response.json({ requests: requests || [], blocks: blocks || [] });
            }
        }

        const warden = await readWardenSession(supabase);
        if (!warden) {
            return Response.json({ error: authError ? 'Student or staff login required.' : 'Hostel staff access required.' }, { status: 401 });
        }

        const { data: assignments, error: assignmentsError } = await supabase
            .from('hostel_warden_blocks')
            .select('block_id')
            .eq('warden_id', warden.id);
        if (assignmentsError) {
            throw assignmentsError;
        }
        const blockIds = (assignments || []).map((assignment) => assignment.block_id);
        const [{ data: requests, error: requestsError }, { data: blocks, error: blocksError }] = await Promise.all([
            supabase
                .from('hostel_registration_requests')
                .select('user_id, roll_number, email, status, created_at')
                .eq('status', 'pending')
                .order('created_at', { ascending: true }),
            blockIds.length
                ? supabase.from('hostel_blocks').select('id, name').in('id', blockIds).order('name', { ascending: true })
                : Promise.resolve({ data: [], error: null }),
        ]);
        if (requestsError) {
            throw requestsError;
        }
        if (blocksError) {
            throw blocksError;
        }
        return Response.json({ requests: requests || [], blocks: blocks || [] });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel registration requests error');
    }
}

export async function POST(request) {
    try {
        const { user, error: authError } = await getAuthenticatedUser(request);
        if (authError || !user?.id) {
            return Response.json({ error: 'Sign in with your student account after verifying your email.' }, { status: 401 });
        }
        if (!user.email_confirmed_at) {
            return Response.json({ error: 'Verify your campus email before requesting hostel access.' }, { status: 403 });
        }

        const supabase = createSupabaseServiceRoleClient();
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, role, email, roll_number')
            .eq('user_id', user.id)
            .maybeSingle();
        if (profileError) {
            throw profileError;
        }
        if (profile?.role !== 'student' || !profile.roll_number || !user.email) {
            return Response.json({ error: 'A student profile with a roll number is required to request hostel access.' }, { status: 403 });
        }
        if (profile.email && profile.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
            return Response.json({ error: 'Your verified email does not match your student profile. Contact an administrator.' }, { status: 403 });
        }

        const { data: assignment, error: assignmentError } = await supabase
            .from('hostel_residents')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();
        if (assignmentError) {
            throw assignmentError;
        }
        if (assignment) {
            return Response.json({ error: 'A hostel assignment is already linked to this account.' }, { status: 409 });
        }

        const { data: existingRequest, error: existingRequestError } = await supabase
            .from('hostel_registration_requests')
            .select('status')
            .eq('user_id', user.id)
            .maybeSingle();
        if (existingRequestError) {
            throw existingRequestError;
        }
        if (existingRequest?.status === 'pending') {
            return Response.json({ success: true, status: 'pending' });
        }

        const { error: saveError } = await supabase
            .from('hostel_registration_requests')
            .upsert({
                user_id: user.id,
                roll_number: profile.roll_number,
                email: user.email.trim().toLowerCase(),
                status: 'pending',
                review_note: null,
                reviewed_by_user_id: null,
                reviewed_by_warden_id: null,
                reviewed_at: null,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
        if (saveError) {
            throw saveError;
        }

        return Response.json({ success: true, status: 'pending' });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel access request error');
    }
}
