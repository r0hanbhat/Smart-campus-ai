import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTENDANCE_ALERT_THRESHOLD, buildStudentAttendanceReport, buildStudentAttendanceReportWithSubjects, buildSubjectAttendanceReport, dedupeAttendanceEntries } from '../lib/smart-campus/attendance.js';

test('dedupeAttendanceEntries keeps the latest status per student', () => {
    const result = dedupeAttendanceEntries([
        { studentId: 'student-1', status: 'present' },
        { studentId: 'student-2', status: 'absent' },
        { studentId: 'student-1', status: 'absent' },
    ]);

    assert.deepEqual(result, [
        { studentId: 'student-1', status: 'absent' },
        { studentId: 'student-2', status: 'absent' },
    ]);
});

test('buildStudentAttendanceReport groups course history and percentage', () => {
    const report = buildStudentAttendanceReport([
        { id: '1', subject_id: 'subject-a', subject_name: 'Data Structures', date: '2026-04-20', status: 'present' },
        { id: '2', subject_id: 'subject-a', subject_name: 'Data Structures', date: '2026-04-22', status: 'absent' },
        { id: '3', subject_id: 'subject-b', subject_name: 'Operating Systems', date: '2026-04-21', status: 'present' },
    ]);

    assert.equal(report.overall.percentage, 66.7);
    assert.equal(report.subjects.length, 2);
    assert.equal(report.subjects[0].subjectName, 'Data Structures');
    assert.equal(report.subjects[0].summary.percentage, 50);
    assert.equal(report.subjects[0].history[0].date, '2026-04-22');
});

test('buildSubjectAttendanceReport includes threshold alerts for low attendance', () => {
    const report = buildSubjectAttendanceReport([
        { id: '1', student_id: 'student-1', date: '2026-04-20', status: 'present' },
        { id: '2', student_id: 'student-1', date: '2026-04-22', status: 'absent' },
        { id: '3', student_id: 'student-2', date: '2026-04-20', status: 'present' },
        { id: '4', student_id: 'student-2', date: '2026-04-22', status: 'present' },
    ], [
        { id: 'student-1', name: 'Aarav', roll_number: '101' },
        { id: 'student-2', name: 'Bhavna', roll_number: '102' },
    ]);

    assert.equal(report.summary.percentage, 75);
    assert.equal(report.students[0].studentName, 'Aarav');
    assert.equal(report.students[0].summary.isBelowThreshold, report.students[0].summary.percentage < ATTENDANCE_ALERT_THRESHOLD);
    assert.equal(report.students[1].summary.percentage, 100);
});

test('buildStudentAttendanceReportWithSubjects preserves mapped subjects even before first class', () => {
    const report = buildStudentAttendanceReportWithSubjects([
        { id: '1', subject_id: 'subject-a', subject_name: 'Data Structures', date: '2026-04-20', status: 'present' },
    ], [
        { id: 'subject-a', name: 'Data Structures', code: 'CS301', course: 'B.Tech', branch: 'CSE', semester: 3 },
        { id: 'subject-b', name: 'Operating Systems', code: 'CS302', course: 'B.Tech', branch: 'CSE', semester: 3 },
    ]);

    assert.equal(report.subjects.length, 2);
    assert.equal(report.subjects[1].subjectName, 'Operating Systems');
    assert.equal(report.subjects[1].summary.percentage, 0);
    assert.deepEqual(report.subjects[1].history, []);
});
