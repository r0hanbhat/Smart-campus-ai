import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { getUserRoleProfile } from '@/lib/server/attendance.js';
import { isMissingSchemaTableError } from '@/lib/supabase/schema-compat.js';

async function assertAdmin(supabase, userId) {
    const profile = await getUserRoleProfile(supabase, userId);
    if (profile?.role !== 'admin') {
        throw Object.assign(new Error('Admin access required.'), { status: 403 });
    }
}

// PATCH /api/admin/students/[id]  — update semester / course / branch
export async function PATCH(request, context) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        await assertAdmin(supabase, user.id);

        const { id } = await context.params;
        const studentId = `${id || ''}`.trim();
        if (!studentId) {
            return NextResponse.json({ error: 'Student ID is required.' }, { status: 400 });
        }

        const body = await request.json();
        const updates = {};
        if (typeof body?.name === 'string' && body.name.trim()) {
            updates.name = body.name.trim();
        }
        if (typeof body?.rollNumber === 'string' && body.rollNumber.trim()) {
            updates.roll_number = body.rollNumber.trim();
        }
        if (typeof body?.course === 'string' && body.course.trim()) {
            updates.course = body.course.trim();
        }
        if (typeof body?.branch === 'string' && body.branch.trim()) {
            updates.branch = body.branch.trim();
        }
        if (body?.semester !== undefined && body?.semester !== null) {
            const sem = Number.parseInt(`${body.semester}`, 10);
            if (!Number.isNaN(sem) && sem >= 1 && sem <= 12) {
                updates.semester = sem;
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
        }

        const { data: student, error: fetchError } = await supabase
            .from('students')
            .select('id, user_id')
            .eq('id', studentId)
            .maybeSingle();

        if (fetchError || !student) {
            return NextResponse.json({ error: 'Student record not found.' }, { status: 404 });
        }

        const { error: updateError } = await supabase
            .from('students')
            .update(updates)
            .eq('id', studentId);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Mirror to profiles as well.
        const profileUpdates = {};
        if (updates.course) profileUpdates.course = updates.course;
        if (updates.branch) profileUpdates.branch = updates.branch;
        if (updates.semester) profileUpdates.semester = updates.semester;
        if (updates.roll_number) profileUpdates.roll_number = updates.roll_number;
        if (Object.keys(profileUpdates).length > 0) {
            await supabase.from('profiles').update(profileUpdates).eq('user_id', student.user_id);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Admin Students PATCH Error:', error);
        const status = error?.status || 500;
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update student.' }, { status });
    }
}

// DELETE /api/admin/students/[id]  — remove student record (not the auth user)
export async function DELETE(request, context) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        await assertAdmin(supabase, user.id);

        const { id } = await context.params;
        const studentId = `${id || ''}`.trim();
        if (!studentId) {
            return NextResponse.json({ error: 'Student ID is required.' }, { status: 400 });
        }

        const { error: deleteError } = await supabase
            .from('students')
            .delete()
            .eq('id', studentId);

        if (deleteError) {
            if (isMissingSchemaTableError(deleteError, 'students')) {
                return NextResponse.json({ error: 'Attendance schema is not installed.' }, { status: 503 });
            }
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Admin Students DELETE Error:', error);
        const status = error?.status || 500;
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to remove student.' }, { status });
    }
}
