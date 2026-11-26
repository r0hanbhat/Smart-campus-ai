import { NextResponse } from 'next/server';
import { hostelErrorResponse, requireHostelAdmin } from '@/lib/server/hostel-auth';

export async function POST(request) {
    try {
        const supabase = await requireHostelAdmin(request);
        const body = await request.json();
        const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
        const blockId = typeof body?.blockId === 'string' ? body.blockId.trim() : '';
        const roomNumber = typeof body?.roomNumber === 'string' ? body.roomNumber.trim() : '';
        if (!userId || !blockId || !roomNumber || roomNumber.length > 32) {
            return NextResponse.json({ error: 'Choose a student and block, and enter a room number up to 32 characters.' }, { status: 400 });
        }

        const [{ data: profile, error: profileError }, { data: block, error: blockError }] = await Promise.all([
            supabase.from('profiles').select('user_id, role').eq('user_id', userId).maybeSingle(),
            supabase.from('hostel_blocks').select('id').eq('id', blockId).maybeSingle(),
        ]);
        if (profileError) {
            throw profileError;
        }
        if (blockError) {
            throw blockError;
        }
        if (profile?.role !== 'student') {
            return NextResponse.json({ error: 'Only existing student accounts can be assigned as hostel residents.' }, { status: 400 });
        }
        if (!block) {
            return NextResponse.json({ error: 'Selected block does not exist.' }, { status: 400 });
        }

        const { error } = await supabase
            .from('hostel_residents')
            .upsert({
                user_id: userId,
                block_id: blockId,
                room_number: roomNumber,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel resident assignment error');
    }
}
