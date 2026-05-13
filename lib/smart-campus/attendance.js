export const ATTENDANCE_STATUS_OPTIONS = ['present', 'absent'];
export const ATTENDANCE_ALERT_THRESHOLD = 75;

export function normalizeAttendanceStatus(status) {
    return `${status || ''}`.trim().toLowerCase() === 'absent' ? 'absent' : 'present';
}

export function dedupeAttendanceEntries(entries) {
    const entryMap = new Map();

    for (const entry of Array.isArray(entries) ? entries : []) {
        const studentId = `${entry?.studentId || entry?.student_id || ''}`.trim();
        if (!studentId) {
            continue;
        }
        entryMap.set(studentId, {
            studentId,
            status: normalizeAttendanceStatus(entry?.status),
        });
    }

    return Array.from(entryMap.values());
}

export function calculateAttendancePercentage(presentCount, totalCount) {
    if (!totalCount) {
        return 0;
    }
    return Math.round((presentCount / totalCount) * 1000) / 10;
}

export function buildAttendanceSummary(records) {
    const normalizedRecords = Array.isArray(records) ? records : [];
    const totalSessions = normalizedRecords.length;
    const presentSessions = normalizedRecords.filter((record) => normalizeAttendanceStatus(record?.status) === 'present').length;
    const absentSessions = totalSessions - presentSessions;
    const percentage = calculateAttendancePercentage(presentSessions, totalSessions);

    return {
        totalSessions,
        presentSessions,
        absentSessions,
        percentage,
        isBelowThreshold: totalSessions > 0 && percentage < ATTENDANCE_ALERT_THRESHOLD,
    };
}

export function buildStudentAttendanceReport(records) {
    return buildStudentAttendanceReportWithSubjects(records, []);
}

export function buildStudentAttendanceReportWithSubjects(records, availableSubjects = []) {
    const groupedBySubject = new Map();

    for (const record of Array.isArray(records) ? records : []) {
        const subjectId = `${record?.subject_id || ''}`.trim();
        if (!subjectId) {
            continue;
        }
        if (!groupedBySubject.has(subjectId)) {
            groupedBySubject.set(subjectId, []);
        }
        groupedBySubject.get(subjectId).push(record);
    }

    const subjectsById = new Map();
    for (const [subjectId, subjectRecords] of groupedBySubject.entries()) {
        const firstRecord = subjectRecords[0] || {};
        const summary = buildAttendanceSummary(subjectRecords);
        const history = [...subjectRecords]
            .sort((left, right) => `${right.date || ''}`.localeCompare(`${left.date || ''}`))
            .map((record) => ({
            id: record.id,
            date: record.date,
            status: normalizeAttendanceStatus(record.status),
        }));

        subjectsById.set(subjectId, {
            subjectId,
            subjectName: firstRecord.subject_name || subjectId,
            subjectCode: firstRecord.subject_code || '',
            course: firstRecord.course || '',
            branch: firstRecord.branch || '',
            semester: firstRecord.semester || null,
            summary,
            history,
        });
    }

    for (const subject of Array.isArray(availableSubjects) ? availableSubjects : []) {
        const subjectId = `${subject?.id || subject?.subject_id || ''}`.trim();
        if (!subjectId || subjectsById.has(subjectId)) {
            continue;
        }
        subjectsById.set(subjectId, {
            subjectId,
            subjectName: subject.name || subject.title || subjectId,
            subjectCode: subject.code || '',
            course: subject.course || '',
            branch: subject.branch || '',
            semester: subject.semester || null,
            summary: buildAttendanceSummary([]),
            history: [],
        });
    }

    const subjects = Array.from(subjectsById.values())
        .sort((left, right) => left.subjectName.localeCompare(right.subjectName));

    // Overall attendance = average of all subject percentages.
    // This ensures subjects with 0 recorded sessions count as 0% instead of
    // being silently excluded from the overall figure.
    const rawOverall = buildAttendanceSummary(Array.isArray(records) ? records : []);
    let overallPercentage = rawOverall.percentage;
    if (subjects.length > 0) {
        const sumOfSubjectPercentages = subjects.reduce((sum, s) => sum + s.summary.percentage, 0);
        overallPercentage = Math.round((sumOfSubjectPercentages / subjects.length) * 10) / 10;
    }

    return {
        overall: {
            ...rawOverall,
            percentage: overallPercentage,
            isBelowThreshold: subjects.length > 0 && overallPercentage < ATTENDANCE_ALERT_THRESHOLD,
        },
        subjects,
    };
}

export function buildSubjectAttendanceReport(records, students = []) {
    const studentDirectory = new Map((Array.isArray(students) ? students : []).map((student) => [
        student.id,
        student,
    ]));
    const groupedByStudent = new Map();

    for (const record of Array.isArray(records) ? records : []) {
        const studentId = `${record?.student_id || ''}`.trim();
        if (!studentId) {
            continue;
        }
        if (!groupedByStudent.has(studentId)) {
            groupedByStudent.set(studentId, []);
        }
        groupedByStudent.get(studentId).push(record);
    }

    const studentSummaries = Array.from(studentDirectory.entries()).map(([studentId, student]) => {
        const studentRecords = groupedByStudent.get(studentId) || [];
        const summary = buildAttendanceSummary(studentRecords);
        return {
            studentId,
            studentName: student.name,
            rollNumber: student.roll_number,
            course: student.course,
            branch: student.branch,
            semester: student.semester,
            summary,
            history: [...studentRecords]
                .sort((left, right) => `${right.date || ''}`.localeCompare(`${left.date || ''}`))
                .map((record) => ({
                id: record.id,
                date: record.date,
                status: normalizeAttendanceStatus(record.status),
            })),
        };
    }).sort((left, right) => left.rollNumber.localeCompare(right.rollNumber));

    return {
        summary: buildAttendanceSummary(Array.isArray(records) ? records : []),
        students: studentSummaries,
    };
}
