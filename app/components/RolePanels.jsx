'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminIssueManagementPanel from './AdminIssueManagementPanel.jsx';
import AdminKnowledgePanel from './AdminKnowledgePanel.jsx';
import AdminNoticePanel from './AdminNoticePanel.jsx';
import AdminEventApprovalPanel from './AdminEventApprovalPanel.jsx';
import { TeacherAttendancePanel } from './AttendancePanels.jsx';
import CoordinatorEventPanel from './CoordinatorEventPanel.jsx';
import JcufaChatPanel from './JcufaChatPanel.jsx';
import NoticeBoard from './NoticeBoard.jsx';

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function PanelCard({ title, description, children, action }) {
    return (
        <div className="campus-panel rounded-[1.7rem] p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <p className="mt-1 text-sm text-white/60">{description}</p>
                </div>
                {action}
            </div>
            <div className="mt-5">{children}</div>
        </div>
    );
}

function EmptyState({ title }) {
    return (
        <div className="rounded-[1.2rem] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
            {title}
        </div>
    );
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Unable to read the uploaded file.'));
        reader.readAsDataURL(file);
    });
}

export function TeacherPendingPanel({ profile, request, onSignOut, onSubmitRequest, requestLoading = false, requestError = '' }) {
    const profileVerificationStatus = profile?.verification_status || '';
    const requestStatus = profileVerificationStatus === 'approved' ? 'approved' : request?.status || profileVerificationStatus || 'pending';
    const isRejected = requestStatus === 'rejected';
    const isApproved = requestStatus === 'approved';
    const submittedAt = request?.created_at ? new Date(request.created_at).toLocaleString() : null;
    const reviewedAt = request?.reviewed_at ? new Date(request.reviewed_at).toLocaleString() : null;
    const hasRealRequest = Boolean(request?.id);
    const [manualPhoneNumber, setManualPhoneNumber] = useState(() => request?.phone_number || profile?.phone_number || '');
    const [manualEmployeeId, setManualEmployeeId] = useState(() => request?.employee_id || profile?.employee_id || '');
    const [manualImageData, setManualImageData] = useState(() => request?.employee_id_image_data || '');
    const [manualImageName, setManualImageName] = useState(() => request?.employee_id_image_name || '');
    const [manualFormMessage, setManualFormMessage] = useState('');

    const handleManualImageUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        try {
            const dataUrl = await readFileAsDataUrl(file);
            setManualImageData(dataUrl);
            setManualImageName(file.name);
            setManualFormMessage('');
        }
        catch (error) {
            setManualFormMessage(error instanceof Error ? error.message : 'Failed to process the uploaded ID image.');
        }
    };

    const handleManualSubmit = async () => {
        setManualFormMessage('');
        if (!manualPhoneNumber.trim() || !manualEmployeeId.trim() || !manualImageData) {
            setManualFormMessage('Enter phone number, employee ID, and upload the employee ID image before submitting.');
            return;
        }
        const didSubmit = await onSubmitRequest?.({
            phoneNumber: manualPhoneNumber,
            employeeId: manualEmployeeId,
            employeeIdImageData: manualImageData,
            employeeIdImageName: manualImageName,
        });
        if (didSubmit) {
            setManualFormMessage('Teacher verification request submitted. Ask the admin to refresh the portal.');
        }
    };

    return (
        <div className="campus-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl space-y-6">
                <div className="campus-panel-strong rounded-[2rem] p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="campus-kicker">Teacher Access Review</div>
                            <h1 className="mt-3 text-3xl font-bold text-white">
                                {isApproved
                                    ? 'Your teacher access has already been approved'
                                    : isRejected
                                        ? 'Your teacher access request needs an update'
                                        : 'Your teacher panel is waiting for admin verification'}
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/65">
                                {isApproved
                                    ? 'Admin approval is already recorded for this account. If this screen still appears, refresh the portal and your teacher dashboard should open without another submission.'
                                    : isRejected
                                    ? 'An admin reviewed your request and left feedback below. Update the signup details in Supabase and submit a fresh request so the teacher tools can be unlocked.'
                                    : 'We received your email, phone number, employee ID, and ID image. An admin reviews teacher requests within 24 hours before course tools are unlocked.'}
                            </p>
                        </div>
                        <button onClick={onSignOut} className="rounded-full border border-red-300/20 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-100 transition hover:bg-red-500/20">
                            Logout
                        </button>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <div className="campus-panel rounded-[1.7rem] p-6">
                        <div className="text-xs uppercase tracking-[0.2em] text-white/45">Status</div>
                        <div className="mt-3 text-2xl font-bold capitalize text-white">{requestStatus}</div>
                    </div>
                    <div className="campus-panel rounded-[1.7rem] p-6">
                        <div className="text-xs uppercase tracking-[0.2em] text-white/45">Employee ID</div>
                        <div className="mt-3 text-2xl font-bold text-white">{profile?.employee_id || request?.employee_id || 'Pending'}</div>
                    </div>
                    <div className="campus-panel rounded-[1.7rem] p-6">
                        <div className="text-xs uppercase tracking-[0.2em] text-white/45">Phone Verification</div>
                        <div className="mt-3 text-2xl font-bold text-white">{profile?.phone_verified ? 'Verified' : 'Pending'}</div>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <PanelCard
                        title="Submitted Verification Details"
                        description="This panel shows the actual teacher verification request stored in Supabase."
                        action={isApproved ? null : <button onClick={() => void onSubmitRequest?.()} disabled={requestLoading} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">
                            {requestLoading ? 'Submitting...' : hasRealRequest ? 'Re-submit request' : 'Submit request now'}
                        </button>}
                    >
                        <div className="space-y-3 text-sm text-white/75">
                            <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">Email: {request?.email || profile?.email || 'Not available'}</div>
                            <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">Phone: {request?.phone_number || profile?.phone_number || 'Not provided'}</div>
                            <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">Employee ID: {request?.employee_id || profile?.employee_id || 'Pending'}</div>
                            <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">Submission state: {hasRealRequest ? 'Saved in Supabase' : 'Not saved yet'}</div>
                            <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">Submitted: {submittedAt || 'Waiting for first successful submission'}</div>
                            {reviewedAt ? (
                                <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">Reviewed: {reviewedAt}</div>
                            ) : null}
                            {requestError ? (
                                <div className="rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100">
                                    {requestError}
                                </div>
                            ) : null}
                        </div>
                    </PanelCard>

                    <PanelCard
                        title="Uploaded Employee ID"
                        description="Admins use this image to confirm the request before unlocking the full teacher dashboard."
                    >
                        {manualImageData || request?.employee_id_image_data ? (
                            <Image
                                src={manualImageData || request?.employee_id_image_data}
                                alt="Teacher verification document"
                                width={1200}
                                height={800}
                                unoptimized
                                className="w-full rounded-[1.2rem] border border-white/10 bg-white/5 object-contain"
                            />
                        ) : (
                            <EmptyState title="No uploaded employee ID image found for this account yet." />
                        )}
                    </PanelCard>
                </div>

                {isApproved ? null : (
                    <PanelCard
                        title="Recover Missing Submission"
                        description="If your old signup did not keep the verification payload, enter it here and submit it directly to Supabase."
                        action={<button onClick={() => void handleManualSubmit()} disabled={requestLoading} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">
                            {requestLoading ? 'Submitting...' : 'Submit to admin queue'}
                        </button>}
                    >
                        <div className="grid gap-3 md:grid-cols-2">
                            <input value={manualPhoneNumber} onChange={(event) => setManualPhoneNumber(event.target.value)} placeholder="Phone number" className="campus-input rounded-[1rem] px-4 py-3" />
                            <input value={manualEmployeeId} onChange={(event) => setManualEmployeeId(event.target.value)} placeholder="Employee ID" className="campus-input rounded-[1rem] px-4 py-3" />
                        </div>
                        <div className="mt-4">
                            <input type="file" accept="image/*" onChange={handleManualImageUpload} className="block w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white" />
                            <div className="mt-2 text-xs text-white/55">
                                {manualImageName ? `Uploaded: ${manualImageName}` : 'Upload the employee ID image used for verification.'}
                            </div>
                        </div>
                        {manualFormMessage ? (
                            <div className="mt-4 rounded-[1rem] border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                                {manualFormMessage}
                            </div>
                        ) : null}
                    </PanelCard>
                )}

                <PanelCard
                        title="What Happens Next"
                        description="Admins can review the uploaded ID image, approve or reject the request, and notify you automatically."
                >
                    <div className="space-y-3 text-sm text-white/75">
                        <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">{isApproved ? '1. Admin approval is already saved for this account.' : isRejected ? '1. Review the admin note and correct the teacher verification details.' : '1. Your request stays in the admin verification queue.'}</div>
                        <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">{isApproved ? '2. Refresh or sign in again to open the teacher dashboard if this page is still cached.' : isRejected ? '2. Re-submit the corrected request with a valid employee ID image and phone details.' : '2. The admin checks the employee ID, email, and phone verification details.'}</div>
                        <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">{isApproved ? '3. The teacher panel should open without showing a re-submit action.' : isRejected ? '3. After approval, your teacher panel unlocks course, assignment, lesson planning, and student tracking tools.' : '3. Once approved, your teacher panel unlocks course, assignment, lesson planning, and student tracking tools.'}</div>
                        {request?.review_notes ? (
                            <div className="rounded-[1rem] border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-amber-100">
                                Latest review note: {request.review_notes}
                            </div>
                        ) : null}
                    </div>
                </PanelCard>
            </div>
        </div>
    );
}

