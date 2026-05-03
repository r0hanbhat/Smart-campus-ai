'use client';

import { useEffect, useMemo, useState } from 'react';
import { ATTENDANCE_ALERT_THRESHOLD } from '@/lib/smart-campus/attendance.js';

function EmptyState({ title }) {
    return (
        <div className="rounded-[1.2rem] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
            {title}
        </div>
    );
}

function StatCard({ label, value, accentClassName }) {
    return (
        <div className={`rounded-[1.3rem] border p-4 ${accentClassName}`}>
            <div className="text-xs uppercase tracking-[0.18em] text-white/55">{label}</div>
            <div className="mt-3 text-3xl font-bold text-white">{value}</div>
        </div>
    );
}

function getTodayDateKey() {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

// Hard-coded academic structure — courses/branches/semesters are always available
// in the dropdowns regardless of what subjects exist in the database.
const ACADEMIC_STRUCTURE = {
    'B.Tech': {
        branches: ['CSE', 'ECE', 'IT', 'DS', 'EE', 'ENC'],
        semesters: [1, 2, 3, 4, 5, 6, 7, 8],
    },
    'B.Sc': {
        branches: ['CS', 'Physics', 'Mathematics', 'Chemistry', 'Biotechnology'],
        semesters: [1, 2, 3, 4, 5, 6],
    },
    'BCA': {
        branches: ['General'],
        semesters: [1, 2, 3, 4, 5, 6],
    },
    'MCA': {
        branches: ['General'],
        semesters: [1, 2, 3, 4],
    },
    'M.Sc': {
        branches: ['CS', 'Physics', 'Mathematics', 'Chemistry'],
        semesters: [1, 2, 3, 4],
    },
    'MBA': {
        branches: ['General', 'Finance', 'Marketing', 'HR', 'Operations'],
        semesters: [1, 2, 3, 4],
    },
};

const COURSE_LIST = Object.keys(ACADEMIC_STRUCTURE);

export function TeacherAttendancePanel() {
    const [selectedCourse, setSelectedCourse] = useState(COURSE_LIST[0]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('');
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    // assignedSubjects = only this teacher's assigned subjects (drives subject dropdown)
    const [assignedSubjects, setAssignedSubjects] = useState([]);
    // allSubjects from DB = used only for subject dropdown
    const [allSubjects, setAllSubjects] = useState([]);
    const [attendanceDate, setAttendanceDate] = useState(getTodayDateKey);
    const [students, setStudents] = useState([]);
    const [draftStatuses, setDraftStatuses] = useState({});
    const [report, setReport] = useState(null);
    const [loadingAssignments, setLoadingAssignments] = useState(true);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [loadingReport, setLoadingReport] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        let isActive = true;
        const loadAssignments = async () => {
            setLoadingAssignments(true);
            setMessage('');
            const response = await fetch('/api/subjects/teacher', {
                method: 'GET',
                credentials: 'same-origin',
            });
            const payload = await response.json().catch(() => ({ error: 'Failed to load subjects.' }));
            if (!isActive) {
                return;
            }
            if (!response.ok) {
                setAllSubjects([]);
                setAssignedSubjects([]);
                setMessage(payload.error || 'Failed to load subjects.');
                setLoadingAssignments(false);
                return;
            }
            setAllSubjects(Array.isArray(payload.allSubjects) ? payload.allSubjects : []);
            setAssignedSubjects(Array.isArray(payload.assignedSubjects) ? payload.assignedSubjects : []);
            setLoadingAssignments(false);
        };

        void loadAssignments();
        return () => {
            isActive = false;
        };
    }, []);

    // Course/branch/semester options come from the hard-coded ACADEMIC_STRUCTURE
    // so they are always visible regardless of what subjects exist in the DB.
    const courseOptions = COURSE_LIST;
    const effectiveSelectedCourse = courseOptions.includes(selectedCourse) ? selectedCourse : courseOptions[0];
    const branchOptions = ACADEMIC_STRUCTURE[effectiveSelectedCourse]?.branches || [];
    const effectiveSelectedBranch = branchOptions.includes(selectedBranch) ? selectedBranch : (branchOptions[0] || '');
    const semesterNumbers = ACADEMIC_STRUCTURE[effectiveSelectedCourse]?.semesters || [];
    const semesterOptions = semesterNumbers.map(String);
    const effectiveSelectedSemester = semesterOptions.includes(String(selectedSemester)) ? String(selectedSemester) : (semesterOptions[0] || '');

    // Subject options: assigned subjects for this teacher (filtered to current class).
    // If teacher has no assignments yet, fall back to all subjects from DB.
    const subjectPool = assignedSubjects.length > 0 ? assignedSubjects : allSubjects;
    const subjectOptions = subjectPool.filter((e) => e.course === effectiveSelectedCourse
        && e.branch === effectiveSelectedBranch
        && String(e.semester) === effectiveSelectedSemester);
    const effectiveSelectedSubjectId = subjectOptions.some((e) => e.id === selectedSubjectId) ? selectedSubjectId : (subjectOptions[0]?.id || '');
    const selectedSubject = subjectOptions.find((e) => e.id === effectiveSelectedSubjectId) || null;
    const isAssignedSubject = assignedSubjects.some((e) => e.id === effectiveSelectedSubjectId);
    const visibleStudents = effectiveSelectedCourse && effectiveSelectedBranch && effectiveSelectedSemester ? students : [];
    const visibleReport = effectiveSelectedSubjectId ? report : null;

    // Reset draft statuses whenever the active subject or date changes so stale
    // keys from the previous subject / session do not bleed into the new view.
    useEffect(() => {
        const t = setTimeout(() => setDraftStatuses({}), 0);
        return () => clearTimeout(t);
    }, [effectiveSelectedSubjectId, attendanceDate]);

    useEffect(() => {
        if (!effectiveSelectedCourse || !effectiveSelectedBranch || !effectiveSelectedSemester) {
            return;
        }

        let isActive = true;
        const loadStudents = async () => {
            setLoadingStudents(true);
            setMessage('');
            const response = await fetch(`/api/students/by-class?course=${encodeURIComponent(effectiveSelectedCourse)}&branch=${encodeURIComponent(effectiveSelectedBranch)}&semester=${encodeURIComponent(effectiveSelectedSemester)}`, {
                method: 'GET',
                credentials: 'same-origin',
            });
            const payload = await response.json().catch(() => ({ error: 'Failed to load students.' }));
            if (!isActive) {
                return;
            }
            if (!response.ok) {
                setStudents([]);
                setDraftStatuses({});
                setMessage(payload.error || 'Failed to load students.');
                setLoadingStudents(false);
                return;
            }
            const nextStudents = Array.isArray(payload.students) ? payload.students : [];
            setStudents(nextStudents);
            // Initialise new students to 'present'; do NOT override existing draft
            // edits for students that the teacher has already toggled.
            setDraftStatuses((current) => {
                const next = { ...current };
                for (const student of nextStudents) {
                    if (!(student.id in next)) {
                        next[student.id] = 'present';
                    }
                }
                return next;
            });
            setLoadingStudents(false);
        };

        void loadStudents();
        return () => {
            isActive = false;
        };
    }, [effectiveSelectedBranch, effectiveSelectedCourse, effectiveSelectedSemester]);

    useEffect(() => {
        if (!effectiveSelectedSubjectId) {
            return;
        }

        let isActive = true;
        const loadSubjectAttendance = async () => {
            setLoadingReport(true);
            const response = await fetch(`/api/attendance/course/${effectiveSelectedSubjectId}?date=${attendanceDate}`, {
                method: 'GET',
                credentials: 'same-origin',
            });
            const payload = await response.json().catch(() => ({ error: 'Failed to load attendance report.' }));
            if (!isActive) {
                return;
            }
            if (!response.ok) {
                setReport(null);
                setMessage(payload.error || 'Failed to load attendance report.');
                setLoadingReport(false);
                return;
            }
            setReport(payload);
            // Only write statuses from the DB for students that do not already
            // have a draft in state.  This preserves any toggles the teacher
            // made before the report finished loading (e.g. quick date change).
            setDraftStatuses((current) => {
                const next = { ...current };
                for (const student of payload.students || []) {
                    if (!(student.id in next)) {
                        next[student.id] = student.hasEntry ? student.currentStatus : 'present';
                    }
                }
                return next;
            });
            setLoadingReport(false);
        };

        void loadSubjectAttendance();
        return () => {
            isActive = false;
        };
    }, [attendanceDate, effectiveSelectedSubjectId]);

    const handleSave = async () => {
        if (!selectedSubject) {
            return;
        }
        setSaving(true);
        setMessage('');
        const response = await fetch('/api/attendance/mark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                subjectId: selectedSubject.id,
                date: attendanceDate,
                entries: students.map((student) => ({
                    studentId: student.id,
                    status: draftStatuses[student.id] || 'present',
                })),
            }),
        });
        const payload = await response.json().catch(() => ({ error: 'Failed to save attendance.' }));
        if (!response.ok) {
            setMessage(payload.error || 'Failed to save attendance.');
            setSaving(false);
            return;
        }
        setMessage(`Attendance saved for ${payload.markedCount} student${payload.markedCount === 1 ? '' : 's'}.`);
        setSaving(false);
        const refreshResponse = await fetch(`/api/attendance/course/${selectedSubject.id}?date=${attendanceDate}`, {
            method: 'GET',
            credentials: 'same-origin',
        });
        const refreshPayload = await refreshResponse.json().catch(() => null);
        if (refreshResponse.ok && refreshPayload) {
            setReport(refreshPayload);
            // Sync draft statuses with what was actually written to the DB.
            setDraftStatuses(() => {
                const next = {};
                for (const student of refreshPayload.students || []) {
                    next[student.id] = student.hasEntry ? student.currentStatus : 'present';
                }
                return next;
            });
        }
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <select value={effectiveSelectedCourse} onChange={(event) => setSelectedCourse(event.target.value)} className="campus-input rounded-[1rem] px-4 py-3">
                    <option value="">Step 1: Select course</option>
                    {courseOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
                <select value={effectiveSelectedBranch} onChange={(event) => setSelectedBranch(event.target.value)} className="campus-input rounded-[1rem] px-4 py-3" disabled={!effectiveSelectedCourse}>
                    <option value="">Step 2: Select branch</option>
                    {branchOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
                <select value={effectiveSelectedSemester} onChange={(event) => setSelectedSemester(event.target.value)} className="campus-input rounded-[1rem] px-4 py-3" disabled={!effectiveSelectedBranch}>
                    <option value="">Step 3: Select semester</option>
                    {semesterOptions.map((option) => (
                        <option key={option} value={option}>Semester {option}</option>
                    ))}
                </select>
                <select value={effectiveSelectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)} className="campus-input rounded-[1rem] px-4 py-3" disabled={!effectiveSelectedSemester}>
                    <option value="">Step 4: Select subject</option>
                    {subjectOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.title}</option>
                    ))}
                </select>
                <input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} className="campus-input rounded-[1rem] px-4 py-3" />
            </div>

            {selectedSubject ? (
                <div className="rounded-[1.2rem] border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/75">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="font-semibold text-white">{selectedSubject.title}</div>
                            <div className="mt-1">{selectedSubject.code || 'No subject code'} | {selectedSubject.course} | {selectedSubject.branch} | Semester {selectedSubject.semester}</div>
                        </div>
                        {!isAssignedSubject && assignedSubjects.length > 0 && (
                            <div className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                                Not in your assigned subjects
                            </div>
                        )}
                        {isAssignedSubject && (
                            <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                                Assigned to you
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

            {message ? (
                <div className={`rounded-[1rem] border px-4 py-3 text-sm ${message.startsWith('Failed') || message.startsWith('Teacher') ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100'}`}>
                    {message}
                </div>
            ) : null}

            {visibleReport ? (
                <div className="grid gap-4 md:grid-cols-3">
                    <StatCard label="Attendance Rate" value={`${visibleReport.summary?.percentage ?? 0}%`} accentClassName="border-cyan-400/20 bg-cyan-500/10" />
                    <StatCard label="Present Marks" value={visibleReport.summary?.presentSessions ?? 0} accentClassName="border-emerald-400/20 bg-emerald-500/10" />
                    <StatCard label="Absent Marks" value={visibleReport.summary?.absentSessions ?? 0} accentClassName="border-amber-400/20 bg-amber-500/10" />
                </div>
            ) : null}

            {loadingAssignments ? <EmptyState title="Loading subjects..." /> : allSubjects.length === 0 ? <EmptyState title="No subjects found. Run the attendance schema SQL in Supabase first." /> : !effectiveSelectedSubjectId ? <EmptyState title="Select course → branch → semester → subject to load the student list." /> : loadingStudents ? <EmptyState title="Loading enrolled students..." /> : visibleStudents.length === 0 ? <EmptyState title="No students are registered for this class yet. Ask admin to register them." /> : (
                <div className="overflow-hidden rounded-[1.3rem] border border-white/10 bg-white/5">
                    <div className="grid grid-cols-[1fr_1.8fr_auto] gap-3 border-b border-white/10 px-5 py-4 text-xs uppercase tracking-[0.18em] text-white/45">
                        <div>Roll No</div>
                        <div>Name</div>
                        <div>Present / Absent</div>
                    </div>
                    <div className="divide-y divide-white/10">
                        {visibleStudents.map((student) => (
                            <div key={student.id} className="grid grid-cols-[1fr_1.8fr_auto] gap-3 px-5 py-4 text-sm text-white/80">
                                <div className="font-semibold text-white">{student.roll_number}</div>
                                <div>{student.name}</div>
                                <div className="flex overflow-hidden rounded-[0.9rem] border border-white/10">
                                    <button onClick={() => setDraftStatuses((current) => ({ ...current, [student.id]: 'present' }))} className={`px-4 py-2 font-medium ${draftStatuses[student.id] === 'present' ? 'bg-emerald-400 text-slate-950' : 'bg-white/5 text-white/70'}`}>
                                        Present
                                    </button>
                                    <button onClick={() => setDraftStatuses((current) => ({ ...current, [student.id]: 'absent' }))} className={`px-4 py-2 font-medium ${draftStatuses[student.id] === 'absent' ? 'bg-rose-400 text-slate-950' : 'bg-white/5 text-white/70'}`}>
                                        Absent
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <button onClick={() => void handleSave()} disabled={!effectiveSelectedSubjectId || visibleStudents.length === 0 || saving || loadingReport} className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
                    {saving ? 'Submitting...' : `Submit attendance${visibleStudents.length > 0 ? ` (${visibleStudents.length})` : ''}`}
                </button>
                {visibleStudents.length > 0 && (
                    <>
                        <button onClick={() => setDraftStatuses(() => Object.fromEntries(visibleStudents.map(s => [s.id, 'present'])))} className="rounded-[1rem] border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100 hover:bg-emerald-500/20">
                            Mark All Present
                        </button>
                        <button onClick={() => setDraftStatuses(() => Object.fromEntries(visibleStudents.map(s => [s.id, 'absent'])))} className="rounded-[1rem] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100 hover:bg-rose-500/20">
                            Mark All Absent
                        </button>
                    </>
                )}
                <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                    Default is present. Toggle absent students, then submit.
                </div>
            </div>

            {visibleReport?.studentSummaries?.length > 0 ? (
                <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-5">
                    <div className="text-sm font-semibold text-white">Attendance report for this subject</div>
                    <div className="mt-4 space-y-3">
                        {visibleReport.studentSummaries.map((student) => (
                            <div key={student.studentId} className={`rounded-[1rem] border px-4 py-3 text-sm ${student.summary.isBelowThreshold ? 'border-amber-400/25 bg-amber-500/10 text-amber-100' : 'border-white/10 bg-slate-950/25 text-white/80'}`}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="font-semibold text-white">{student.studentName}</div>
                                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/50">{student.rollNumber}</div>
                                    </div>
                                    <div>{student.summary.percentage}% attendance</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export function StudentAttendanceTab({ userId }) {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedSubjectId, setSelectedSubjectId] = useState('');

    useEffect(() => {
        let isActive = true;
        const loadAttendance = async () => {
            setLoading(true);
            setError('');
            const response = await fetch(`/api/attendance/student/${userId}`, {
                method: 'GET',
                credentials: 'same-origin',
            });
            const payload = await response.json().catch(() => ({ error: 'Failed to load attendance.' }));
            if (!isActive) {
                return;
            }
            if (!response.ok) {
                setReport(null);
                setError(payload.error || 'Failed to load attendance.');
                setLoading(false);
                return;
            }
            setReport(payload);
            setLoading(false);
        };

        void loadAttendance();
        return () => {
            isActive = false;
        };
    }, [userId]);

    const selectedSubject = useMemo(() => report?.subjects?.find((subject) => subject.subjectId === selectedSubjectId) || report?.subjects?.[0] || null, [report, selectedSubjectId]);

    return (
        <div className="space-y-6">
            <div className="campus-panel-strong rounded-[2rem] p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="campus-kicker">My Attendance</div>
                        <h2 className="mt-3 text-3xl font-bold text-white">See subject-wise percentage and complete attendance history</h2>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
                            This dashboard shows your attendance percentage for each subject, session-by-session history, and an alert when your attendance drops below the safe threshold.
                        </p>
                    </div>
                    <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/75">
                        Warning threshold: <span className="font-semibold text-white">{ATTENDANCE_ALERT_THRESHOLD}%</span>
                    </div>
                </div>
            </div>

            {error ? (
                <div className="rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {error}
                </div>
            ) : null}

            {!loading && !error && report && report.academicProfile && (report.academicProfile.course || report.academicProfile.branch || report.academicProfile.semester) ? (
                <div className="flex flex-wrap gap-3">
                    {report.academicProfile.course && <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">{report.academicProfile.course}</span>}
                    {report.academicProfile.branch && <span className="rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-1 text-xs text-purple-100">{report.academicProfile.branch}</span>}
                    {report.academicProfile.semester && <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">Semester {report.academicProfile.semester}</span>}
                    {report.academicProfile.rollNumber && <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">{report.academicProfile.rollNumber}</span>}
                </div>
            ) : null}

            {!loading && !error && report && report.subjects?.length === 0 && !report.academicProfile?.course ? (
                <div className="rounded-[1.2rem] border border-amber-400/25 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
                    <div className="font-semibold">Your academic profile is incomplete.</div>
                    <div className="mt-1 text-amber-100/80">Go to Profile and set your Course, Branch, and Semester. Subjects and attendance will auto-load once those fields are saved.</div>
                </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
                <StatCard label="Overall Attendance" value={`${report?.overall?.percentage ?? 0}%`} accentClassName="border-cyan-400/20 bg-cyan-500/10" />
                <StatCard label="Present Classes" value={report?.overall?.presentSessions ?? 0} accentClassName="border-emerald-400/20 bg-emerald-500/10" />
                <StatCard label="Total Classes" value={report?.overall?.totalSessions ?? 0} accentClassName="border-white/10 bg-white/5" />
            </div>

            {report?.overall?.isBelowThreshold ? (
                <div className="rounded-[1.2rem] border border-amber-400/25 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
                    Your overall attendance is below {ATTENDANCE_ALERT_THRESHOLD}%. Attend upcoming classes consistently to recover your percentage.
                </div>
            ) : null}

            {loading ? <EmptyState title="Loading your attendance records..." /> : !report || report.subjects.length === 0 ? <EmptyState title="No mapped subjects were found for your course, branch, and semester yet." /> : (
                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-4">
                        {report.subjects.map((subject) => (
                            <button key={subject.subjectId} onClick={() => setSelectedSubjectId(subject.subjectId)} className={`block w-full rounded-[1.6rem] border p-5 text-left ${subject.summary.isBelowThreshold ? 'border-amber-400/25 bg-amber-500/10' : 'border-white/10 bg-white/5'} ${selectedSubject?.subjectId === subject.subjectId ? 'ring-2 ring-cyan-400/50' : ''}`}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="text-xl font-bold text-white">{subject.subjectName}</div>
                                        <div className="mt-2 text-sm text-white/60">{subject.subjectCode || 'No subject code'} | Semester {subject.semester || '-'} | {subject.branch || 'No branch'}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-3xl font-bold text-white">{subject.summary.percentage}%</div>
                                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Attendance</div>
                                    </div>
                                </div>
                                {subject.summary.isBelowThreshold ? (
                                    <div className="mt-4 rounded-[1rem] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                                        This subject is below {ATTENDANCE_ALERT_THRESHOLD}% attendance.
                                    </div>
                                ) : null}
                            </button>
                        ))}
                    </div>

                    <div className="campus-panel rounded-[1.8rem] p-6">
                        <h3 className="text-xl font-bold text-white">Attendance history</h3>
                        {!selectedSubject ? <div className="mt-5"><EmptyState title="Select a subject to inspect the detailed history." /></div> : (
                            <div className="mt-5 space-y-4">
                                <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                                    <div className="font-semibold text-white">{selectedSubject.subjectName}</div>
                                    <div className="mt-1 text-sm text-white/60">{selectedSubject.subjectCode || 'No subject code'} | {selectedSubject.course || report?.academicProfile?.course || 'No course'} | {selectedSubject.branch || report?.academicProfile?.branch || 'No branch'} | Semester {selectedSubject.semester || report?.academicProfile?.semester || '-'}</div>
                                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                                        <StatCard label="Subject %" value={`${selectedSubject.summary.percentage}%`} accentClassName="border-cyan-400/20 bg-cyan-500/10" />
                                        <StatCard label="Present" value={selectedSubject.summary.presentSessions} accentClassName="border-emerald-400/20 bg-emerald-500/10" />
                                        <StatCard label="Total" value={selectedSubject.summary.totalSessions} accentClassName="border-white/10 bg-white/5" />
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        {selectedSubject.history.length === 0 ? <EmptyState title="No classes recorded yet." /> : selectedSubject.history.map((entry) => (
                                            <div key={entry.id} className="flex items-center justify-between rounded-[0.9rem] border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white/80">
                                                <span>{entry.date}</span>
                                                <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${entry.status === 'present' ? 'bg-emerald-500/20 text-emerald-100' : 'bg-rose-500/20 text-rose-100'}`}>
                                                    {entry.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
