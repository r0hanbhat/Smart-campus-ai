import { NextResponse } from 'next/server';
import { getUserRoleProfile } from '@/lib/server/attendance.js';
import { getAuthenticatedUser } from '@/lib/server/supabase';

// POST /api/subjects/manage — create a subject
export async function POST(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const roleProfile = await getUserRoleProfile(supabase, user.id);
        const metadataRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : '';
        const effectiveRole = roleProfile?.role || metadataRole || 'student';
        if (!['teacher', 'admin'].includes(effectiveRole)) {
            return NextResponse.json({ error: 'Teacher or admin access required.' }, { status: 403 });
        }

        const body = await request.json();
        const id = typeof body?.id === 'string' ? body.id.trim() : '';
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        const code = typeof body?.code === 'string' ? body.code.trim() : '';
        const course = typeof body?.course === 'string' ? body.course.trim() : '';
        const branch = typeof body?.branch === 'string' ? body.branch.trim() : '';
        const semester = body?.semester !== undefined ? Number.parseInt(`${body.semester}`, 10) : NaN;

        if (!id || !name || !code || !course || !branch || Number.isNaN(semester)) {
            return NextResponse.json({ error: 'id, name, code, course, branch, and semester are required.' }, { status: 400 });
        }

        if (effectiveRole === 'teacher') {
            const { data: existingSubject, error: existingSubjectError } = await supabase
                .from('subjects')
                .select('id, teacher_user_id')
                .eq('id', id)
                .maybeSingle();

            if (existingSubjectError) {
                return NextResponse.json({ error: existingSubjectError.message }, { status: 500 });
            }

            if (existingSubject && existingSubject.teacher_user_id !== user.id) {
                return NextResponse.json({ error: 'You can only update subjects you created.' }, { status: 403 });
            }
        }

        const subjectPayload = {
            id,
            name,
            code,
            course,
            branch,
            semester,
            teacher_user_id: effectiveRole === 'teacher' ? user.id : null,
        };

        const { error } = await supabase
            .from('subjects')
            .upsert(subjectPayload, { onConflict: 'id' });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Subjects Manage POST Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save subject.' }, { status: 500 });
    }
}

// DELETE /api/subjects/manage?id=... — remove a subject
export async function DELETE(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const roleProfile = await getUserRoleProfile(supabase, user.id);
        const metadataRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : '';
        const effectiveRole = roleProfile?.role || metadataRole || 'student';
        if (!['teacher', 'admin'].includes(effectiveRole)) {
            return NextResponse.json({ error: 'Teacher or admin access required.' }, { status: 403 });
        }

        const id = new URL(request.url).searchParams.get('id')?.trim() || '';
        if (!id) return NextResponse.json({ error: 'Subject ID is required.' }, { status: 400 });

        let deleteQuery = supabase.from('subjects').delete().eq('id', id);
        if (effectiveRole === 'teacher') {
            deleteQuery = deleteQuery.eq('teacher_user_id', user.id);
        }

        const { error } = await deleteQuery;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Subjects Manage DELETE Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete subject.' }, { status: 500 });
    }
}