export function TeacherDashboard({ displayName, profile, teacherWorkspace, setTeacherWorkspace, onSignOut, verificationStatus = 'approved' }) {
    // Academic structure for cascading dropdowns (same as attendance panel)
    const ACADEMIC_STRUCTURE = {
        'B.Tech': { branches: ['CSE', 'ECE', 'IT', 'DS', 'EE', 'ENC'], semesters: [1,2,3,4,5,6,7,8] },
        'B.Sc':   { branches: ['CS', 'Physics', 'Mathematics', 'Chemistry', 'Biotechnology'], semesters: [1,2,3,4,5,6] },
        'BCA':    { branches: ['General'], semesters: [1,2,3,4,5,6] },
        'MCA':    { branches: ['General'], semesters: [1,2,3,4] },
        'M.Sc':   { branches: ['CS', 'Physics', 'Mathematics', 'Chemistry'], semesters: [1,2,3,4] },
        'MBA':    { branches: ['General', 'Finance', 'Marketing', 'HR', 'Operations'], semesters: [1,2,3,4] },
    };
    const COURSE_LIST = Object.keys(ACADEMIC_STRUCTURE);

    const [courseForm, setCourseForm] = useState({ course: COURSE_LIST[0], branch: '', semester: '', title: '', code: '' });
    const [subjectSaveMsg, setSubjectSaveMsg] = useState('');
    const [subjectSaveError, setSubjectSaveError] = useState('');
    const [dbSubjects, setDbSubjects] = useState([]);
    const [loadingDbSubjects, setLoadingDbSubjects] = useState(false);

    // Cascading branch/semester options
    const cfBranchOptions = ACADEMIC_STRUCTURE[courseForm.course]?.branches || [];
    const cfBranch = cfBranchOptions.includes(courseForm.branch) ? courseForm.branch : (cfBranchOptions[0] || '');
    const cfSemesterOptions = ACADEMIC_STRUCTURE[courseForm.course]?.semesters || [];
    const cfSemester = cfSemesterOptions.includes(Number(courseForm.semester)) ? Number(courseForm.semester) : (cfSemesterOptions[0] || '');

    const loadDbSubjects = useCallback(async () => {
        if (!courseForm.course || !cfBranch || !cfSemester) return;
        setLoadingDbSubjects(true);
        const res = await fetch(`/api/subjects/teacher?course=${encodeURIComponent(courseForm.course)}&branch=${encodeURIComponent(cfBranch)}&semester=${cfSemester}`, { credentials: 'same-origin' });
        const payload = await res.json().catch(() => ({}));
        setDbSubjects(Array.isArray(payload.allSubjects) ? payload.allSubjects.filter(s => s.course === courseForm.course && s.branch === cfBranch && String(s.semester) === String(cfSemester)) : []);
        setLoadingDbSubjects(false);
    }, [courseForm.course, cfBranch, cfSemester]);

    useEffect(() => { void loadDbSubjects(); }, [loadDbSubjects]);

    const handleAddSubject = async () => {
        setSubjectSaveMsg(''); setSubjectSaveError('');
        if (!courseForm.title.trim() || !courseForm.code.trim()) {
            setSubjectSaveError('Subject name and code are required.');
            return;
        }
        const subjectId = `${courseForm.course}-${cfBranch}-sem${cfSemester}-${courseForm.code}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const res = await fetch('/api/subjects/manage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ id: subjectId, name: courseForm.title.trim(), code: courseForm.code.trim(), course: courseForm.course, branch: cfBranch, semester: cfSemester }),
        });
        const payload = await res.json().catch(() => ({}));
        if (res.ok) {
            setSubjectSaveMsg(`Subject "${courseForm.title}" added successfully.`);
            setCourseForm(f => ({ ...f, title: '', code: '' }));
            void loadDbSubjects();
        } else {
            setSubjectSaveError(payload.error || 'Failed to save subject.');
        }
    };

    const handleDeleteSubject = async (subjectId) => {
        const res = await fetch(`/api/subjects/manage?id=${encodeURIComponent(subjectId)}`, { method: 'DELETE', credentials: 'same-origin' });
        if (res.ok) void loadDbSubjects();
    };

    const [announcementForm, setAnnouncementForm] = useState({ courseId: '', text: '' });
    const [assignmentForm, setAssignmentForm] = useState({ courseId: '', title: '', dueDate: '', gradeWeight: '' });
    const [studentForm, setStudentForm] = useState({ courseId: '', name: '', progress: '' });
    const [lessonForm, setLessonForm] = useState({ date: '', topic: '', courseId: '' });
    const [messageForm, setMessageForm] = useState({ recipient: '', subject: '', message: '' });

    const courses = teacherWorkspace?.courses || [];
    const announcements = teacherWorkspace?.announcements || [];
    const assignments = teacherWorkspace?.assignments || [];
    const students = teacherWorkspace?.students || [];
    const lessonPlans = teacherWorkspace?.lessonPlans || [];
    const communications = teacherWorkspace?.communications || [];

    const totalPendingGrades = assignments.filter((assignment) => assignment.status !== 'graded').length;
    const averageProgress = students.length > 0
        ? Math.round(students.reduce((sum, student) => sum + Number(student.progress || 0), 0) / students.length)
        : 0;

    const selectedCourseName = (courseId) => {
        const course = courses.find((entry) => entry.id === courseId);
        if (!course) {
            return 'General';
        }
        return `${course.title} | ${course.course} | ${course.branch} | Sem ${course.semester}`;
    };

    const saveWorkspace = (updater) => {
        setTeacherWorkspace((current) => updater(current || {
            courses: [],
            announcements: [],
            assignments: [],
            students: [],
            lessonPlans: [],
            communications: [],
        }));
    };

    return (
        <div className="campus-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <div className="campus-panel-strong rounded-[2rem] p-8">
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                            <div className="campus-kicker">Teacher Panel</div>
                            <h1 className="mt-3 text-3xl font-bold text-white">Manage courses, teaching flow, and student momentum from one place</h1>
                            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
                                Welcome back, {displayName}. Your teacher account is approved, so course management, announcements, grading, lesson planning, and communication tools are all live.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <div className="campus-panel rounded-[1.3rem] px-4 py-3 text-sm text-white/80">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Role</div>
                                <div className="mt-1 text-white">{profile?.role || 'teacher'}</div>
                                <div className="capitalize text-white/60">{verificationStatus}</div>
                            </div>
                            <button onClick={onSignOut} className="rounded-full border border-red-300/20 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-100 transition hover:bg-red-500/20">
                                Logout
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    <div className="campus-panel rounded-[1.5rem] p-5">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Courses</div>
                        <div className="mt-3 text-3xl font-bold text-white">{courses.length}</div>
                    </div>
                    <div className="campus-panel rounded-[1.5rem] p-5">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Announcements</div>
                        <div className="mt-3 text-3xl font-bold text-white">{announcements.length}</div>
                    </div>
                    <div className="campus-panel rounded-[1.5rem] p-5">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Pending Grades</div>
                        <div className="mt-3 text-3xl font-bold text-white">{totalPendingGrades}</div>
                    </div>
                    <div className="campus-panel rounded-[1.5rem] p-5">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Student Progress</div>
                        <div className="mt-3 text-3xl font-bold text-white">{averageProgress}%</div>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <PanelCard
                        title="Course Management"
                        description="Add subjects for a specific course, branch, and semester. They appear immediately in the teacher attendance panel and student attendance tab."
                        action={<button onClick={() => void loadDbSubjects()} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white">Refresh</button>}
                    >
                        {/* Cascading filters */}
                        <div className="grid gap-3 md:grid-cols-3">
                            <div>
                                <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/45">Course</div>
                                <select value={courseForm.course} onChange={e => setCourseForm(f => ({ ...f, course: e.target.value, branch: '', semester: '' }))} className="campus-input w-full rounded-[1rem] px-4 py-3">
                                    {COURSE_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/45">Branch</div>
                                <select value={cfBranch} onChange={e => setCourseForm(f => ({ ...f, branch: e.target.value }))} className="campus-input w-full rounded-[1rem] px-4 py-3">
                                    {cfBranchOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                            <div>
                                <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/45">Semester</div>
                                <select value={cfSemester} onChange={e => setCourseForm(f => ({ ...f, semester: e.target.value }))} className="campus-input w-full rounded-[1rem] px-4 py-3">
                                    {cfSemesterOptions.map(s => <option key={s} value={s}>Semester {s}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Subject entry */}
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <input value={courseForm.title} onChange={e => setCourseForm(f => ({ ...f, title: e.target.value }))} placeholder="Subject name (e.g. Data Structures)" className="campus-input rounded-[1rem] px-4 py-3" />
                            <input value={courseForm.code} onChange={e => setCourseForm(f => ({ ...f, code: e.target.value }))} placeholder="Subject code (e.g. CS201)" className="campus-input rounded-[1rem] px-4 py-3" />
                        </div>
                        <button onClick={() => void handleAddSubject()} disabled={!courseForm.title.trim() || !courseForm.code.trim()} className="mt-3 rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
                            Add subject to {courseForm.course} {cfBranch} Sem {cfSemester}
                        </button>
                        {subjectSaveMsg && <div className="mt-2 rounded-[1rem] border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">{subjectSaveMsg}</div>}
                        {subjectSaveError && <div className="mt-2 rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{subjectSaveError}</div>}

                        {/* Existing subjects for selected class */}
                        <div className="mt-5">
                            <div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/45">{courseForm.course} · {cfBranch} · Semester {cfSemester}</div>
                            {loadingDbSubjects ? <EmptyState title="Loading subjects..." /> : dbSubjects.length === 0 ? <EmptyState title="No subjects added yet for this class. Add one above." /> : (
                                <div className="space-y-2">
                                    {dbSubjects.map(s => (
                                        <div key={s.id} className="flex items-center justify-between gap-3 rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                                            <div>
                                                <span className="font-semibold text-white">{s.name || s.title}</span>
                                                <span className="ml-3 text-white/50">{s.code}</span>
                                            </div>
                                            <button onClick={() => void handleDeleteSubject(s.id)} className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs text-red-200 hover:bg-red-500/20">Remove</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </PanelCard>

                    <PanelCard title="Announcements" description="Send quick updates so students know what changed before class starts.">
                        <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
                            <select value={announcementForm.courseId} onChange={(event) => setAnnouncementForm((current) => ({ ...current, courseId: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                                <option value="">General</option>
                                {courses.map((course) => (
                                    <option key={course.id} value={course.id}>{course.title}</option>
                                ))}
                            </select>
                            <input value={announcementForm.text} onChange={(event) => setAnnouncementForm((current) => ({ ...current, text: event.target.value }))} placeholder="Announcement" className="campus-input rounded-[1rem] px-4 py-3" />
                        </div>
                        <button
                            onClick={() => {
                                if (!announcementForm.text.trim()) {
                                    return;
                                }
                                saveWorkspace((current) => ({
                                    ...current,
                                    announcements: [
                                        {
                                            id: createId('announcement'),
                                            courseId: announcementForm.courseId,
                                            text: announcementForm.text.trim(),
                                            createdAt: new Date().toISOString(),
                                        },
                                        ...current.announcements,
                                    ],
                                }));
                                setAnnouncementForm({ courseId: '', text: '' });
                            }}
                            className="mt-4 rounded-[1rem] border border-white/10 bg-white/10 px-5 py-3 text-sm font-medium text-white"
                        >
                            Publish announcement
                        </button>
                        <div className="mt-5 space-y-3">
                            {announcements.length === 0 ? <EmptyState title="No announcements yet." /> : announcements.map((announcement) => (
                                <div key={announcement.id} className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                                    <div className="font-semibold text-white">{selectedCourseName(announcement.courseId)}</div>
                                    <div className="mt-2">{announcement.text}</div>
                                </div>
                            ))}
                        </div>
                    </PanelCard>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <PanelCard title="Assignment Creation And Grading" description="Track open assignments and mark them graded as reviews finish.">
                        <div className="grid gap-3 md:grid-cols-2">
                            <select value={assignmentForm.courseId} onChange={(event) => setAssignmentForm((current) => ({ ...current, courseId: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                                <option value="">Select course</option>
                                {courses.map((course) => (
                                    <option key={course.id} value={course.id}>{course.title}</option>
                                ))}
                            </select>
                            <input value={assignmentForm.title} onChange={(event) => setAssignmentForm((current) => ({ ...current, title: event.target.value }))} placeholder="Assignment title" className="campus-input rounded-[1rem] px-4 py-3" />
                            <input type="date" value={assignmentForm.dueDate} onChange={(event) => setAssignmentForm((current) => ({ ...current, dueDate: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3" />
                            <input value={assignmentForm.gradeWeight} onChange={(event) => setAssignmentForm((current) => ({ ...current, gradeWeight: event.target.value }))} placeholder="Weight %" className="campus-input rounded-[1rem] px-4 py-3" />
                        </div>
                        <button
                            onClick={() => {
                                if (!assignmentForm.title.trim() || !assignmentForm.courseId || !assignmentForm.dueDate) {
                                    return;
                                }
                                saveWorkspace((current) => ({
                                    ...current,
                                    assignments: [
                                        ...current.assignments,
                                        {
                                            id: createId('assignment'),
                                            courseId: assignmentForm.courseId,
                                            title: assignmentForm.title.trim(),
                                            dueDate: assignmentForm.dueDate,
                                            gradeWeight: assignmentForm.gradeWeight.trim() || '10',
                                            status: 'open',
                                        },
                                    ],
                                }));
                                setAssignmentForm({ courseId: '', title: '', dueDate: '', gradeWeight: '' });
                            }}
                            className="mt-4 rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950"
                        >
                            Create assignment
                        </button>
                        <div className="mt-5 space-y-3">
                            {assignments.length === 0 ? <EmptyState title="No assignments created yet." /> : assignments.map((assignment) => (
                                <div key={assignment.id} className="rounded-[1rem] border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="font-semibold text-white">{assignment.title}</div>
                                            <div className="mt-1">{selectedCourseName(assignment.courseId)} • Due {assignment.dueDate}</div>
                                        </div>
                                        <button
                                            onClick={() => saveWorkspace((current) => ({
                                                ...current,
                                                assignments: current.assignments.map((item) => item.id === assignment.id
                                                    ? { ...item, status: item.status === 'graded' ? 'open' : 'graded' }
                                                    : item),
                                            }))}
                                            className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] ${assignment.status === 'graded' ? 'bg-emerald-500/20 text-emerald-100' : 'bg-white/10 text-white'}`}
                                        >
                                            {assignment.status === 'graded' ? 'Graded' : 'Mark graded'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </PanelCard>

                    <PanelCard title="Student Tracking And Progress" description="Keep a simple progress view for students who need follow-up.">
                        <div className="grid gap-3 md:grid-cols-3">
                            <select value={studentForm.courseId} onChange={(event) => setStudentForm((current) => ({ ...current, courseId: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                                <option value="">Select course</option>
                                {courses.map((course) => (
                                    <option key={course.id} value={course.id}>{course.title}</option>
                                ))}
                            </select>
                            <input value={studentForm.name} onChange={(event) => setStudentForm((current) => ({ ...current, name: event.target.value }))} placeholder="Student name" className="campus-input rounded-[1rem] px-4 py-3" />
                            <input type="number" min="0" max="100" value={studentForm.progress} onChange={(event) => setStudentForm((current) => ({ ...current, progress: event.target.value }))} placeholder="Progress %" className="campus-input rounded-[1rem] px-4 py-3" />
                        </div>
                        <button
                            onClick={() => {
                                if (!studentForm.courseId || !studentForm.name.trim()) {
                                    return;
                                }
                                saveWorkspace((current) => ({
                                    ...current,
                                    students: [
                                        ...current.students,
                                        {
                                            id: createId('student'),
                                            courseId: studentForm.courseId,
                                            name: studentForm.name.trim(),
                                            progress: Number(studentForm.progress || 0),
                                        },
                                    ],
                                }));
                                setStudentForm({ courseId: '', name: '', progress: '' });
                            }}
                            className="mt-4 rounded-[1rem] border border-white/10 bg-white/10 px-5 py-3 text-sm font-medium text-white"
                        >
                            Add student snapshot
                        </button>
                        <div className="mt-5 space-y-3">
                            {students.length === 0 ? <EmptyState title="No student progress snapshots yet." /> : students.map((student) => (
                                <div key={student.id} className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="font-semibold text-white">{student.name}</div>
                                            <div className="mt-1 text-sm text-white/60">{selectedCourseName(student.courseId)}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-white">{student.progress}%</div>
                                            <div className="text-xs uppercase tracking-[0.18em] text-white/45">Progress</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </PanelCard>
                </div>

                <PanelCard title="Attendance Management" description="Mark present or absent for each class session and keep an eye on low-attendance risk before it becomes a problem.">
                        <TeacherAttendancePanel />
                </PanelCard>

                <div className="grid gap-6 xl:grid-cols-2">
                    <PanelCard title="Weekly Lesson Planning" description="Map the week so each class has a visible next step.">
                        <div className="grid gap-3 md:grid-cols-3">
                            <input type="date" value={lessonForm.date} onChange={(event) => setLessonForm((current) => ({ ...current, date: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3" />
                            <select value={lessonForm.courseId} onChange={(event) => setLessonForm((current) => ({ ...current, courseId: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                                <option value="">Select course</option>
                                {courses.map((course) => (
                                    <option key={course.id} value={course.id}>{course.title}</option>
                                ))}
                            </select>
                            <input value={lessonForm.topic} onChange={(event) => setLessonForm((current) => ({ ...current, topic: event.target.value }))} placeholder="Lesson topic" className="campus-input rounded-[1rem] px-4 py-3" />
                        </div>
                        <button
                            onClick={() => {
                                if (!lessonForm.date || !lessonForm.courseId || !lessonForm.topic.trim()) {
                                    return;
                                }
                                saveWorkspace((current) => ({
                                    ...current,
                                    lessonPlans: [
                                        ...current.lessonPlans,
                                        {
                                            id: createId('lesson'),
                                            date: lessonForm.date,
                                            courseId: lessonForm.courseId,
                                            topic: lessonForm.topic.trim(),
                                        },
                                    ],
                                }));
                                setLessonForm({ date: '', topic: '', courseId: '' });
                            }}
                            className="mt-4 rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950"
                        >
                            Save lesson plan
                        </button>
                        <div className="mt-5 space-y-3">
                            {lessonPlans.length === 0 ? <EmptyState title="No lesson plans for this week yet." /> : lessonPlans.map((plan) => (
                                <div key={plan.id} className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                                    <div className="font-semibold text-white">{plan.topic}</div>
                                    <div className="mt-1">{selectedCourseName(plan.courseId)} • {plan.date}</div>
                                </div>
                            ))}
                        </div>
                    </PanelCard>

                    <PanelCard title="Communication With Students" description="Log outreach so no student follow-up quietly slips through.">
                        <div className="grid gap-3 md:grid-cols-3">
                            <input value={messageForm.recipient} onChange={(event) => setMessageForm((current) => ({ ...current, recipient: event.target.value }))} placeholder="Recipient" className="campus-input rounded-[1rem] px-4 py-3" />
                            <input value={messageForm.subject} onChange={(event) => setMessageForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Subject" className="campus-input rounded-[1rem] px-4 py-3" />
                            <input value={messageForm.message} onChange={(event) => setMessageForm((current) => ({ ...current, message: event.target.value }))} placeholder="Short message" className="campus-input rounded-[1rem] px-4 py-3" />
                        </div>
                        <button
                            onClick={() => {
                                if (!messageForm.recipient.trim() || !messageForm.message.trim()) {
                                    return;
                                }
                                saveWorkspace((current) => ({
                                    ...current,
                                    communications: [
                                        {
                                            id: createId('message'),
                                            recipient: messageForm.recipient.trim(),
                                            subject: messageForm.subject.trim() || 'Direct outreach',
                                            message: messageForm.message.trim(),
                                            sentAt: new Date().toISOString(),
                                        },
                                        ...current.communications,
                                    ],
                                }));
                                setMessageForm({ recipient: '', subject: '', message: '' });
                            }}
                            className="mt-4 rounded-[1rem] border border-white/10 bg-white/10 px-5 py-3 text-sm font-medium text-white"
                        >
                            Log communication
                        </button>
                        <div className="mt-5 space-y-3">
                            {communications.length === 0 ? <EmptyState title="No teacher-student communication logs yet." /> : communications.map((entry) => (
                                <div key={entry.id} className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                                    <div className="font-semibold text-white">{entry.subject}</div>
                                    <div className="mt-1">To {entry.recipient}</div>
                                    <div className="mt-2 text-white/65">{entry.message}</div>
                                </div>
                            ))}
                        </div>
                    </PanelCard>
                </div>

                <PanelCard title="Notice Board" description="Official notices from the administration will appear here.">
                    <NoticeBoard role="teacher" />
                </PanelCard>

                <PanelCard
                    title="JCUFA Portal"
                    description="Faculty association group chats — Announcements, Official Discussion, and Unofficial. Position holders can post announcements; all members can acknowledge."
                >
                    <JcufaChatPanel userId={profile?.user_id} userProfile={profile} />
                </PanelCard>

                <PanelCard
                    title="Club Event Approvals"
                    description="Events from your assigned club waiting for your Level 1 approval before going to Admin."
                >
                    <CoordinatorEventPanel />
                </PanelCard>

            </div>
        </div>
    );
}


function AdminSubjectAssignmentPanel({ teachers }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        const res = await fetch('/api/admin/assign-subjects', { credentials: 'same-origin' });
        const payload = await res.json().catch(() => ({}));
        if (res.ok) {
            setData(payload);
        } else {
            setError(payload.error || 'Failed to load assignments.');
        }
        setLoading(false);
    }, []);

    useEffect(() => { void loadData(); }, [loadData]);

    const assignments = data?.assignments || [];
    const subjects = data?.subjects || [];
    const allTeachers = teachers.length > 0 ? teachers : (data?.teachers || []);
    const filteredAssignments = selectedTeacherId ? assignments.filter(a => a.teacherId === selectedTeacherId) : assignments;

    const handleAssign = async () => {
        if (!selectedTeacherId || !selectedSubjectId) return;
        setMsg(''); setError('');
        const res = await fetch('/api/admin/assign-subjects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ teacherId: selectedTeacherId, subjectId: selectedSubjectId }),
        });
        const payload = await res.json().catch(() => ({}));
        if (res.ok) {
            setMsg('Subject assigned successfully.');
            setSelectedSubjectId('');
            void loadData();
        } else {
            setError(payload.error || 'Failed to assign subject.');
        }
    };

    const handleRemove = async (teacherId, subjectId) => {
        const res = await fetch('/api/admin/assign-subjects', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ teacherId, subjectId }),
        });
        if (res.ok) { void loadData(); }
    };

    return (
        <PanelCard
            title="Subject Assignments"
            description="Assign subjects to teachers. Teachers can only mark attendance for their assigned subjects."
            action={<button onClick={() => void loadData()} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white">Refresh</button>}
        >
            <div className="grid gap-3 md:grid-cols-3">
                <select value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)} className="campus-input rounded-[1rem] px-4 py-3">
                    <option value="">Select teacher</option>
                    {allTeachers.map(t => <option key={t.userId} value={t.userId}>{t.name}</option>)}
                </select>
                <select value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)} className="campus-input rounded-[1rem] px-4 py-3" disabled={!selectedTeacherId}>
                    <option value="">Select subject</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code}) — {s.course} {s.branch} Sem {s.semester}</option>)}
                </select>
                <button onClick={() => void handleAssign()} disabled={!selectedTeacherId || !selectedSubjectId} className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
                    Assign Subject
                </button>
            </div>
            {msg && <div className="mt-3 rounded-[1rem] border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">{msg}</div>}
            {error && <div className="mt-3 rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
            {loading ? <EmptyState title="Loading assignments..." /> : filteredAssignments.length === 0 ? <EmptyState title={selectedTeacherId ? 'No subjects assigned to this teacher yet.' : 'No subject assignments found.'} /> : (
                <div className="mt-4 space-y-2">
                    {filteredAssignments.map(a => (
                        <div key={`${a.teacherId}-${a.subjectId}`} className="flex items-center justify-between gap-3 rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                            <div>
                                <span className="font-semibold text-white">{a.teacher?.name || a.teacherId}</span>
                                <span className="mx-2 text-white/40">→</span>
                                <span>{a.subject?.name} ({a.subject?.code}) — {a.subject?.course} {a.subject?.branch} Sem {a.subject?.semester}</span>
                            </div>
                            <button onClick={() => void handleRemove(a.teacherId, a.subjectId)} className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs text-red-200 hover:bg-red-500/20">Remove</button>
                        </div>
                    ))}
                </div>
            )}
        </PanelCard>
    );
}

function AdminStudentRegistrationPanel({ studentProfiles }) {
    const [registeredStudents, setRegisteredStudents] = useState([]);
    const [loadingReg, setLoadingReg] = useState(false);
    const [regMsg, setRegMsg] = useState('');
    const [regError, setRegError] = useState('');
    const [form, setForm] = useState({ userId: '', name: '', rollNumber: '', course: '', branch: '', semester: '' });

    const loadStudents = useCallback(async () => {
        setLoadingReg(true);
        const res = await fetch('/api/admin/students', { credentials: 'same-origin' });
        const payload = await res.json().catch(() => ({}));
        if (res.ok) setRegisteredStudents(payload.students || []);
        setLoadingReg(false);
    }, []);

    useEffect(() => { void loadStudents(); }, [loadStudents]);

    const selectedProfile = studentProfiles.find(p => p.userId === form.userId);
    useEffect(() => {
        if (selectedProfile) {
            setForm(prev => ({
                ...prev,
                name: selectedProfile.name || prev.name,
                rollNumber: selectedProfile.rollNumber || prev.rollNumber,
                course: selectedProfile.course || prev.course,
                branch: selectedProfile.branch || prev.branch,
                semester: selectedProfile.semester ? `${selectedProfile.semester}` : prev.semester,
            }));
        }
    }, [form.userId, selectedProfile]);

    const handleRegister = async () => {
        setRegMsg(''); setRegError('');
        const res = await fetch('/api/admin/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ userId: form.userId, name: form.name, rollNumber: form.rollNumber, course: form.course, branch: form.branch, semester: Number(form.semester) }),
        });
        const payload = await res.json().catch(() => ({}));
        if (res.ok) {
            setRegMsg('Student registered successfully.');
            setForm({ userId: '', name: '', rollNumber: '', course: '', branch: '', semester: '' });
            void loadStudents();
        } else {
            setRegError(payload.error || 'Failed to register student.');
        }
    };

    const handleDelete = async (id) => {
        const res = await fetch(`/api/admin/students/${id}`, { method: 'DELETE', credentials: 'same-origin' });
        if (res.ok) void loadStudents();
    };

    return (
        <PanelCard
            title="Student Registration"
            description="Register student profiles into the attendance system with their academic program details."
            action={<button onClick={() => void loadStudents()} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white">Refresh</button>}
        >
            <div className="grid gap-3 md:grid-cols-3">
                <select value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                    <option value="">Select student profile</option>
                    {studentProfiles.map(p => <option key={p.userId} value={p.userId}>{p.name} ({p.email})</option>)}
                </select>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" className="campus-input rounded-[1rem] px-4 py-3" />
                <input value={form.rollNumber} onChange={e => setForm(f => ({ ...f, rollNumber: e.target.value }))} placeholder="Roll number" className="campus-input rounded-[1rem] px-4 py-3" />
                <input value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value }))} placeholder="Course (B.Tech)" className="campus-input rounded-[1rem] px-4 py-3" />
                <input value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} placeholder="Branch (CSE)" className="campus-input rounded-[1rem] px-4 py-3" />
                <input type="number" min="1" max="12" value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))} placeholder="Semester" className="campus-input rounded-[1rem] px-4 py-3" />
            </div>
            <button onClick={() => void handleRegister()} disabled={!form.userId || !form.name || !form.rollNumber || !form.course || !form.branch || !form.semester} className="mt-4 rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
                Register Student
            </button>
            {regMsg && <div className="mt-3 rounded-[1rem] border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">{regMsg}</div>}
            {regError && <div className="mt-3 rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{regError}</div>}
            {loadingReg ? <EmptyState title="Loading registered students..." /> : registeredStudents.length === 0 ? <EmptyState title="No students registered in the attendance system yet." /> : (
                <div className="mt-4 space-y-2">
                    {registeredStudents.map(s => (
                        <div key={s.id} className="flex items-center justify-between gap-3 rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                            <div>
                                <span className="font-semibold text-white">{s.rollNumber}</span>
                                <span className="mx-2 text-white/40">·</span>
                                <span>{s.name}</span>
                                <span className="mx-2 text-white/40">·</span>
                                <span className="text-white/55">{s.course} {s.branch} Sem {s.semester}</span>
                            </div>
                            <button onClick={() => void handleDelete(s.id)} className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs text-red-200 hover:bg-red-500/20">Remove</button>
                        </div>
                    ))}
                </div>
            )}
        </PanelCard>
    );
}

