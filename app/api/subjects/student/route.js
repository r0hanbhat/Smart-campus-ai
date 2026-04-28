import { NextResponse } from 'next/server';
import { getStudentMappedSubjects, getUserRoleProfile, resolveStudentRecordForUser } from '@/lib/server/attendance.js';
import { getAuthenticatedUser } from '@/lib/server/supabase';

export async function GET() {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Auto-provision: if the profile has course/branch/semester but no students row, create it now.
        try {
            const [profile, existingStudent] = await Promise.all([
                getUserRoleProfile(supabase, user.id),
                resolveStudentRecordForUser(supabase, user.id),
            ]);

            if (!existingStudent && profile?.course && profile?.branch && profile?.semester) {
                const fallbackName = profile.full_name || profile.display_name || profile.email?.split('@')[0] || 'Student';
                const fallbackRoll = profile.roll_number || `ROLL-${user.id.slice(0, 8).toUpperCase()}`;

                await supabase.from('students').upsert(
                    {
                        user_id: user.id,
                        name: fallbackName,
                        roll_number: fallbackRoll,
                        course: profile.course,
                        branch: profile.branch,
                        semester: profile.semester,
                    },
                    { onConflict: 'user_id' }
                );
            }
        } catch {
            // Auto-provision failure is non-fatal; continue to load subjects.
        }

        const { academicProfile, subjects } = await getStudentMappedSubjects(supabase, user.id);
        return NextResponse.json({
            academicProfile,
            subjects,
        });
    }
    catch (error) {
        console.error('Student Subjects API Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to load student subjects.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

