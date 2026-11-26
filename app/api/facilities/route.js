import { NextResponse } from 'next/server';
import { facilityErrorResponse, requireFacilityAccess } from '@/lib/server/facility-bookings.js';
import { isValidFacilityDate, normalizeFacilityBookingInput } from '@/lib/smart-campus/facilities.js';

const CAMPUS_TIME_ZONE = 'Asia/Kolkata';

function getCampusDate() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: CAMPUS_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date, days) {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}

function validateScope(value) {
    return value === 'campus' || value === 'hostel';
}

export async function GET(request) {
    try {
        const scope = new URL(request.url).searchParams.get('scope');
        if (!validateScope(scope)) {
            return NextResponse.json({ error: 'Choose a valid facility scope.' }, { status: 400 });
        }
        const { user, serviceClient } = await requireFacilityAccess(request, { role: 'student', scope });
        const today = getCampusDate();
        const requestedDate = new URL(request.url).searchParams.get('date');
        if (scope === 'hostel' && requestedDate && (!isValidFacilityDate(requestedDate) || requestedDate < today)) {
            return NextResponse.json({ error: 'Choose a valid current or future date.' }, { status: 400 });
        }
        const fromDate = scope === 'hostel' ? requestedDate || today : today;
        const toDate = scope === 'hostel' ? fromDate : addDays(fromDate, 13);
        const { data: slots, error: slotsError } = await serviceClient.rpc('list_facility_slots', {
            target_user_id: user.id,
            target_scope: scope,
            target_from_date: fromDate,
            target_to_date: toDate,
        });
        if (slotsError) {
            throw slotsError;
        }

        const { data: bookings, error: bookingsError } = await serviceClient
            .from('facility_bookings')
            .select('id, schedule_id, resource_id, starts_at, ends_at, created_at, resource:facility_resources!facility_bookings_resource_id_fkey(name, code, scope, location)')
            .eq('user_id', user.id)
            .eq('status', 'booked')
            .gt('ends_at', new Date().toISOString())
            .order('starts_at', { ascending: true })
            .limit(100);
        if (bookingsError) {
            throw bookingsError;
        }

        return NextResponse.json({
            scope,
            slots: slots || [],
            bookings: (bookings || []).filter((booking) => booking.resource?.scope === scope),
        });
    } catch (error) {
        return facilityErrorResponse(error, 'Facility availability error');
    }
}

export async function POST(request) {
    try {
        const { user, serviceClient } = await requireFacilityAccess(request, { role: 'student' });
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
        }
        const normalized = normalizeFacilityBookingInput(body);
        if (normalized.error) {
            return NextResponse.json({ error: normalized.error }, { status: 400 });
        }

        const { data: bookingId, error } = await serviceClient.rpc('create_facility_booking', {
            target_user_id: user.id,
            target_schedule_id: normalized.value.scheduleId,
            target_slot_date: normalized.value.slotDate,
            target_slot_start: normalized.value.slotStart,
        });
        if (error) {
            throw error;
        }
        return NextResponse.json({ success: true, bookingId }, { status: 201 });
    } catch (error) {
        return facilityErrorResponse(error, 'Facility booking creation error');
    }
}

export async function DELETE(request) {
    try {
        const { user, serviceClient } = await requireFacilityAccess(request, { role: 'student' });
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
        }
        const bookingId = typeof body?.bookingId === 'string' ? body.bookingId.trim() : '';
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)) {
            return NextResponse.json({ error: 'Choose a valid booking to cancel.' }, { status: 400 });
        }

        const { error } = await serviceClient.rpc('cancel_facility_booking', {
            target_user_id: user.id,
            target_booking_id: bookingId,
        });
        if (error) {
            throw error;
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        return facilityErrorResponse(error, 'Facility booking cancellation error');
    }
}
