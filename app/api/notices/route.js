import { NextResponse } from 'next/server';
import { getStudentAcademicProfile, getUserRoleProfile } from '@/lib/server/attendance.js';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { listTeacherAnnouncementsForClass } from '@/lib/server/teacher-announcements.js';

export async function GET(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const params = new URL(request.url).searchParams;
        const limit = Math.min(Number(params.get('limit') || 30), 100);
        const roleProfile = await getUserRoleProfile(supabase, user.id);

        // RLS automatically filters to notices matching the user's role or 'all'
        const { data: notices, error } = await supabase
            .from('notices')
            .select('id, title, message, target_role, created_at')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            if (error.code === '42P01') return NextResponse.json({ notices: [] });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const adminNotices = (notices || []).map((notice) => ({
            ...notice,
            source: 'admin',
        }));

        let teacherAnnouncements = [];
        if ((roleProfile?.role || 'student') === 'student') {
            const academicProfile = await getStudentAcademicProfile(supabase, user.id);
            teacherAnnouncements = await listTeacherAnnouncementsForClass(supabase, {
                course: academicProfile?.course || roleProfile?.course || '',
                branch: academicProfile?.branch || roleProfile?.branch || '',
                semester: academicProfile?.semester || roleProfile?.semester || null,
                limit,
            });
        }

        const mergedNotices = [...adminNotices, ...teacherAnnouncements]
            .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
            .slice(0, limit);

        return NextResponse.json({ notices: mergedNotices });
    } catch (error) {
        console.error('Notices GET Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load notices.' }, { status: 500 });
    }
}
