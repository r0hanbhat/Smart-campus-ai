import { NextResponse } from 'next/server';
import { requireHostelAdmin, hostelErrorResponse } from '@/lib/server/hostel-auth';

export async function GET(request) {
    try {
        const supabase = await requireHostelAdmin(request);
        const [blocksResult, wardensResult, wardenBlocksResult, residentsResult, studentsResult] = await Promise.all([
            supabase.from('hostel_blocks').select('id, name').order('name', { ascending: true }),
            supabase.from('hostel_wardens').select('id, warden_id, display_name, is_active, created_at').order('warden_id', { ascending: true }),
            supabase.from('hostel_warden_blocks').select('warden_id, block_id'),
            supabase.from('hostel_residents').select('user_id, block_id, room_number, assigned_at'),
            supabase.from('profiles').select('user_id, roll_number, display_name, full_name').eq('role', 'student').not('roll_number', 'is', null).order('roll_number', { ascending: true }),
        ]);
        const queryError = [blocksResult, wardensResult, wardenBlocksResult, residentsResult, studentsResult]
            .find((result) => result.error)?.error;
        if (queryError) {
            throw queryError;
        }

        const blockNames = new Map((blocksResult.data || []).map((block) => [block.id, block.name]));
        const assignmentsByWarden = new Map();
        for (const assignment of wardenBlocksResult.data || []) {
            const assignments = assignmentsByWarden.get(assignment.warden_id) || [];
            assignments.push({ id: assignment.block_id, name: blockNames.get(assignment.block_id) || 'Unknown block' });
            assignmentsByWarden.set(assignment.warden_id, assignments);
        }

        const studentIds = (residentsResult.data || []).map((resident) => resident.user_id);
        const residentProfilesResult = studentIds.length > 0
            ? await supabase.from('profiles').select('user_id, roll_number, display_name, full_name').in('user_id', studentIds)
            : { data: [], error: null };
        if (residentProfilesResult.error) {
            throw residentProfilesResult.error;
        }
        const studentById = new Map((residentProfilesResult.data || []).map((student) => [student.user_id, student]));

        return NextResponse.json({
            blocks: blocksResult.data || [],
            wardens: (wardensResult.data || []).map((warden) => ({
                id: warden.id,
                wardenId: warden.warden_id,
                displayName: warden.display_name,
                isActive: warden.is_active,
                blocks: assignmentsByWarden.get(warden.id) || [],
            })),
            students: (studentsResult.data || []).map((student) => ({
                userId: student.user_id,
                rollNumber: student.roll_number,
                name: student.display_name || student.full_name || student.roll_number,
            })),
            residents: (residentsResult.data || []).map((resident) => {
                const student = studentById.get(resident.user_id);
                return {
                    userId: resident.user_id,
                    rollNumber: student?.roll_number || 'Unknown roll number',
                    name: student?.display_name || student?.full_name || '',
                    blockId: resident.block_id,
                    blockName: blockNames.get(resident.block_id) || 'Unknown block',
                    roomNumber: resident.room_number,
                };
            }),
        });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel admin data error');
    }
}
