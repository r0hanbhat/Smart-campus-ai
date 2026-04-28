import { NextResponse } from 'next/server';
import { getUserRoleProfile } from '@/lib/server/attendance.js';
import { getAuthenticatedUser } from '@/lib/server/supabase';

// POST /api/subjects/manage — create a subject
export async function POST(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const roleProfile = await getUserRoleProfile(supabase, user.id);
        if (!['teacher', 'admin'].includes(roleProfile?.role)) {
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

        const { error } = await supabase
            .from('subjects')
            .upsert({ id, name, code, course, branch, semester }, { onConflict: 'id' });

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
        if (!['teacher', 'admin'].includes(roleProfile?.role)) {
            return NextResponse.json({ error: 'Teacher or admin access required.' }, { status: 403 });
        }

        const id = new URL(request.url).searchParams.get('id')?.trim() || '';
        if (!id) return NextResponse.json({ error: 'Subject ID is required.' }, { status: 400 });

        const { error } = await supabase.from('subjects').delete().eq('id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Subjects Manage DELETE Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete subject.' }, { status: 500 });
    }
}
