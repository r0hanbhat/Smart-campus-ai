import 'server-only';

import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';
import { isMissingSchemaColumnError, isMissingSchemaTableError } from '@/lib/supabase/schema-compat.js';

const FACILITY_TABLES = [
    'facility_resources',
    'facility_recurring_schedules',
    'facility_bookings',
    'hostel_blocks',
];

export async function requireFacilityAccess(request, { role, scope } = {}) {
    const { user, supabase, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user?.id) {
        throw Object.assign(new Error('Unauthorized.'), { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
    if (profileError) {
        throw profileError;
    }
    if (role && profile?.role !== role) {
        throw Object.assign(new Error(role === 'admin' ? 'Admin access required.' : 'Student access required.'), { status: 403 });
    }
    if (!role && !['admin', 'student'].includes(profile?.role)) {
        throw Object.assign(new Error('Facility access is not available for this account.'), { status: 403 });
    }

    const serviceClient = createSupabaseServiceRoleClient();
    if (scope === 'hostel' && profile?.role === 'student') {
        const { data: resident, error: residentError } = await serviceClient
            .from('hostel_residents')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();
        if (residentError) {
            throw residentError;
        }
        if (!resident) {
            throw Object.assign(new Error('A hostel room assignment is required.'), { status: 403 });
        }
    }

    return { user, profile, serviceClient };
}

export function facilityErrorResponse(error, label) {
    if (isMissingSchemaColumnError(error, 'block_id')) {
        return NextResponse.json({
            error: 'Block-specific hostel facilities are not installed. Reapply supabase/facility_booking_windows_upgrade.sql in Supabase.',
        }, { status: 503 });
    }
    if (isMissingSchemaTableError(error, 'hostel_residents')) {
        return NextResponse.json({
            error: 'Hostel assignments are not installed. Apply supabase/hostel_schema.sql before enabling hostel facility bookings.',
        }, { status: 503 });
    }
    if (isMissingSchemaTableError(error, 'hostel_blocks')) {
        return NextResponse.json({
            error: 'Hostel blocks are not installed. Apply supabase/hostel_schema.sql before publishing block-specific laundry availability.',
        }, { status: 503 });
    }
    if (FACILITY_TABLES.some((tableName) => isMissingSchemaTableError(error, tableName))) {
        return NextResponse.json({
            error: 'Facility booking database is not installed. Apply supabase/facility_bookings_schema.sql in Supabase first.',
        }, { status: 503 });
    }
    if (
        ['PGRST202', '42883'].includes(error?.code)
        && [
            'facility_slot_booking_window_is_open',
            'list_facility_slots',
            'create_facility_recurring_schedule',
            'create_facility_recurring_schedules',
            'set_facility_recurring_schedule_active',
            'create_facility_booking',
            'cancel_facility_booking',
        ].some((functionName) => error?.message?.includes(functionName))
    ) {
        return NextResponse.json({
            error: 'Facility booking functions are not installed. Apply supabase/facility_bookings_schema.sql, then supabase/facility_booking_windows_upgrade.sql in Supabase.',
        }, { status: 503 });
    }

    const status = Number.isInteger(error?.status)
        ? error.status
        : error?.code === '42501'
            ? 403
            : error?.code === 'P0002'
                ? 404
                : ['P0001', '23505', '55000'].includes(error?.code)
                    ? 409
                    : 500;
    if (status >= 500) {
        console.error(`${label}:`, error);
    }
    return NextResponse.json({
        error: status < 500 && typeof error?.message === 'string'
            ? error.message
            : 'Facility booking request failed.',
    }, { status });
}
