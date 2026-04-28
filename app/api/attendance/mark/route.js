import { NextResponse } from 'next/server';
import { getUserRoleProfile, markAttendanceRecords } from '@/lib/server/attendance.js';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';

export async function POST(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const roleProfile = await getUserRoleProfile(supabase, user.id);
        const role = roleProfile?.role || 'student';
        if (!['teacher', 'admin'].includes(role)) {
            return NextResponse.json({ error: 'Teacher or admin access required.' }, { status: 403 });
        }

        const body = await request.json();
        const subjectId = typeof body?.subjectId === 'string' ? body.subjectId.trim() : '';
        const attendanceDate = typeof body?.date === 'string' ? body.date.trim() : '';
        const entries = Array.isArray(body?.entries) ? body.entries : [];

        if (!subjectId || !attendanceDate) {
            return NextResponse.json({ error: 'Subject and attendance date are required.' }, { status: 400 });
        }

        if (role === 'teacher') {
            // Only enforce assignment restriction when the teacher has been formally
            // assigned to at least one subject.  If no assignments exist yet the
            // teacher can mark any subject (admin can formalise assignments later).
            const { getTeacherAssignedSubjects } = await import('@/lib/server/attendance.js');
            const assigned = await getTeacherAssignedSubjects(supabase, user.id).catch(() => []);
            if (assigned.length > 0 && !assigned.some((s) => s.id === subjectId)) {
                return NextResponse.json({ error: 'You are not assigned to this subject. Ask admin to assign it to you.' }, { status: 403 });
            }
        }

        // Use the service-role client for the actual write so RLS never silently
        // drops attendance rows.  Auth + role checks above already gate access.
        const serviceClient = createSupabaseServiceRoleClient();
        const markedCount = await markAttendanceRecords(serviceClient, {
            teacherUserId: user.id,
            subjectId,
            date: attendanceDate,
            entries,
        });

        return NextResponse.json({
            success: true,
            markedCount,
        });
    }
    catch (error) {
        console.error('Attendance Mark API Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to mark attendance.';
        const status = error?.code === 'ATTENDANCE_SCHEMA_MISSING' ? 503 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
