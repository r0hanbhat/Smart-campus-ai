import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { isMissingSchemaTableError } from '@/lib/supabase/schema-compat.js';

export async function GET() {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { data, error } = await supabase
            .from('teacher_verification_requests')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) {
            if (isMissingSchemaTableError(error, 'teacher_verification_requests')) {
                return NextResponse.json({ request: null, disabled: true });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ request: data || null });
    }
    catch (error) {
        console.error('Teacher Verification Request API Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to load teacher verification request.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
        const phoneNumber = typeof body?.phoneNumber === 'string' ? body.phoneNumber.trim() : '';
        const employeeId = typeof body?.employeeId === 'string' ? body.employeeId.trim() : '';
        const employeeIdImageData = typeof body?.employeeIdImageData === 'string' ? body.employeeIdImageData.trim() : '';
        const employeeIdImageName = typeof body?.employeeIdImageName === 'string' ? body.employeeIdImageName.trim() : '';

        if (!fullName || !phoneNumber || !employeeId) {
            return NextResponse.json({ error: 'Missing teacher verification fields.' }, { status: 400 });
        }

        const adminSupabase = createSupabaseServiceRoleClient();
        const { error } = await adminSupabase.from('teacher_verification_requests').upsert({
            user_id: user.id,
            email: user.email || null,
            full_name: fullName,
            phone_number: phoneNumber,
            employee_id: employeeId,
            employee_id_image_name: employeeIdImageName || 'employee-id',
            employee_id_image_data: employeeIdImageData,
            status: 'pending',
        }, { onConflict: 'user_id' });

        if (error) {
            if (isMissingSchemaTableError(error, 'teacher_verification_requests')) {
                return NextResponse.json({ error: 'Teacher verification is not available until the Supabase role panel schema is installed.', disabled: true }, { status: 503 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('Teacher Verification Request POST Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to submit teacher verification request.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
