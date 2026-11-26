import { NextResponse } from 'next/server';
import { lostAndFoundErrorResponse, requireLostAndFoundStudent } from '@/lib/server/lost-and-found.js';
import { isValidLostFoundId, normalizeLostFoundClaimMessage } from '@/lib/smart-campus/lost-and-found.js';

export async function POST(request, { params }) {
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
        const normalized = normalizeLostFoundClaimMessage(body?.message);
        if (normalized.error) {
            return NextResponse.json({ error: normalized.error }, { status: 400 });
        }

        const { data: claimId, error } = await serviceClient.rpc('submit_lost_found_claim', {
            target_item_id: id,
            target_claimant_id: user.id,
            target_message: normalized.value,
        });
        if (error) throw error;

        return NextResponse.json({ claimId, status: 'pending' }, { status: 201 });
    } catch (error) {
        return lostAndFoundErrorResponse(error, 'Lost and Found claim submission error');
    }
}
