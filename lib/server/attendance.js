import { buildStudentAttendanceReportWithSubjects, buildSubjectAttendanceReport, dedupeAttendanceEntries, normalizeAttendanceStatus } from '@/lib/smart-campus/attendance.js';
import { isMissingSchemaTableError } from '@/lib/supabase/schema-compat.js';

export function isAttendanceSchemaMissing(error) {
    return isMissingSchemaTableError(error, 'attendance')
        || isMissingSchemaTableError(error, 'students')
        || isMissingSchemaTableError(error, 'subjects')
        || isMissingSchemaTableError(error, 'teacher_subjects');
}

export async function getUserRoleProfile(supabase, userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('user_id, role, verification_status, display_name, full_name, email, course, branch, semester, roll_number')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'Failed to load account profile.');
    }

    return data || null;
}

function mapSubjectRow(subject) {
    if (!subject) {
        return null;
    }
    return {
        id: subject.id,
        name: subject.name,
        title: subject.name,
        code: subject.code || '',
        course: subject.course || '',
        branch: subject.branch || '',
        semester: subject.semester || null,
        section: subject.section || '',
    };
}

export async function listSubjectsForClass(supabase, { course, branch, semester }) {
    let query = supabase
        .from('subjects')
        .select('id, name, code, course, branch, semester, section')
        .order('semester', { ascending: true })
        .order('name', { ascending: true });

    if (course) {
        query = query.eq('course', course);
    }
    if (branch) {
        query = query.eq('branch', branch);
    }
    if (semester) {
        query = query.eq('semester', Number(semester));
    }

    const { data, error } = await query;
    if (error) {
        if (isAttendanceSchemaMissing(error)) {
            return [];
        }
        throw new Error(error.message || 'Failed to load subjects.');
    }

    return (data || []).map(mapSubjectRow);
}

export async function getTeacherAssignedSubjects(supabase, userId, filters = {}) {
    let query = supabase
        .from('teacher_subjects')
        .select(`
            teacher_id,
            subject_id,
            course,
            branch,
            semester,
            subjects:subject_id (
                id,
                name,
                code,
                course,
                branch,
                semester,
                section
            )
        `)
        .eq('teacher_id', userId)
        .order('semester', { ascending: true });

    if (filters.course) {
        query = query.eq('course', filters.course);
    }
    if (filters.branch) {
        query = query.eq('branch', filters.branch);
    }
    if (filters.semester) {
        query = query.eq('semester', Number(filters.semester));
    }

    const { data, error } = await query;
    if (error) {
        if (isAttendanceSchemaMissing(error)) {
            return await getTeacherAssignedSubjectsFromSubjectOwner(supabase, userId, filters);
        }
        throw new Error(error.message || 'Failed to load teacher subject assignments.');
    }

    const assignedSubjects = (data || [])
        .map((entry) => {
            const subject = mapSubjectRow(entry.subjects);
            if (!subject) {
                return null;
            }
            return {
                ...subject,
                teacherId: entry.teacher_id,
                subjectId: entry.subject_id,
                course: entry.course || subject.course,
                branch: entry.branch || subject.branch,
                semester: entry.semester || subject.semester,
            };
        })
        .filter(Boolean);

    if (assignedSubjects.length > 0) {
        return assignedSubjects;
    }

    return await getTeacherAssignedSubjectsFromSubjectOwner(supabase, userId, filters);
}

async function getTeacherAssignedSubjectsFromSubjectOwner(supabase, userId, filters = {}) {
    let query = supabase
        .from('subjects')
        .select('id, teacher_user_id, name, code, course, branch, semester, section')
        .eq('teacher_user_id', userId)
        .order('semester', { ascending: true })
        .order('name', { ascending: true });

    if (filters.course) {
        query = query.eq('course', filters.course);
    }
    if (filters.branch) {
        query = query.eq('branch', filters.branch);
    }
    if (filters.semester) {
        query = query.eq('semester', Number(filters.semester));
    }

    const { data, error } = await query;
    if (error) {
        if (isAttendanceSchemaMissing(error) || isMissingSchemaTableError(error, 'subjects')) {
            return [];
        }
        throw new Error(error.message || 'Failed to load teacher subject assignments.');
    }

    return (data || []).map((subject) => ({
        ...mapSubjectRow(subject),
        teacherId: subject.teacher_user_id,
        subjectId: subject.id,
    }));
}

export async function assertTeacherSubjectAccess(supabase, userId, subjectId) {
    const offerings = await getTeacherAssignedSubjects(supabase, userId);
    const offering = offerings.find((entry) => entry.id === subjectId) || null;
    if (!offering) {
        throw new Error('Teacher access is limited to assigned subjects.');
    }
    return offering;
}

export async function getSubjectRecordById(supabase, subjectId) {
    const { data, error } = await supabase
        .from('subjects')
        .select('id, name, code, course, branch, semester, section')
        .eq('id', subjectId)
        .maybeSingle();

    if (error) {
        if (isAttendanceSchemaMissing(error)) {
            return null;
        }
        throw new Error(error.message || 'Failed to load subject.');
    }

    return mapSubjectRow(data);
}

export async function listStudentsByProgram(supabase, { course, branch, semester }) {
    let query = supabase
        .from('students')
        .select('id, user_id, name, roll_number, course, branch, semester')
        .order('roll_number', { ascending: true });

    if (course) {
        query = query.eq('course', course);
    }
    if (branch) {
        query = query.eq('branch', branch);
    }
    if (semester) {
        query = query.eq('semester', Number(semester));
    }

    const { data, error } = await query;
    if (error) {
        if (isAttendanceSchemaMissing(error)) {
            return [];
        }
        throw new Error(error.message || 'Failed to load students.');
    }

    return data || [];
}

