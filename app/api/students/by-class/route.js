import { NextResponse } from 'next/server';
import { getUserRoleProfile } from '@/lib/server/attendance.js';
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

        // Pull directly from profiles — any student who has set their academic
        // details in their profile shows up here without any manual registration.
        const { data: profileRows, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, display_name, full_name, email, roll_number, course, branch, semester')
            .eq('role', 'student')
            .eq('course', course)
            .eq('branch', branch)
            .eq('semester', semesterNum)
            .order('roll_number', { ascending: true, nullsFirst: false });

        if (profilesError) {
            return NextResponse.json({ error: profilesError.message }, { status: 500 });
        }

        if (!profileRows || profileRows.length === 0) {
            return NextResponse.json({ students: [] });
        }

        // Ensure each profile student has a row in the students table.
        // Use the service-role client so this system-level write always succeeds
        // regardless of what RLS policies are on the students table.
        // The auth check above already verified the caller is a teacher/admin.
        const serviceClient = createSupabaseServiceRoleClient();
        const upsertRows = profileRows.map((p) => ({
            user_id: p.user_id,
            name: p.display_name || p.full_name || p.email?.split('@')[0] || 'Student',
            roll_number: p.roll_number || `ROLL-${p.user_id.slice(0, 8).toUpperCase()}`,
            course,
            branch,
            semester: semesterNum,
        }));

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
            const fallback = profileRows.map((p) => ({
                id: p.user_id,
                user_id: p.user_id,
                name: p.display_name || p.full_name || p.email?.split('@')[0] || 'Student',
                roll_number: p.roll_number || `ROLL-${p.user_id.slice(0, 8).toUpperCase()}`,
                course,
                branch,
                semester: semesterNum,
            }));
            return NextResponse.json({ students: fallback, schemaWarning: 'attendance schema not installed' });
        }

        // Sort by roll number.
        const sorted = (studentRows || []).sort((a, b) =>
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
