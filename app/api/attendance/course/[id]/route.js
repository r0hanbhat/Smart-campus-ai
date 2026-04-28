import { NextResponse } from 'next/server';
import { buildSubjectAttendancePayload, getSubjectRecordById, getTeacherAssignedSubjects, getUserRoleProfile, listAttendanceRecords, listStudentsByProgram } from '@/lib/server/attendance.js';
import { getAuthenticatedUser } from '@/lib/server/supabase';

function getTodayDateKey() {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

export async function GET(request, context) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params;
        const subjectId = `${id || ''}`.trim();
        if (!subjectId) {
            return NextResponse.json({ error: 'Subject ID is required.' }, { status: 400 });
        }

        const roleProfile = await getUserRoleProfile(supabase, user.id);
        const role = roleProfile?.role || 'student';
        if (!['teacher', 'admin'].includes(role)) {
            return NextResponse.json({ error: 'Teacher or admin access required.' }, { status: 403 });
        }

        // Any teacher/admin can VIEW a class report — no assignment check needed here.
        // The assignment is only enforced when actually MARKING attendance (POST /mark).
        const subjectOffering = await getSubjectRecordById(supabase, subjectId);
        if (!subjectOffering) {
            return NextResponse.json({ error: 'Subject not found.' }, { status: 404 });
        }

        // Decorate with whether this teacher is formally assigned (for UI badge only).
        const assignedSubjects = role === 'teacher'
            ? await getTeacherAssignedSubjects(supabase, user.id).catch(() => [])
            : null;
        const isAssigned = role === 'admin' || !assignedSubjects
            || assignedSubjects.some((s) => s.id === subjectId);

        const selectedDate = new URL(request.url).searchParams.get('date') || getTodayDateKey();
        const [records, students] = await Promise.all([
            listAttendanceRecords(supabase, { subjectId }),
            listStudentsByProgram(supabase, {
                course: subjectOffering?.course || '',
                branch: subjectOffering?.branch || '',
                semester: subjectOffering?.semester || null,
            }),
        ]);

        const report = buildSubjectAttendancePayload(records, students);
        const selectedDateEntries = new Map(records
            .filter((record) => record.date === selectedDate)
            .map((record) => [record.student_id, record]));

        return NextResponse.json({
            subject: {
                id: subjectId,
                name: subjectOffering?.title || subjectOffering?.name || records[0]?.subject_name || subjectId,
                code: subjectOffering?.code || records[0]?.subject_code || '',
                course: subjectOffering?.course || records[0]?.course || '',
                branch: subjectOffering?.branch || records[0]?.branch || '',
                semester: subjectOffering?.semester || records[0]?.semester || null,
                section: subjectOffering?.section || '',
            },
            isAssigned,
            date: selectedDate,
            summary: report.summary,
            studentSummaries: report.students,
            students: students.map((student) => {
                const existingEntry = selectedDateEntries.get(student.id);
                return {
                    id: student.id,
                    userId: student.user_id,
                    name: student.name,
                    rollNumber: student.roll_number,
                    currentStatus: existingEntry?.status || 'present',
                    hasEntry: Boolean(existingEntry),
                };
            }),
        });
    }
    catch (error) {
        console.error('Course Attendance API Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to load course attendance.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
