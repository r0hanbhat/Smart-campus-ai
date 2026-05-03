import { isMissingSchemaTableError } from '@/lib/supabase/schema-compat.js';

export function isTeacherAnnouncementsSchemaMissing(error) {
    return isMissingSchemaTableError(error, 'teacher_announcements');
}

export function mapTeacherAnnouncementRow(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        title: row.subject_name
            ? `Announcement from ${row.teacher_name || 'Teacher'}`
            : 'Teacher announcement',
        message: row.message || '',
        target_role: 'student',
        created_at: row.created_at,
        source: 'teacher_announcement',
        teacherName: row.teacher_name || 'Teacher',
        subjectId: row.subject_id || '',
        subjectName: row.subject_name || 'Subject',
        subjectCode: row.subject_code || '',
        course: row.course || '',
        branch: row.branch || '',
        semester: row.semester || null,
    };
}

export async function listTeacherAnnouncementsForClass(supabase, { course, branch, semester, limit = 30 }) {
    if (!course || !branch || !semester) {
        return [];
    }

    const { data, error } = await supabase
        .from('teacher_announcements')
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
        .eq('course', course)
        .eq('branch', branch)
        .eq('semester', Number(semester))
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        if (isTeacherAnnouncementsSchemaMissing(error)) {
            return [];
        }
        throw new Error(error.message || 'Failed to load teacher announcements.');
    }

    return (data || []).map(mapTeacherAnnouncementRow).filter(Boolean);
}
