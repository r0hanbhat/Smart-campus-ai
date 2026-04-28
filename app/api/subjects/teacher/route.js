import { NextResponse } from 'next/server';
import { getTeacherAssignedSubjects, getUserRoleProfile, listSubjectsForClass } from '@/lib/server/attendance.js';
import { getAuthenticatedUser } from '@/lib/server/supabase';

export async function GET(request) {
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

        const params = new URL(request.url).searchParams;
        const filters = {
            course: `${params.get('course') || ''}`.trim(),
            branch: `${params.get('branch') || ''}`.trim(),
            semester: `${params.get('semester') || ''}`.trim(),
        };

        // Load both in parallel:
        // - allSubjects: every subject in the DB (populates course/branch/semester dropdowns)
        // - assignedSubjects: only the subjects this teacher is allowed to mark attendance for
        const [allSubjects, assignedSubjects] = await Promise.all([
            listSubjectsForClass(supabase, {}),
            role === 'admin'
                ? listSubjectsForClass(supabase, filters)
                : getTeacherAssignedSubjects(supabase, user.id, filters),
        ]);

        // Legacy `subjects` key keeps backwards-compat with any older callers.
        return NextResponse.json({ subjects: assignedSubjects, assignedSubjects, allSubjects });
    }
    catch (error) {
        console.error('Teacher Subjects API Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to load teacher subjects.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
