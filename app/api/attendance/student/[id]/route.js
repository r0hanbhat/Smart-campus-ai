import { NextResponse } from 'next/server';
import { buildStudentAttendancePayload, getStudentMappedSubjects, getUserRoleProfile, listAttendanceRecords, resolveStudentRecordForUser } from '@/lib/server/attendance.js';
import { getAuthenticatedUser } from '@/lib/server/supabase';

export async function GET(_request, context) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params;
        const requestedId = `${id || ''}`.trim();
        if (!requestedId) {
            return NextResponse.json({ error: 'Student ID is required.' }, { status: 400 });
        }

        const roleProfile = await getUserRoleProfile(supabase, user.id);
        const role = roleProfile?.role || 'student';
        if (role === 'student' && requestedId !== user.id) {
            return NextResponse.json({ error: 'Students can only view their own attendance.' }, { status: 403 });
        }

        const mappedSubjects = requestedId === user.id
            ? await getStudentMappedSubjects(supabase, user.id)
            : { subjects: [] };
        const studentRecord = await resolveStudentRecordForUser(supabase, requestedId);

        // If no students-table row exists for this user yet, attendance records
        // cannot exist either (they are keyed on students.id, not user_id).
        // Return a valid empty report with the academic profile so the UI can
        // prompt the student to complete their profile instead of showing 0%.
        if (!studentRecord) {
            const report = buildStudentAttendancePayload([], mappedSubjects.subjects);
            return NextResponse.json({
                ...report,
                academicProfile: mappedSubjects.academicProfile || null,
            });
        }

        const resolvedStudentId = studentRecord.id;
        const records = await listAttendanceRecords(supabase, { studentId: resolvedStudentId });
        const report = buildStudentAttendancePayload(records, mappedSubjects.subjects);
        return NextResponse.json({
            ...report,
            academicProfile: mappedSubjects.academicProfile || null,
        });
    }
    catch (error) {
        console.error('Student Attendance API Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to load student attendance.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
