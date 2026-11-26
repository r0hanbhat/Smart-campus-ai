import { NextResponse } from 'next/server';
import { lostAndFoundErrorResponse, requireLostAndFoundStudent } from '@/lib/server/lost-and-found.js';
import { normalizeLostFoundItemInput } from '@/lib/smart-campus/lost-and-found.js';

export async function GET(request) {
    try {
        const { user, serviceClient } = await requireLostAndFoundStudent(request);
        const [openResult, ownResult] = await Promise.all([
            serviceClient
                .from('lost_found_items')
                .select('id, item_type, title, description, found_location, found_date, status, created_at, updated_at')
                .eq('status', 'open')
                .order('created_at', { ascending: false })
                .limit(100),
            serviceClient
                .from('lost_found_items')
                .select('id, item_type, title, description, found_location, found_date, status, created_at, updated_at')
                .eq('finder_id', user.id)
                .order('created_at', { ascending: false })
                .limit(100),
        ]);
        if (openResult.error) throw openResult.error;
        if (ownResult.error) throw ownResult.error;

        const ownItemIds = new Set((ownResult.data || []).map((item) => item.id));
        const itemsById = new Map();
        for (const item of [...(openResult.data || []), ...(ownResult.data || [])]) {
            itemsById.set(item.id, { ...item, is_mine: ownItemIds.has(item.id) });
        }
        const items = [...itemsById.values()];
        const ownPostIds = items.filter((item) => item.is_mine).map((item) => item.id);

        const [myClaimsResult, receivedClaimsResult] = await Promise.all([
            serviceClient
                .from('lost_found_claims')
                .select('id, item_id, message, status, response, created_at, updated_at')
                .eq('claimant_id', user.id),
            ownPostIds.length > 0
                ? serviceClient
                    .from('lost_found_claims')
                    .select('id, item_id, message, status, response, created_at, updated_at, claimant:profiles!lost_found_claims_claimant_id_fkey(display_name, full_name)')
                    .in('item_id', ownPostIds)
                    .order('created_at', { ascending: false })
                : Promise.resolve({ data: [], error: null }),
        ]);
        if (myClaimsResult.error) throw myClaimsResult.error;
        if (receivedClaimsResult.error) throw receivedClaimsResult.error;

        const myClaims = new Map((myClaimsResult.data || []).map((claim) => [claim.item_id, claim]));
        const receivedClaims = new Map();
        for (const claim of receivedClaimsResult.data || []) {
            const claims = receivedClaims.get(claim.item_id) || [];
            claims.push(claim);
            receivedClaims.set(claim.item_id, claims);
        }

        items.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
        return NextResponse.json({
            items: items.map((item) => ({
                ...item,
                my_claim: myClaims.get(item.id) || null,
                claims: item.is_mine ? receivedClaims.get(item.id) || [] : [],
            })),
        }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
        return lostAndFoundErrorResponse(error, 'Lost and Found list error');
    }
}

export async function POST(request) {
    try {
        const { user, serviceClient } = await requireLostAndFoundStudent(request);
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
        }

        const normalized = normalizeLostFoundItemInput(body);
        if (normalized.error) {
            return NextResponse.json({ error: normalized.error }, { status: 400 });
        }

        const { data: item, error } = await serviceClient
            .from('lost_found_items')
            .insert({
                finder_id: user.id,
                item_type: normalized.value.itemType,
                title: normalized.value.title,
                description: normalized.value.description,
                found_location: normalized.value.location,
                found_date: normalized.value.date,
            })
            .select('id, item_type, title, description, found_location, found_date, status, created_at, updated_at')
            .single();
        if (error) throw error;

        return NextResponse.json({ item: { ...item, is_mine: true, my_claim: null, claims: [] } }, { status: 201 });
    } catch (error) {
        return lostAndFoundErrorResponse(error, 'Lost and Found post creation error');
    }
}
