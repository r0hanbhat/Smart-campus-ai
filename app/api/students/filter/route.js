import { NextResponse } from 'next/server';
import { getUserRoleProfile, listStudentsByProgram } from '@/lib/server/attendance.js';
import { getAuthenticatedUser } from '@/lib/server/supabase';

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
        const course = `${params.get('course') || ''}`.trim();
        const branch = `${params.get('branch') || ''}`.trim();
        const semester = `${params.get('semester') || ''}`.trim();

        const students = await listStudentsByProgram(supabase, {
            course,
            branch,
            semester: semester ? Number.parseInt(semester, 10) : null,
        });

        return NextResponse.json({ students });
    }
    catch (error) {
        console.error('Student Filter API Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to load students.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
