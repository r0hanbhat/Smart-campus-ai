import { NextResponse } from 'next/server';
import { facilityErrorResponse, requireFacilityAccess } from '@/lib/server/facility-bookings.js';
import { normalizeFacilitySchedule } from '@/lib/smart-campus/facilities.js';

export async function GET(request) {
    try {
        const { serviceClient } = await requireFacilityAccess(request, { role: 'admin' });
        const [resourcesResult, schedulesResult, blocksResult] = await Promise.all([
            serviceClient.from('facility_resources').select('id, code, name, scope, location, is_active').order('scope').order('name'),
            serviceClient
                .from('facility_recurring_schedules')
                .select('id, resource_id, block_id, weekday, opens_at, closes_at, slot_minutes, capacity, active_from, active_until, is_active, resource:facility_resources!facility_recurring_schedules_resource_id_fkey(code, name, scope), block:hostel_blocks(id, name)')
                .order('weekday', { ascending: true })
                .order('opens_at', { ascending: true }),
            serviceClient.from('hostel_blocks').select('id, name').order('name', { ascending: true }),
        ]);
        const queryError = [resourcesResult, schedulesResult, blocksResult].find((result) => result.error)?.error;
        if (queryError) {
            throw queryError;
        }
        return NextResponse.json({
            resources: resourcesResult.data || [],
            schedules: schedulesResult.data || [],
            blocks: blocksResult.data || [],
        });
    } catch (error) {
        return facilityErrorResponse(error, 'Facility administration data error');
    }
}

export async function POST(request) {
    try {
        const { user, serviceClient } = await requireFacilityAccess(request, { role: 'admin' });
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
        }
        const resourceId = typeof body?.resourceId === 'string' ? body.resourceId.trim() : '';
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resourceId)) {
            return NextResponse.json({ error: 'Choose a valid facility.' }, { status: 400 });
        }
        const { data: resource, error: resourceError } = await serviceClient
            .from('facility_resources')
            .select('code')
            .eq('id', resourceId)
            .eq('is_active', true)
            .maybeSingle();
        if (resourceError) {
            throw resourceError;
        }
        if (!resource) {
            return NextResponse.json({ error: 'Choose an active facility.' }, { status: 400 });
        }
        let blockIds = body?.blockIds;
        if (body?.blockIds === 'all') {
            const { data: blocks, error: blocksError } = await serviceClient.from('hostel_blocks').select('id');
            if (blocksError) {
                throw blocksError;
            }
            blockIds = (blocks || []).map((block) => block.id);
        }
        const normalized = normalizeFacilitySchedule(
            { ...body, blockIds },
            { resourceCode: resource.code },
        );
        if (normalized.error) {
            return NextResponse.json({ error: normalized.error }, { status: 400 });
        }

        const { data: scheduleIds, error } = await serviceClient.rpc('create_facility_recurring_schedules', {
            target_admin_id: user.id,
            target_resource_id: normalized.value.resourceId,
            target_weekdays: normalized.value.weekdays,
            target_block_ids: normalized.value.blockIds,
            target_opens_at: normalized.value.opensAt,
            target_closes_at: normalized.value.closesAt,
            target_slot_minutes: normalized.value.slotMinutes,
            target_capacity: normalized.value.capacity,
            target_active_from: normalized.value.activeFrom,
            target_active_until: normalized.value.activeUntil,
        });
        if (error) {
            throw error;
        }
        return NextResponse.json({ success: true, scheduleIds }, { status: 201 });
    } catch (error) {
        return facilityErrorResponse(error, 'Facility schedule creation error');
    }
}

export async function PATCH(request) {
    try {
        const { user, serviceClient } = await requireFacilityAccess(request, { role: 'admin' });
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
        }
        const scheduleId = typeof body?.scheduleId === 'string' ? body.scheduleId.trim() : '';
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(scheduleId) || typeof body?.isActive !== 'boolean') {
            return NextResponse.json({ error: 'Choose a valid schedule and availability state.' }, { status: 400 });
        }

        const { error } = await serviceClient.rpc('set_facility_recurring_schedule_active', {
            target_admin_id: user.id,
            target_schedule_id: scheduleId,
            target_is_active: body.isActive,
        });
        if (error) {
            throw error;
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        return facilityErrorResponse(error, 'Facility schedule update error');
    }
}
