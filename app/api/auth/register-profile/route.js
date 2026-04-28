import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/server/supabase';
import { isMissingSchemaTableError, withMissingColumnFallback } from '@/lib/supabase/schema-compat.js';

export async function POST(request) {
    try {
        const body = await request.json();
        const {
            userId,
            email,
            name,
            age,
            role,
            phoneNumber,
            phoneVerified,
            employeeId,
            employeeIdImageData,
            employeeIdImageName,
            rollNumber,
            course,
            branch,
            semester,
        } = body || {};

        if (!userId || !email || !name || !role) {
            return NextResponse.json({ error: 'Missing required signup fields.' }, { status: 400 });
        }
        if (!['student', 'teacher'].includes(role)) {
            return NextResponse.json({ error: 'Unsupported signup role.' }, { status: 400 });
        }
        if (role === 'teacher' && (!employeeId || !employeeIdImageData || !phoneNumber)) {
            return NextResponse.json({ error: 'Teacher signup requires phone number, employee ID, and ID image.' }, { status: 400 });
        }

        const supabase = await createSupabaseServerClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
            return NextResponse.json({ error: userError.message }, { status: 401 });
        }
        if (!user) {
            return NextResponse.json({ error: 'You must be signed in to finish profile registration.' }, { status: 401 });
        }
        if (user.id !== userId) {
            return NextResponse.json({ error: 'Authenticated user does not match the registration payload.' }, { status: 403 });
        }

        const normalizedEmail = user.email || email;
        const usernameBase = normalizedEmail.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
        const username = `${usernameBase}-${userId.slice(0, 4)}`;

        const profilePayload = {
            user_id: userId,
            username,
            display_name: name.trim(),
            full_name: name.trim(),
            age,
            email: normalizedEmail,
            role,
            verification_status: role === 'teacher' ? 'pending' : 'approved',
            phone_number: phoneNumber || null,
            phone_verified: Boolean(phoneVerified),
            employee_id: employeeId || null,
            roll_number: rollNumber || null,
            course: course || null,
            branch: branch || null,
            semester: Number.isFinite(Number(semester)) ? Number(semester) : null,
            is_online: false,
        };
        const { error: profileError } = await withMissingColumnFallback((nextProfilePayload) => supabase.from('profiles').upsert(nextProfilePayload, { onConflict: 'user_id' }), profilePayload, ['age', 'roll_number', 'course', 'branch', 'semester']);

        if (profileError) {
            return NextResponse.json({ error: profileError.message }, { status: 500 });
        }

        if (role === 'student' && rollNumber && course && branch && Number.isFinite(Number(semester))) {
            const { error: studentError } = await supabase.from('students').upsert({
                user_id: userId,
                name: name.trim(),
                roll_number: rollNumber.trim(),
                course: course.trim(),
                branch: branch.trim(),
                semester: Number(semester),
            }, { onConflict: 'user_id' });
            if (studentError) {
                if (isMissingSchemaTableError(studentError, 'students')) {
                    return NextResponse.json({ success: true, warning: 'Attendance schema is not available until the Supabase attendance schema is installed.' });
                }
                return NextResponse.json({ error: studentError.message }, { status: 500 });
            }
        }

        if (role === 'teacher') {
            const { error: requestError } = await supabase.from('teacher_verification_requests').upsert({
                user_id: userId,
                email: normalizedEmail,
                full_name: name.trim(),
                phone_number: phoneNumber,
                employee_id: employeeId,
                employee_id_image_name: employeeIdImageName || 'employee-id',
                employee_id_image_data: employeeIdImageData,
                status: 'pending',
            }, { onConflict: 'user_id' });
            if (requestError) {
                if (isMissingSchemaTableError(requestError, 'teacher_verification_requests')) {
                    return NextResponse.json({ success: true, warning: 'Teacher verification queue is not available until the Supabase role panel schema is installed.' });
                }
                return NextResponse.json({ error: requestError.message }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('Register Profile API Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to register profile.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