export async function resolveStudentRecordForUser(supabase, userId) {
    const { data, error } = await supabase
        .from('students')
        .select('id, user_id, name, roll_number, course, branch, semester')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        if (isAttendanceSchemaMissing(error)) {
            return null;
        }
        throw new Error(error.message || 'Failed to resolve student record.');
    }

    return data || null;
}

export async function getStudentAcademicProfile(supabase, userId) {
    const [profile, studentRecord] = await Promise.all([
        getUserRoleProfile(supabase, userId),
        resolveStudentRecordForUser(supabase, userId),
    ]);

    const course = studentRecord?.course || profile?.course || '';
    const branch = studentRecord?.branch || profile?.branch || '';
    const semester = studentRecord?.semester || profile?.semester || null;
    const rollNumber = studentRecord?.roll_number || profile?.roll_number || '';

    return {
        userId,
        role: profile?.role || 'student',
        name: studentRecord?.name || profile?.full_name || profile?.display_name || '',
        rollNumber,
        course,
        branch,
        semester,
    };
}

export async function getStudentMappedSubjects(supabase, userId) {
    const academicProfile = await getStudentAcademicProfile(supabase, userId);
    if (!academicProfile.course || !academicProfile.branch || !academicProfile.semester) {
        return {
            academicProfile,
            subjects: [],
        };
    }

    const subjects = await listSubjectsForClass(supabase, {
        course: academicProfile.course,
        branch: academicProfile.branch,
        semester: academicProfile.semester,
    });

    return {
        academicProfile,
        subjects,
    };
}

export async function listAttendanceRecords(supabase, filters = {}) {
    let query = supabase
        .from('attendance')
        .select(`
            id,
            student_id,
            subject_id,
            date,
            status,
            marked_by,
            created_at,
            students:student_id (id, name, roll_number, course, branch, semester, user_id),
            subjects:subject_id (id, name, code, course, branch, semester, section)
        `)
        .order('date', { ascending: false });

    if (filters.studentId) {
        query = query.eq('student_id', filters.studentId);
    }
    if (filters.subjectId) {
        query = query.eq('subject_id', filters.subjectId);
    }
    if (filters.date) {
        query = query.eq('date', filters.date);
    }

    const { data, error } = await query;
    if (error) {
        if (isAttendanceSchemaMissing(error)) {
            return [];
        }
        throw new Error(error.message || 'Failed to load attendance records.');
    }

    return (data || []).map((record) => ({
        ...record,
        subject_name: record.subjects?.name || '',
        subject_code: record.subjects?.code || '',
        course: record.subjects?.course || record.students?.course || '',
        branch: record.subjects?.branch || record.students?.branch || '',
        semester: record.subjects?.semester || record.students?.semester || null,
        student_name: record.students?.name || '',
        roll_number: record.students?.roll_number || '',
        student_user_id: record.students?.user_id || '',
    }));
}

export async function markAttendanceRecords(supabase, { teacherUserId, subjectId, date, entries }) {
    const normalizedEntries = dedupeAttendanceEntries(entries);
    if (normalizedEntries.length === 0) {
        throw new Error('At least one student attendance entry is required.');
    }

    const subject = await getSubjectRecordById(supabase, subjectId);
    if (!subject) {
        throw new Error('Subject not found for attendance marking.');
    }

    const studentIds = normalizedEntries.map((entry) => entry.studentId);
    const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, course, branch, semester')
        .in('id', studentIds);

    if (studentsError) {
        if (isAttendanceSchemaMissing(studentsError)) {
            const missingSchemaError = new Error('Attendance is not available until the attendance schema is installed in Supabase.');
            missingSchemaError.code = 'ATTENDANCE_SCHEMA_MISSING';
            throw missingSchemaError;
        }
        // Non-fatal — proceed without strict validation if students table is inaccessible.
    }

    // Only validate students we could find — profile-based students are auto-upserted
    // by the by-class route before the teacher submits, so they will be present.
    // Skip unknown entries rather than failing the whole batch.
    const studentDirectory = new Map((students || []).map((student) => [student.id, student]));
    const validatedEntries = normalizedEntries.filter((entry) => {
        const student = studentDirectory.get(entry.studentId);
        if (!student) return true; // allow — auto-provisioned student, trust the by-class route
        // Validate class membership with normalised comparisons so minor
        // whitespace / casing differences never silently drop entries.
        const normalise = (v) => `${v || ''}`.trim().toLowerCase();
        return normalise(student.course) === normalise(subject.course)
            && normalise(student.branch) === normalise(subject.branch)
            && Number(student.semester) === Number(subject.semester);
    });

    const rows = validatedEntries.map((entry) => ({
        student_id: entry.studentId,
        subject_id: subjectId,
        date,
        status: normalizeAttendanceStatus(entry.status),
        marked_by: teacherUserId,
    }));

    const { error } = await supabase
        .from('attendance')
        .upsert(rows, { onConflict: 'student_id,subject_id,date' });

    if (error) {
        if (isAttendanceSchemaMissing(error)) {
            const missingSchemaError = new Error('Attendance is not available until the attendance schema is installed in Supabase.');
            missingSchemaError.code = 'ATTENDANCE_SCHEMA_MISSING';
            throw missingSchemaError;
        }
        throw new Error(error.message || 'Failed to mark attendance.');
    }

    return rows.length;
}

export function buildStudentAttendancePayload(records, subjects = []) {
    return buildStudentAttendanceReportWithSubjects(records, subjects);
}

export function buildSubjectAttendancePayload(records, students) {
    return buildSubjectAttendanceReport(records, students);
}
