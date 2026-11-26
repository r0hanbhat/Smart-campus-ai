import { NextResponse } from 'next/server';
import { hostelErrorResponse, requireHostelAdmin } from '@/lib/server/hostel-auth';
import { normalizeHostelBlockName } from '@/lib/smart-campus/hostel.js';

export async function POST(request) {
    try {
        const supabase = await requireHostelAdmin(request);
        const body = await request.json();
        const name = normalizeHostelBlockName(body?.name);
        if (!name || name.length > 80) {
            return NextResponse.json({ error: 'Enter a block name up to 80 characters.' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('hostel_blocks')
            .insert({ name })
            .select('id, name')
            .single();
        if (error?.code === '23505') {
            return NextResponse.json({ error: 'A block with that name already exists.' }, { status: 409 });
        }
        if (error) {
            throw error;
        }
        return NextResponse.json({ block: data }, { status: 201 });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel block creation error');
    }
}
