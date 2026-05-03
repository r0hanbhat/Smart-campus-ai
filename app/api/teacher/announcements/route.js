import { NextResponse } from 'next/server';
import { assertTeacherSubjectAccess, getUserRoleProfile } from '@/lib/server/attendance.js';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';
import { isTeacherAnnouncementsSchemaMissing, mapTeacherAnnouncementRow } from '@/lib/server/teacher-announcements.js';

function truncate(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength).trimEnd()}...`;
}

export async function POST(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const roleProfile = await getUserRoleProfile(supabase, user.id);
        const metadataRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : '';
        const effectiveRole = roleProfile?.role || metadataRole || 'student';
        if (effectiveRole !== 'teacher') {
            return NextResponse.json({ error: 'Teacher access required.' }, { status: 403 });
        }

        const body = await request.json();
        const subjectId = typeof body?.subjectId === 'string' ? body.subjectId.trim() : '';
        const message = typeof body?.message === 'string' ? body.message.trim() : '';

        if (!subjectId || !message) {
            return NextResponse.json({ error: 'subjectId and message are required.' }, { status: 400 });
        }

        const subject = await assertTeacherSubjectAccess(supabase, user.id, subjectId);
        const teacherName = roleProfile?.full_name || roleProfile?.display_name || roleProfile?.email?.split('@')[0] || 'Teacher';

        const serviceClient = createSupabaseServiceRoleClient();
        const { data: insertedAnnouncement, error: insertError } = await serviceClient
            .from('teacher_announcements')
            .insert({
                subject_id: subject.id,
                subject_name: subject.name,
                subject_code: subject.code || null,
                course: subject.course,
                branch: subject.branch,
                semester: subject.semester,
                teacher_id: user.id,
                teacher_name: teacherName,
                message,
            })
            .select(`
                id,
                subject_id,
                subject_name,
                subject_code,
                course,
                branch,
                semester,
                teacher_id,
                teacher_name,
                message,
                created_at
            `)
            .single();

        if (insertError) {
            if (isTeacherAnnouncementsSchemaMissing(insertError)) {
                return NextResponse.json(
                    { error: 'teacher_announcements table not found. Run teacher_announcements_schema.sql in Supabase SQL Editor first.' },
                    { status: 503 }
                );
            }
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        const { data: studentProfiles, error: studentsError } = await serviceClient
            .from('profiles')
            .select('user_id')
            .eq('role', 'student')
            .eq('course', subject.course)
            .eq('branch', subject.branch)
            .eq('semester', Number(subject.semester));

        if (studentsError) {
            return NextResponse.json({ error: studentsError.message }, { status: 500 });
        }

        const recipientIds = [...new Set((studentProfiles || []).map((profile) => profile.user_id).filter(Boolean))];
        let notificationsCreated = 0;

        if (recipientIds.length > 0) {
            const notificationRows = recipientIds.map((studentId) => ({
                user_id: studentId,
                type: 'teacher_announcement',
                title: `${subject.name}${subject.code ? ` (${subject.code})` : ''}`,
                body: `New announcement from ${teacherName}: ${truncate(message, 140)}`,
                payload: {
                    announcementId: insertedAnnouncement.id,
                    subjectId: subject.id,
                    subjectName: subject.name,
                    subjectCode: subject.code || '',
                    teacherId: user.id,
                    teacherName,
                    course: subject.course,
                    branch: subject.branch,
                    semester: subject.semester,
                },
            }));

            const { error: notificationError } = await serviceClient.from('notifications').insert(notificationRows);
            if (notificationError) {
                if (notificationError.code === '23514') {
                    return NextResponse.json(
                        { error: 'notifications table is missing the teacher_announcement type. Run the chat schema upgrade for teacher announcements first.' },
                        { status: 503 }
                    );
                }
                return NextResponse.json({ error: notificationError.message }, { status: 500 });
            }
            notificationsCreated = notificationRows.length;
        }

        return NextResponse.json({
            success: true,
            announcement: mapTeacherAnnouncementRow(insertedAnnouncement),
            recipientCount: recipientIds.length,
            notificationsCreated,
        });
    } catch (error) {
        console.error('Teacher Announcements POST Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to publish announcement.' },
            { status: 500 }
        );
    }
}