const JCUFA_POSITIONS = ['President', 'Vice President', 'Secretary', 'Treasurer', 'Member', 'Other'];

function JcufaPositionPanel({ teachers, onRefresh }) {
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [selectedPosition, setSelectedPosition] = useState('');
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAssign = async () => {
        if (!selectedTeacherId || !selectedPosition) return;
        setLoading(true); setMsg(''); setErr('');
        const res = await fetch('/api/admin/jcufa-position', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: selectedTeacherId, position: selectedPosition }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            setMsg(`Position updated successfully.`);
            setSelectedTeacherId('');
            setSelectedPosition('');
            onRefresh?.();
        } else {
            setErr(data.error || 'Failed to update position.');
        }
        setLoading(false);
    };

    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
                <select value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)} className="campus-input rounded-[1rem] px-4 py-3">
                    <option value="">Select teacher</option>
                    {teachers.map(t => (
                        <option key={t.user_id} value={t.user_id}>
                            {t.display_name || t.full_name || t.email}
                            {t.jcufa_position ? ` (${t.jcufa_position})` : ' (No position)'}
                        </option>
                    ))}
                </select>
                <select value={selectedPosition} onChange={e => setSelectedPosition(e.target.value)} className="campus-input rounded-[1rem] px-4 py-3">
                    <option value="">Assign position</option>
                    {JCUFA_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    <option value="REMOVE">Remove from JCUFA</option>
                </select>
                <button
                    onClick={() => void handleAssign()}
                    disabled={!selectedTeacherId || !selectedPosition || loading}
                    className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                    {loading ? 'Saving…' : 'Save Position'}
                </button>
            </div>
            {msg && <div className="rounded-[1rem] border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">{msg}</div>}
            {err && <div className="rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{err}</div>}
            <div className="space-y-2">
                {teachers.filter(t => t.jcufa_position).map(t => (
                    <div key={t.user_id} className="flex items-center justify-between gap-3 rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                        <span className="font-semibold text-white">{t.display_name || t.full_name || t.email}</span>
                        <span className="rounded-full bg-amber-500/20 border border-amber-400/30 px-3 py-1 text-xs text-amber-200">{t.jcufa_position}</span>
                    </div>
                ))}
                {teachers.filter(t => t.jcufa_position).length === 0 && (
                    <EmptyState title="No JCUFA positions assigned yet." />
                )}
            </div>
        </div>
    );
}

