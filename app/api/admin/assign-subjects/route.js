import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { getUserRoleProfile, listSubjectsForClass } from '@/lib/server/attendance.js';
import { isMissingSchemaTableError } from '@/lib/supabase/schema-compat.js';

async function assertAdmin(supabase, userId) {
    const profile = await getUserRoleProfile(supabase, userId);
    if (profile?.role !== 'admin') {
        throw Object.assign(new Error('Admin access required.'), { status: 403 });
    }
    return profile;
}

// GET /api/admin/assign-subjects
// Returns all teacher_subjects rows joined with subject + teacher profile data.
export async function GET(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        await assertAdmin(supabase, user.id);

        const params = new URL(request.url).searchParams;
        const teacherId = params.get('teacherId') || '';

        let query = supabase
            .from('teacher_subjects')
            .select(`
                teacher_id,
                subject_id,
                course,
                branch,
                semester,
                assigned_at,
                subjects:subject_id (id, name, code, course, branch, semester, section),
                profiles:teacher_id (user_id, display_name, full_name, email, role)
            `)
            .order('assigned_at', { ascending: false });

        if (teacherId) {
            query = query.eq('teacher_id', teacherId);
        }

        const { data, error } = await query;
        if (error) {
            if (isMissingSchemaTableError(error, 'teacher_subjects')) {
                return NextResponse.json({ assignments: [] });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const assignments = (data || []).map((row) => ({
            teacherId: row.teacher_id,
            subjectId: row.subject_id,
            course: row.course,
            branch: row.branch,
            semester: row.semester,
            assignedAt: row.assigned_at,
            subject: row.subjects
                ? {
                    id: row.subjects.id,
                    name: row.subjects.name,
                    code: row.subjects.code || '',
                    course: row.subjects.course,
                    branch: row.subjects.branch,
                    semester: row.subjects.semester,
                    section: row.subjects.section || '',
                }
                : null,
            teacher: row.profiles
                ? {
                    userId: row.profiles.user_id,
                    name: row.profiles.display_name || row.profiles.full_name || row.profiles.email,
                    email: row.profiles.email,
                    role: row.profiles.role,
                }
                : null,
        }));

        // Also return all subjects and all teachers for the admin UI dropdowns.
        const [subjectsResult, teachersResult] = await Promise.all([
            listSubjectsForClass(supabase, {}).catch(() => []),
            supabase
                .from('profiles')
                .select('user_id, display_name, full_name, email, role')
                .eq('role', 'teacher')
                .order('display_name', { ascending: true })
                .then(({ data: td }) => td || []),
        ]);

        return NextResponse.json({
            assignments,
            subjects: subjectsResult,
            teachers: (teachersResult || []).map((t) => ({
                userId: t.user_id,
                name: t.display_name || t.full_name || t.email,
                email: t.email,
            })),
        });
    } catch (error) {
        console.error('Admin Assign Subjects GET Error:', error);
        const status = error?.status || 500;
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load subject assignments.' }, { status });
    }
}

// POST /api/admin/assign-subjects
// Body: { teacherId, subjectId }
export async function POST(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        await assertAdmin(supabase, user.id);

        const body = await request.json();
        const teacherId = typeof body?.teacherId === 'string' ? body.teacherId.trim() : '';
        const subjectId = typeof body?.subjectId === 'string' ? body.subjectId.trim() : '';

        if (!teacherId || !subjectId) {
            return NextResponse.json({ error: 'teacherId and subjectId are required.' }, { status: 400 });
        }

        // Load the subject to get course/branch/semester for the teacher_subjects row.
        const { data: subject, error: subjectError } = await supabase
            .from('subjects')
            .select('id, course, branch, semester')
            .eq('id', subjectId)
            .maybeSingle();

        if (subjectError || !subject) {
            return NextResponse.json({ error: 'Subject not found.' }, { status: 404 });
        }

        // Verify the teacher profile exists.
        const { data: teacherProfile, error: teacherError } = await supabase
            .from('profiles')
            .select('user_id, role')
            .eq('user_id', teacherId)
            .maybeSingle();

        if (teacherError || !teacherProfile) {
            return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 404 });
        }

        if (!['teacher', 'admin'].includes(teacherProfile.role)) {
            return NextResponse.json({ error: 'The selected user does not have a teacher role.' }, { status: 400 });
        }

        const { error: insertError } = await supabase
            .from('teacher_subjects')
            .upsert(
                {
                    teacher_id: teacherId,
                    subject_id: subjectId,
                    course: subject.course,
                    branch: subject.branch,
                    semester: subject.semester,
                },
                { onConflict: 'teacher_id,subject_id', ignoreDuplicates: false }
            );

        if (insertError) {
            if (isMissingSchemaTableError(insertError, 'teacher_subjects')) {
                return NextResponse.json({ error: 'Attendance schema is not installed in Supabase yet.' }, { status: 503 });
            }
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Admin Assign Subjects POST Error:', error);
        const status = error?.status || 500;
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to assign subject.' }, { status });
    }
}

// DELETE /api/admin/assign-subjects
// Body: { teacherId, subjectId }
export async function DELETE(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        await assertAdmin(supabase, user.id);

        const body = await request.json();
        const teacherId = typeof body?.teacherId === 'string' ? body.teacherId.trim() : '';
        const subjectId = typeof body?.subjectId === 'string' ? body.subjectId.trim() : '';

        if (!teacherId || !subjectId) {
            return NextResponse.json({ error: 'teacherId and subjectId are required.' }, { status: 400 });
        }

        const { error: deleteError } = await supabase
            .from('teacher_subjects')
            .delete()
            .eq('teacher_id', teacherId)
            .eq('subject_id', subjectId);

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Admin Assign Subjects DELETE Error:', error);
        const status = error?.status || 500;
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to remove subject assignment.' }, { status });
    }
}
