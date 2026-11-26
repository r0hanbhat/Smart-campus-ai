import { NextResponse } from 'next/server';
import { lostAndFoundErrorResponse, requireLostAndFoundStudent } from '@/lib/server/lost-and-found.js';
import { isValidLostFoundId } from '@/lib/smart-campus/lost-and-found.js';

export async function PATCH(request, { params }) {
    try {
        const { user, serviceClient } = await requireLostAndFoundStudent(request);
        const { id } = await params;
        if (!isValidLostFoundId(id)) {
            return NextResponse.json({ error: 'Choose a valid Lost & Found post.' }, { status: 400 });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
        }
        if (body?.action !== 'mark_returned') {
            return NextResponse.json({ error: 'Choose a supported item action.' }, { status: 400 });
        }

        const { data, error } = await serviceClient.rpc('mark_lost_found_item_returned', {
            target_item_id: id,
            target_finder_id: user.id,
        });
        if (error) throw error;
        return NextResponse.json({ returned: true, itemId: data });
    } catch (error) {
        return lostAndFoundErrorResponse(error, 'Lost and Found item update error');
    }
}
