import { createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { hostelErrorResponse, readWardenSession } from '@/lib/server/hostel-auth';

export async function GET() {
    try {
        const supabase = createSupabaseServiceRoleClient();
        const warden = await readWardenSession(supabase);
        if (!warden) {
            return Response.json({ error: 'Warden session required.' }, { status: 401 });
        }

        const { data: assignments, error: assignmentsError } = await supabase
            .from('hostel_warden_blocks')
            .select('block_id')
            .eq('warden_id', warden.id);
        if (assignmentsError) {
            throw assignmentsError;
        }

        const blockIds = (assignments || []).map((assignment) => assignment.block_id);
        if (blockIds.length === 0) {
            return Response.json({
                warden: { wardenId: warden.warden_id, displayName: warden.display_name },
                blocks: [],
            });
        }

        const { data: blocks, error: blocksError } = await supabase
            .from('hostel_blocks')
            .select('id, name')
            .in('id', blockIds)
            .order('name', { ascending: true });
        if (blocksError) {
            throw blocksError;
        }

        const { data: residents, error: residentsError } = await supabase
            .from('hostel_residents')
            .select('user_id, block_id, room_number')
            .in('block_id', blockIds)
            .order('room_number', { ascending: true });
        if (residentsError) {
            throw residentsError;
        }

        const userIds = (residents || []).map((resident) => resident.user_id);
        const profilesResult = userIds.length > 0
            ? await supabase
                .from('profiles')
                .select('user_id, roll_number, display_name, full_name')
                .in('user_id', userIds)
            : { data: [], error: null };
        if (profilesResult.error) {
            throw profilesResult.error;
        }

        const profilesById = new Map((profilesResult.data || []).map((profile) => [profile.user_id, profile]));
        const residentsByBlock = new Map();
        for (const resident of residents || []) {
            const profile = profilesById.get(resident.user_id);
            if (!profile) {
                continue;
            }
            const blockResidents = residentsByBlock.get(resident.block_id) || [];
            blockResidents.push({
                rollNumber: profile.roll_number,
                name: profile.display_name || profile.full_name || profile.roll_number,
                roomNumber: resident.room_number,
            });
            residentsByBlock.set(resident.block_id, blockResidents);
        }

        return Response.json({
            warden: { wardenId: warden.warden_id, displayName: warden.display_name },
            blocks: (blocks || []).map((block) => ({
                id: block.id,
                name: block.name,
                residents: residentsByBlock.get(block.id) || [],
            })),
        });
    } catch (error) {
        return hostelErrorResponse(error, 'Warden session error');
    }
}
