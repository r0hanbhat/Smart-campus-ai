import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { hostelErrorResponse } from '@/lib/server/hostel-auth';

export async function GET(request) {
    try {
        const { user, error: authError } = await getAuthenticatedUser(request);
        if (authError || !user?.id) {
            return Response.json({ error: 'Student login required.' }, { status: 401 });
        }

        const supabase = createSupabaseServiceRoleClient();
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, role, roll_number, display_name, full_name')
            .eq('user_id', user.id)
            .maybeSingle();
        if (profileError) {
            throw profileError;
        }
        if (profile?.role !== 'student') {
            return Response.json({ error: 'Student portal access required.' }, { status: 403 });
        }

        const { data: resident, error: residentError } = await supabase
            .from('hostel_residents')
            .select('block_id, room_number')
            .eq('user_id', user.id)
            .maybeSingle();
        if (residentError) {
            throw residentError;
        }
        if (!resident) {
            return Response.json({ error: 'No hostel assignment is linked to this account.' }, { status: 404 });
        }

        const { data: block, error: blockError } = await supabase
            .from('hostel_blocks')
            .select('name')
            .eq('id', resident.block_id)
            .maybeSingle();
        if (blockError) {
            throw blockError;
        }

        return Response.json({
            resident: {
                rollNumber: profile.roll_number,
                name: profile.display_name || profile.full_name || profile.roll_number,
                blockName: block?.name || 'Unassigned block',
                roomNumber: resident.room_number,
            },
        });
    } catch (error) {
        return hostelErrorResponse(error, 'Hosteller portal error');
    }
}
