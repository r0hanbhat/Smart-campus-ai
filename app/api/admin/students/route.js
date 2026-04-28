import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { getUserRoleProfile } from '@/lib/server/attendance.js';
import { isMissingSchemaTableError } from '@/lib/supabase/schema-compat.js';

async function assertAdmin(supabase, userId) {
    const profile = await getUserRoleProfile(supabase, userId);
    if (profile?.role !== 'admin') {
        throw Object.assign(new Error('Admin access required.'), { status: 403 });
    }
    return profile;
}

// GET /api/admin/students
// Returns all registered students joined with their profile email.
export async function GET() {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        await assertAdmin(supabase, user.id);

        const { data, error } = await supabase
            .from('students')
            .select(`
                id,
                user_id,
                name,
                roll_number,
                course,
                branch,
                semester,
                created_at,
                profiles:user_id (display_name, full_name, email)
            `)
            .order('roll_number', { ascending: true });

        if (error) {
            if (isMissingSchemaTableError(error, 'students')) {
                return NextResponse.json({ students: [] });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const students = (data || []).map((row) => ({
            id: row.id,
            userId: row.user_id,
            name: row.name,
            rollNumber: row.roll_number,
            course: row.course,
            branch: row.branch,
            semester: row.semester,
            createdAt: row.created_at,
            email: row.profiles?.email || '',
            profileName: row.profiles?.display_name || row.profiles?.full_name || '',
        }));

        // Also return all registered user profiles with student role for the dropdown.
        const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, display_name, full_name, email, roll_number, course, branch, semester')
            .eq('role', 'student')
            .order('display_name', { ascending: true });

        return NextResponse.json({
            students,
            profiles: (profilesData || []).map((p) => ({
                userId: p.user_id,
                name: p.display_name || p.full_name || p.email,
                email: p.email,
                rollNumber: p.roll_number || '',
                course: p.course || '',
                branch: p.branch || '',
                semester: p.semester || null,
            })),
        });
    } catch (error) {
        console.error('Admin Students GET Error:', error);
        const status = error?.status || 500;
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load students.' }, { status });
    }
}

// POST /api/admin/students
// Body: { userId, name, rollNumber, course, branch, semester }
// Creates or updates a student record linking a profile to the students table.
export async function POST(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        await assertAdmin(supabase, user.id);

        const body = await request.json();
        const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        const rollNumber = typeof body?.rollNumber === 'string' ? body.rollNumber.trim() : '';
        const course = typeof body?.course === 'string' ? body.course.trim() : '';
        const branch = typeof body?.branch === 'string' ? body.branch.trim() : '';
        const semesterRaw = body?.semester;
        const semester = semesterRaw !== null && semesterRaw !== undefined ? Number.parseInt(`${semesterRaw}`, 10) : NaN;

        if (!userId || !name || !rollNumber || !course || !branch || Number.isNaN(semester) || semester < 1 || semester > 12) {
            return NextResponse.json({ error: 'userId, name, rollNumber, course, branch, and semester (1–12) are required.' }, { status: 400 });
        }

        // Verify the user exists in profiles.
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, role')
            .eq('user_id', userId)
            .maybeSingle();

        if (profileError || !profile) {
            return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
        }

        // Upsert the student record.
        const { error: upsertError } = await supabase
            .from('students')
            .upsert(
                {
                    user_id: userId,
                    name,
                    roll_number: rollNumber,
                    course,
                    branch,
                    semester,
                },
                { onConflict: 'user_id' }
            );

        if (upsertError) {
            if (isMissingSchemaTableError(upsertError, 'students')) {
                return NextResponse.json({ error: 'Attendance schema is not installed in Supabase yet.' }, { status: 503 });
            }
            // roll_number unique constraint
            if (upsertError.code === '23505') {
                return NextResponse.json({ error: 'That roll number is already assigned to another student.' }, { status: 409 });
            }
            return NextResponse.json({ error: upsertError.message }, { status: 500 });
        }

        // Also mirror course/branch/semester into profiles for consistency.
        await supabase
            .from('profiles')
            .update({ course, branch, semester, roll_number: rollNumber })
            .eq('user_id', userId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Admin Students POST Error:', error);
        const status = error?.status || 500;
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to register student.' }, { status });
    }
}
