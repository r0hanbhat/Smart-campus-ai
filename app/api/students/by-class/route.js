import { NextResponse } from 'next/server';
import { getUserRoleProfile, listStudentsByProgram } from '@/lib/server/attendance.js';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';

export async function GET(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const roleProfile = await getUserRoleProfile(supabase, user.id);
        if (!['teacher', 'admin'].includes(roleProfile?.role || 'student')) {
            return NextResponse.json({ error: 'Teacher or admin access required.' }, { status: 403 });
        }

        const params = new URL(request.url).searchParams;
        const course = params.get('course')?.trim() || '';
        const branch = params.get('branch')?.trim() || '';
        const semester = params.get('semester')?.trim() || '';

        if (!course || !branch || !semester) {
            return NextResponse.json({ error: 'course, branch, and semester are required.' }, { status: 400 });
        }

        const semesterNum = Number.parseInt(semester, 10);

        // Pull from both sources:
        // 1. students table = canonical attendance roster
        // 2. matching profiles = newly signed-up students not yet mirrored into students
        const [existingStudents, profileQueryResult] = await Promise.all([
            listStudentsByProgram(supabase, {
                course,
                branch,
                semester: semesterNum,
            }),
            supabase
            .from('profiles')
            .select('user_id, display_name, full_name, email, roll_number, course, branch, semester')
            .eq('course', course)
            .eq('branch', branch)
            .eq('semester', semesterNum)
            .order('roll_number', { ascending: true, nullsFirst: false }),
        ]);

        const { data: profileRows, error: profilesError } = profileQueryResult;

        if (profilesError) {
            return NextResponse.json({ error: profilesError.message }, { status: 500 });
        }

        const existingStudentsByUserId = new Map((existingStudents || []).map((student) => [student.user_id, student]));
        const candidateProfiles = (profileRows || []).filter((profileRow) => !existingStudentsByUserId.has(profileRow.user_id));

        if ((existingStudents?.length || 0) === 0 && candidateProfiles.length === 0) {
            return NextResponse.json({ students: [] });
        }

        // Ensure each profile-backed student missing from the students table gets a row.
        // Use the service-role client so this system-level write always succeeds
        // regardless of what RLS policies are on the students table.
        // The auth check above already verified the caller is a teacher/admin.
        const serviceClient = createSupabaseServiceRoleClient();
        const upsertRows = candidateProfiles.map((p) => ({
            user_id: p.user_id,
            name: p.display_name || p.full_name || p.email?.split('@')[0] || 'Student',
            roll_number: p.roll_number || `ROLL-${p.user_id.slice(0, 8).toUpperCase()}`,
            course,
            branch,
            semester: semesterNum,
        }));

        let syncedStudents = existingStudents || [];

        if (upsertRows.length > 0) {
            const { data: studentRows, error: upsertError } = await serviceClient
                .from('students')
                .upsert(upsertRows, { onConflict: 'user_id' })
                .select('id, user_id, name, roll_number, course, branch, semester');

            if (upsertError) {
                console.error('Students upsert error:', upsertError.message, upsertError.code);
                // Only silently fall back when the students table is missing entirely (schema not installed).
                // For any other error surface it so the root cause is visible instead of producing fake IDs.
                const isSchemaMissing = upsertError.code === '42P01'; // relation does not exist
                if (!isSchemaMissing) {
                    return NextResponse.json(
                        { error: `Failed to sync student records: ${upsertError.message}` },
                        { status: 500 }
                    );
                }
                // Schema missing — return profile-based list so UI still renders.
                // Attendance marking will be unavailable until schema is installed.
                const fallback = [...existingStudents, ...candidateProfiles.map((p) => ({
                    id: p.user_id,
                    user_id: p.user_id,
                    name: p.display_name || p.full_name || p.email?.split('@')[0] || 'Student',
                    roll_number: p.roll_number || `ROLL-${p.user_id.slice(0, 8).toUpperCase()}`,
                    course,
                    branch,
                    semester: semesterNum,
                }))];
                const sortedFallback = fallback.sort((a, b) =>
                    `${a.roll_number}`.localeCompare(`${b.roll_number}`)
                );
                return NextResponse.json({ students: sortedFallback, schemaWarning: 'attendance schema not installed' });
            }

            syncedStudents = [...existingStudents, ...(studentRows || [])];
        }

        // Sort by roll number.
        const sorted = syncedStudents.sort((a, b) =>
            `${a.roll_number}`.localeCompare(`${b.roll_number}`)
        );

        return NextResponse.json({ students: sorted });
    }
    catch (error) {
        console.error('Students By Class API Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to load students.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
