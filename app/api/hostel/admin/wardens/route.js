import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { hostelErrorResponse, requireHostelAdmin } from '@/lib/server/hostel-auth';
import { normalizeWardenId } from '@/lib/smart-campus/hostel.js';

export async function POST(request) {
    try {
        const supabase = await requireHostelAdmin(request);
        const body = await request.json();
        const wardenId = normalizeWardenId(body?.wardenId);
        const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
        const passcode = typeof body?.passcode === 'string' ? body.passcode : '';
        const blockIds = Array.isArray(body?.blockIds)
            ? [...new Set(body.blockIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))]
            : [];
        if (!wardenId || wardenId.length > 64 || !displayName || displayName.length > 120 || passcode.length < 8 || Buffer.byteLength(passcode, 'utf8') > 72 || blockIds.length === 0) {
            return NextResponse.json({
                error: 'Enter a Warden ID, a name, a passcode of at least 8 characters, and at least one assigned block.',
            }, { status: 400 });
        }

        const { data: blocks, error: blocksError } = await supabase
            .from('hostel_blocks')
            .select('id')
            .in('id', blockIds);
        if (blocksError) {
            throw blocksError;
        }
        if ((blocks || []).length !== blockIds.length) {
            return NextResponse.json({ error: 'One or more selected blocks do not exist.' }, { status: 400 });
        }

        const passwordHash = await bcrypt.hash(passcode, 12);
        const { data: warden, error: wardenError } = await supabase
            .from('hostel_wardens')
            .insert({ warden_id: wardenId, display_name: displayName, password_hash: passwordHash })
            .select('id, warden_id, display_name')
            .single();
        if (wardenError?.code === '23505') {
            return NextResponse.json({ error: 'That Warden ID is already in use.' }, { status: 409 });
        }
        if (wardenError) {
            throw wardenError;
        }

        const { error: assignmentError } = await supabase
            .from('hostel_warden_blocks')
            .insert(blockIds.map((blockId) => ({ warden_id: warden.id, block_id: blockId })));
        if (assignmentError) {
            const { error: rollbackError } = await supabase.from('hostel_wardens').delete().eq('id', warden.id);
            if (rollbackError) {
                console.error('Failed to roll back incomplete warden creation:', rollbackError);
            }
            throw assignmentError;
        }

        return NextResponse.json({ warden: { wardenId: warden.warden_id, displayName: warden.display_name } }, { status: 201 });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel warden creation error');
    }
}