export function AdminDashboard({ displayName, profile, onSignOut }) {
    const [teacherRequests, setTeacherRequests] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [userManagementTab, setUserManagementTab] = useState('teachers');
    const [userSearchTerm, setUserSearchTerm] = useState('');

    const loadAdminData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/admin/dashboard', {
                method: 'GET',
                credentials: 'same-origin',
            });
            const payload = await response.json().catch(() => ({ error: 'Failed to load admin data.' }));
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to load admin data.');
            }
            setTeacherRequests(payload.teacherRequests || []);
            setProfiles(payload.profiles || []);
            setActivityLogs(payload.activityLogs || []);
            setSessions(payload.sessions || []);
        }
        catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load admin data.');
        }
        finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadAdminData();
    }, [loadAdminData]);

    useEffect(() => {
        const sessionKey = window.localStorage.getItem('smart-campus-admin-session-key') || createId('admin-session');
        window.localStorage.setItem('smart-campus-admin-session-key', sessionKey);
        void fetch('/api/admin/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionKey,
                deviceName: navigator.platform || 'Unknown device',
            }),
        }).catch(() => undefined);
    }, []);

    const teacherCount = profiles.filter((item) => item.role === 'teacher').length;
    const studentCount = profiles.filter((item) => item.role === 'student').length;
    const pendingCount = teacherRequests.filter((item) => item.status === 'pending').length;
    const approvedCount = teacherRequests.filter((item) => item.status === 'approved').length;
    const pendingTeacherRequests = teacherRequests.filter((item) => item.status === 'pending');

    const profileMap = useMemo(() => Object.fromEntries(profiles.map((item) => [item.user_id, item])), [profiles]);
    const teacherProfiles = useMemo(() => profiles.filter((item) => item.role === 'teacher'), [profiles]);
    const studentProfiles = useMemo(() => profiles.filter((item) => item.role === 'student'), [profiles]);
    const visibleUserProfiles = useMemo(() => {
        const sourceProfiles = userManagementTab === 'teachers' ? teacherProfiles : studentProfiles;
        const query = userSearchTerm.trim().toLowerCase();
        if (!query) {
            return sourceProfiles;
        }
        return sourceProfiles.filter((entry) => {
            const searchableText = [
                entry.display_name,
                entry.full_name,
                entry.username,
                entry.email,
                entry.phone_number,
                entry.employee_id,
                entry.role,
                entry.verification_status,
            ].filter(Boolean).join(' ').toLowerCase();
            return searchableText.includes(query);
        });
    }, [studentProfiles, teacherProfiles, userManagementTab, userSearchTerm]);

    const handleReview = async (action) => {
        if (!selectedRequest) {
            return;
        }
        const response = await fetch('/api/admin/teacher-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requestId: selectedRequest.id,
                userId: selectedRequest.user_id,
                action,
                reviewNotes,
            }),
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({ error: 'Review failed.' }));
            setError(payload.error || 'Review failed.');
            return;
        }
        setSelectedRequest(null);
        setReviewNotes('');
        await loadAdminData();
    };

    return (
        <div className="campus-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <div className="campus-panel-strong rounded-[2rem] p-8">
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                            <div className="campus-kicker">Admin Panel</div>
                            <h1 className="mt-3 text-3xl font-bold text-white">Verification queue, user operations, and security visibility</h1>
                            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
                                You are signed in as the single admin account. Multi-device access remains available while every admin session and tracked activity is visible below.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <div className="campus-panel rounded-[1.3rem] px-4 py-3 text-sm text-white/80">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Admin</div>
                                <div className="mt-1 text-white">{displayName}</div>
                                <div className="text-white/60">{profile?.admin_id || 'Configured admin'}</div>
                            </div>
                            <button onClick={onSignOut} className="rounded-full border border-red-300/20 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-100 transition hover:bg-red-500/20">
                                Logout
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    <div className="campus-panel rounded-[1.5rem] p-5">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Pending Teachers</div>
                        <div className="mt-3 text-3xl font-bold text-white">{pendingCount}</div>
                    </div>
                    <div className="campus-panel rounded-[1.5rem] p-5">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Approved Teachers</div>
                        <div className="mt-3 text-3xl font-bold text-white">{approvedCount}</div>
                    </div>
                    <div className="campus-panel rounded-[1.5rem] p-5">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Students</div>
                        <div className="mt-3 text-3xl font-bold text-white">{studentCount}</div>
                    </div>
                    <div className="campus-panel rounded-[1.5rem] p-5">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Tracked Sessions</div>
                        <div className="mt-3 text-3xl font-bold text-white">{sessions.length}</div>
                    </div>
                </div>

                {error ? (
                    <div className="rounded-[1.2rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                        {error}
                    </div>
                ) : null}

                <AdminKnowledgePanel />

                <AdminNoticePanel />

                <AdminIssueManagementPanel />

                <PanelCard
                    title="Club Event Approvals"
                    description="Final approval queue. Events approved by coordinators wait here. Approve to publish them to the student portal, or reject with a reason."
                    action={null}
                >
                    <AdminEventApprovalPanel />
                </PanelCard>

                <PanelCard
                    title="JCUFA Position Management"
                    description="Assign or update JCUFA positions for teacher accounts. Position holders (President, VP, Secretary, Treasurer) can post in the Announcements group."
                >
                    <JcufaPositionPanel teachers={profiles.filter(p => p.role === 'teacher')} onRefresh={loadAdminData} />
                </PanelCard>

                <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <PanelCard
                        title="Teacher Verification Management"
                        description="Review pending teacher signups, inspect ID images, and approve or reject requests."
                        action={<button onClick={() => void loadAdminData()} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white">Refresh</button>}
                    >
                        {loading ? <EmptyState title="Loading verification queue..." /> : pendingTeacherRequests.length === 0 ? <EmptyState title="No pending teacher verification requests." /> : (
                            <div className="space-y-3">
                                {pendingTeacherRequests.map((request) => {
                                    const requestProfile = profileMap[request.user_id];
                                    return (
                                        <div key={request.id} className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                <div>
                                                    <div className="text-lg font-semibold text-white">{requestProfile?.display_name || request.full_name || 'Teacher request'}</div>
                                                    <div className="mt-1 text-sm text-white/60">{request.email || requestProfile?.email}</div>
                                                    <div className="mt-2 text-sm text-white/70">Employee ID: {request.employee_id}</div>
                                                    <div className="text-sm text-white/70">Phone: {request.phone_number || requestProfile?.phone_number || 'Not provided'}</div>
                                                    <div className="mt-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/60 inline-flex capitalize">
                                                        {request.status}
                                                    </div>
                                                </div>
                                                <button onClick={() => {
                                                    setSelectedRequest(request);
                                                    setReviewNotes(request.review_notes || '');
                                                }} className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950">
                                                    Review request
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </PanelCard>

                    <div className="space-y-6">
                        <PanelCard title="System Monitoring" description="Role distribution, device sessions, and audit visibility for the admin account.">
                            <div className="space-y-3 text-sm text-white/75">
                                <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">Teacher accounts: {teacherCount}</div>
                                <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">Student accounts: {studentCount}</div>
                                <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">Recent audited actions: {activityLogs.length}</div>
                            </div>
                        </PanelCard>

                        <PanelCard title="Security And Audit Trails" description="Recent admin session records across devices.">
                            {sessions.length === 0 ? <EmptyState title="No admin sessions logged yet." /> : (
                                <div className="space-y-3">
                                    {sessions.map((session) => (
                                        <div key={session.id} className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
                                            <div className="font-semibold text-white">{session.device_name || 'Unknown device'}</div>
                                            <div className="mt-1">IP: {session.ip_address || 'Unknown'} • {session.location_label || 'Unknown location'}</div>
                                            <div className="mt-1 text-white/55">Last seen {new Date(session.last_seen_at || session.created_at).toLocaleString()}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </PanelCard>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <PanelCard title="User Management" description="Search and review student and teacher accounts from separate admin tabs.">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => setUserManagementTab('teachers')} className={`rounded-full px-4 py-2 text-sm font-medium transition ${userManagementTab === 'teachers' ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950' : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}>
                                    Teachers ({teacherProfiles.length})
                                </button>
                                <button onClick={() => setUserManagementTab('students')} className={`rounded-full px-4 py-2 text-sm font-medium transition ${userManagementTab === 'students' ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950' : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}>
                                    Students ({studentProfiles.length})
                                </button>
                            </div>
                            <input value={userSearchTerm} onChange={(event) => setUserSearchTerm(event.target.value)} placeholder={`Search ${userManagementTab === 'teachers' ? 'teachers' : 'students'} by name, email, username, phone, or ID`} className="campus-input w-full rounded-[1rem] px-4 py-3 lg:max-w-md" />
                        </div>
                        <div className="mt-4 rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                            Showing {visibleUserProfiles.length} {userManagementTab === 'teachers' ? 'teacher' : 'student'} account{visibleUserProfiles.length === 1 ? '' : 's'}.
                        </div>
                        {profiles.length === 0 ? <div className="mt-5"><EmptyState title="No profiles found." /></div> : visibleUserProfiles.length === 0 ? <div className="mt-5"><EmptyState title={`No ${userManagementTab} matched your search.`} /></div> : (
                            <div className="mt-5 space-y-3">
                                {visibleUserProfiles.slice(0, 24).map((entry) => (
                                    <div key={entry.user_id} className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/75">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <div className="font-semibold text-white">{entry.display_name || entry.full_name || entry.username || 'Unnamed user'}</div>
                                                <div className="mt-1 text-white/60">{entry.email || 'No email available'}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="capitalize text-white">{entry.role || 'student'}</div>
                                                <div className="capitalize text-white/55">{entry.verification_status || 'approved'}</div>
                                            </div>
                                        </div>
                                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                            <div className="rounded-[0.9rem] border border-white/10 bg-slate-950/25 px-3 py-2">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Username</div>
                                                <div className="mt-1 text-white">{entry.username || 'Not set'}</div>
                                            </div>
                                            <div className="rounded-[0.9rem] border border-white/10 bg-slate-950/25 px-3 py-2">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Phone</div>
                                                <div className="mt-1 text-white">{entry.phone_number || 'Not provided'}</div>
                                            </div>
                                            <div className="rounded-[0.9rem] border border-white/10 bg-slate-950/25 px-3 py-2">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Employee ID</div>
                                                <div className="mt-1 text-white">{entry.employee_id || 'Not applicable'}</div>
                                            </div>
                                            <div className="rounded-[0.9rem] border border-white/10 bg-slate-950/25 px-3 py-2">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Full Name</div>
                                                <div className="mt-1 text-white">{entry.full_name || entry.display_name || 'Not set'}</div>
                                            </div>
                                            <div className="rounded-[0.9rem] border border-white/10 bg-slate-950/25 px-3 py-2">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Last Seen</div>
                                                <div className="mt-1 text-white">{entry.last_seen ? new Date(entry.last_seen).toLocaleString() : 'No recent activity'}</div>
                                            </div>
                                            <div className="rounded-[0.9rem] border border-white/10 bg-slate-950/25 px-3 py-2">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">User ID</div>
                                                <div className="mt-1 break-all text-white/80">{entry.user_id}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </PanelCard>

                    <PanelCard title="Activity Logging" description="Recent tracked actions across the system.">
                        {activityLogs.length === 0 ? <EmptyState title="No activity logs captured yet." /> : (
                            <div className="space-y-3">
                                {activityLogs.map((entry) => (
                                    <div key={entry.id} className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="font-semibold text-white">{entry.action}</div>
                                            <div className="capitalize text-white/55">{entry.role || 'user'}</div>
                                        </div>
                                        <div className="mt-2 text-white/60">{entry.summary || 'No summary provided.'}</div>
                                        <div className="mt-1 text-white/45">{new Date(entry.created_at).toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </PanelCard>
                </div>

                <AdminSubjectAssignmentPanel teachers={teacherProfiles.map(t => ({ userId: t.user_id, name: t.display_name || t.full_name || t.email, email: t.email }))} />

                <AdminStudentRegistrationPanel studentProfiles={studentProfiles.map(p => ({ userId: p.user_id, name: p.display_name || p.full_name || p.email, email: p.email, rollNumber: p.roll_number || '', course: p.course || '', branch: p.branch || '', semester: p.semester || null }))} />

                {selectedRequest ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
                        <div className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-slate-950 p-6 text-white shadow-2xl">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="campus-kicker">Teacher Verification Review</div>
                                    <h3 className="mt-2 text-2xl font-bold">Review teacher request</h3>
                                </div>
                                <button onClick={() => {
                                    setSelectedRequest(null);
                                    setReviewNotes('');
                                }} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
                                    Close
                                </button>
                            </div>
                            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                                <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                                    <div className="text-sm text-white/55">Employee ID image</div>
                                    {selectedRequest.employee_id_image_data ? (
                                        <Image src={selectedRequest.employee_id_image_data} alt="Employee ID" width={1200} height={800} unoptimized className="mt-4 max-h-[26rem] w-full rounded-[1rem] object-contain" />
                                    ) : (
                                        <EmptyState title="No employee ID image uploaded." />
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <div className="rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/75">
                                        <div className="font-semibold text-white">{profileMap[selectedRequest.user_id]?.display_name || selectedRequest.full_name || 'Teacher'}</div>
                                        <div className="mt-2">Email: {selectedRequest.email}</div>
                                        <div className="mt-1">Phone: {selectedRequest.phone_number || 'Not provided'}</div>
                                        <div className="mt-1">Employee ID: {selectedRequest.employee_id}</div>
                                        <div className="mt-1">Submitted: {new Date(selectedRequest.created_at).toLocaleString()}</div>
                                    </div>
                                    <textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Review notes for the teacher" className="campus-input min-h-36 w-full rounded-[1rem] px-4 py-3" />
                                    <div className="flex flex-wrap gap-3">
                                        <button onClick={() => void handleReview('approve')} className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950">
                                            Approve teacher
                                        </button>
                                        <button onClick={() => void handleReview('reject')} className="rounded-[1rem] border border-red-400/30 bg-red-500/10 px-5 py-3 text-sm font-medium text-red-100">
                                            Reject request
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
