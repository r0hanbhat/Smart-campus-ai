import { NextResponse } from 'next/server';
import { lostAndFoundErrorResponse, requireLostAndFoundStudent } from '@/lib/server/lost-and-found.js';
import {
    isValidLostFoundId,
    normalizeLostFoundResponse,
} from '@/lib/smart-campus/lost-and-found.js';

export async function PATCH(request, { params }) {
    try {
        const { user, serviceClient } = await requireLostAndFoundStudent(request);
        const { id } = await params;
        if (!isValidLostFoundId(id)) {
            return NextResponse.json({ error: 'Choose a valid claim request.' }, { status: 400 });
        }
        if (!isValidLostAndFoundId(id)) {
            return NextResponse.json({ error: 'Choose a valid claim request.' }, { status: 400 });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
        }
        if (!['accepted', 'declined'].includes(body?.decision)) {
            return NextResponse.json({ error: 'Choose accept or decline.' }, { status: 400 });
        }

        const normalized = normalizeLostFoundResponse(body?.response);
        const { data: claimId, error } = await serviceClient.rpc('respond_to_lost_found_claim', {
            target_claim_id: id,
            target_finder_id: user.id,
            target_decision: body.decision,
            target_response: normalized.value,
        });
        if (error) throw error;

        return NextResponse.json({ claimId, status: body.decision });
    } catch (error) {
        return lostAndFoundErrorResponse(error, 'Lost and Found claim response error');
    }
}
