'use client';

import { Suspense, useEffect, useState } from 'react';
import { AuthError } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ACCOUNT_ROLES } from '@/lib/smart-campus/roles.js';

const DEMO_OTP_LENGTH = 6;
const PENDING_TEACHER_SIGNUP_KEY = 'smart-campus-pending-teacher-signup';
const ROLE_PORTAL_COPY = {
    student: {
        badge: 'Student Portal',
        title: 'Plan campus life and stay on top of classes',
        description: 'Direct signup is enabled for students. Log in to access planners, events, clubs, reminders, deadlines, and chat.',
        accent: 'from-sky-400 to-blue-400',
        loginLabel: 'Student Login',
        signupLabel: 'Student Signup',
    },
    teacher: {
        badge: 'Teacher Portal',
        title: 'Manage classes after verification approval',
        description: 'Teachers can sign up with an email, phone verification, and employee ID. Approved accounts get the teacher dashboard after login.',
        accent: 'from-emerald-400 to-teal-300',
        loginLabel: 'Teacher Login',
        signupLabel: 'Teacher Signup',
    },
    admin: {
        badge: 'Admin Portal',
        title: 'Review teachers and monitor the system',
        description: 'The admin account signs in with email, password, and the assigned Admin ID. Public admin signup stays disabled.',
        accent: 'from-amber-400 to-orange-400',
        loginLabel: 'Admin Login',
        signupLabel: 'Admin Setup Only',
    },
    club: {
        badge: 'Club Portal',
        title: 'Submit and track event proposals',
        description: 'Clubs sign in with their unique Club Login ID and password. Events go through coordinator and admin approval before being published.',
        accent: 'from-violet-400 to-purple-400',
        loginLabel: 'Club Login',
        signupLabel: 'Club accounts are created by Admin only',
    },
};

const ROLE_MISMATCH_MESSAGES = {
    student: 'This account is not a student account. Please use the correct portal.',
    teacher: 'This account is not a teacher account. Please use the Teacher Portal.',
    admin: 'This account is not the admin account. Please use the Admin Portal.',
};

function generateDemoOtp() {
    return `${Math.floor(100000 + Math.random() * 900000)}`.slice(0, DEMO_OTP_LENGTH);
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Unable to read the uploaded file.'));
        reader.readAsDataURL(file);
    });
}

function AuthPageContent() {
    const [isLogin, setIsLogin] = useState(true);
    const [selectedRole, setSelectedRole] = useState('student');
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rollNumber, setRollNumber] = useState('');
    const [course, setCourse] = useState('');
    const [branch, setBranch] = useState('');
    const [semester, setSemester] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [phoneOtp, setPhoneOtp] = useState('');
    const [generatedOtp, setGeneratedOtp] = useState('');
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [employeeId, setEmployeeId] = useState('');
    const [employeeIdImageData, setEmployeeIdImageData] = useState('');
    const [employeeIdImageName, setEmployeeIdImageName] = useState('');
    const [adminId, setAdminId] = useState('');
    const [clubLoginId, setClubLoginId] = useState('');
    const [clubPassword, setClubPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [message, setMessage] = useState('');
    const { signIn, signUp, signOut, resendConfirmation } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedPortal = ROLE_PORTAL_COPY[selectedRole] || ROLE_PORTAL_COPY.student;

    const isTeacherSignup = !isLogin && selectedRole === 'teacher';
    const isAdminMode = selectedRole === 'admin';
    const isClubMode = selectedRole === 'club';
    const canResendConfirmation = !isLogin && !isClubMode && Boolean(email.trim()) && !loading;

    useEffect(() => {
        const requestedRole = searchParams.get('role');
        const requestedMode = searchParams.get('mode');
        const isKnownRole = ACCOUNT_ROLES.some((role) => role.id === requestedRole);

        if (isKnownRole) {
            setSelectedRole(requestedRole);
        }

        if (requestedMode === 'login') {
            setIsLogin(true);
        }
        else if (requestedMode === 'signup') {
            setIsLogin(false);
        }
    }, [searchParams]);

    const resetTeacherVerification = () => {
        setPhoneNumber('');
        setPhoneOtp('');
        setGeneratedOtp('');
        setPhoneVerified(false);
        setEmployeeId('');
        setEmployeeIdImageData('');
        setEmployeeIdImageName('');
    };

    const handleRoleChange = (roleId) => {
        setSelectedRole(roleId);
        setMessage('');
        if (roleId !== 'teacher') {
            resetTeacherVerification();
        }
    };

    const handleTeacherImageUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        try {
            const dataUrl = await readFileAsDataUrl(file);
            setEmployeeIdImageData(dataUrl);
            setEmployeeIdImageName(file.name);
        }
        catch (error) {
            setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to process the employee ID image.'}`);
        }
    };

    const handleSendOtp = () => {
        if (!phoneNumber.trim()) {
            setMessage('Error: Enter a phone number before requesting verification.');
            return;
        }
        const nextOtp = generateDemoOtp();
        setGeneratedOtp(nextOtp);
        setPhoneVerified(false);
        setMessage(`Demo verification code sent: ${nextOtp}`);
    };

    const handleVerifyOtp = () => {
        if (!generatedOtp) {
            setMessage('Error: Request a verification code first.');
            return;
        }
        if (phoneOtp.trim() !== generatedOtp) {
            setPhoneVerified(false);
            setMessage('Error: The verification code does not match.');
            return;
        }
        setPhoneVerified(true);
        setMessage('Phone number verified. You can continue the teacher signup.');
    };

    const handleResendConfirmation = async () => {
        if (!email.trim()) {
            setMessage('Error: Enter the same email address you used for signup first.');
            return;
        }
        setResendLoading(true);
        try {
            const { error } = await resendConfirmation(email.trim());
            if (error) {
                setMessage(`Error: ${error.message}`);
            }
            else {
                setMessage('Confirmation email resent. Check spam/promotions too if it does not appear in your inbox.');
            }
        }
        finally {
            setResendLoading(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            // Club login — uses separate credential system
            if (isClubMode) {
                if (!clubLoginId.trim() || !clubPassword.trim()) {
                    setMessage('Error: Enter your Club Login ID and password.');
                    setLoading(false);
                    return;
                }
                const res = await fetch('/api/clubs/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ login_id: clubLoginId.trim(), password: clubPassword }),
                });
                const data = await res.json();
                if (!res.ok) {
                    setMessage(`Error: ${data.error || 'Invalid club credentials.'}`);
                } else {
                    router.push('/club-portal');
                }
                setLoading(false);
                return;
            }

            if (isLogin) {
                if (isAdminMode && !adminId.trim()) {
                    setMessage('Error: Enter the Admin ID to continue.');
                    setLoading(false);
                    return;
                }
                const { data, error } = await signIn(email, password);
                if (error) {
                    setMessage(`Error: ${error.message}`);
                }
                else if (isAdminMode && data.user?.user_metadata?.role !== 'admin') {
                    await signOut();
                    setMessage('Error: This account is not configured as the single admin account.');
                }
                else if (isAdminMode && data.user?.user_metadata?.adminId && data.user.user_metadata.adminId !== adminId.trim()) {
                    await signOut();
                    setMessage('Error: The Admin ID does not match this account.');
                }
                else if (selectedRole === 'teacher' && data.user?.user_metadata?.role && data.user.user_metadata.role !== 'teacher') {
                    await signOut();
                    setMessage('Error: ' + ROLE_MISMATCH_MESSAGES.teacher);
                }
                else if (selectedRole === 'student' && data.user?.user_metadata?.role && data.user.user_metadata.role !== 'student') {
                    await signOut();
                    setMessage('Error: ' + ROLE_MISMATCH_MESSAGES.student);
                }
                else {
                    router.push('/');
                }
                return;
            }

            if (isAdminMode) {
                setMessage('Error: Admin accounts cannot be created from the public signup form.');
                setLoading(false);
                return;
            }

            const parsedAge = Number.parseInt(age, 10);
            if (!name.trim()) {
                setMessage('Error: Please enter your name.');
                setLoading(false);
                return;
            }
            if (!Number.isFinite(parsedAge) || parsedAge <= 0) {
                setMessage('Error: Please enter a valid age.');
                setLoading(false);
                return;
            }
            if (selectedRole === 'teacher') {
                if (!phoneNumber.trim() || !phoneVerified) {
                    setMessage('Error: Complete phone verification before signing up as a teacher.');
                    setLoading(false);
                    return;
                }
                if (!employeeId.trim()) {
                    setMessage('Error: Enter your employee ID.');
                    setLoading(false);
                    return;
                }
                if (!employeeIdImageData) {
                    setMessage('Error: Upload an employee ID image.');
                    setLoading(false);
                    return;
                }
            }
            if (selectedRole === 'student') {
                const parsedSemester = Number.parseInt(semester, 10);
                if (!rollNumber.trim() || !course.trim() || !branch.trim() || !Number.isFinite(parsedSemester) || parsedSemester <= 0) {
                    setMessage('Error: Enter roll number, course, branch, and a valid semester for student signup.');
                    setLoading(false);
                    return;
                }
            }

            const { data, error } = await signUp({
                name: name.trim(),
                age: parsedAge,
                email,
                password,
                role: selectedRole,
                phoneNumber,
                phoneVerified,
                employeeId,
                employeeIdImageData,
                employeeIdImageName,
                rollNumber: rollNumber.trim(),
                course: course.trim(),
                branch: branch.trim(),
                semester: semester.trim() ? Number.parseInt(semester, 10) : null,
            });
            if (error) {
                setMessage(`Error: ${error.message}`);
            }
            else {
                if (selectedRole === 'teacher') {
                    window.localStorage.setItem(PENDING_TEACHER_SIGNUP_KEY, JSON.stringify({
                        userId: data.user?.id || null,
                        email,
                        name: name.trim(),
                        age: parsedAge,
                        role: selectedRole,
                        phoneNumber: phoneNumber.trim(),
                        phoneVerified,
                        employeeId: employeeId.trim(),
                        employeeIdImageData,
                        employeeIdImageName,
                        rollNumber: rollNumber.trim(),
                        course: course.trim(),
                        branch: branch.trim(),
                        semester: semester.trim() ? Number.parseInt(semester, 10) : null,
                    }));
                    setMessage('Teacher account created. Verify your email, then log in once to create your profile and submit your verification request to the admin queue.');
                }
                else {
                    setMessage('Account created. Check your email to confirm it, then log in once to finish setting up your profile.');
                }
            }
        }
        catch (error) {
            const errorMessage = error instanceof AuthError ? error.message : 'Something went wrong.';
            setMessage(`Error: ${errorMessage}`);
        }
        finally {
            setLoading(false);
        }
    };

    return (
        <div className="campus-light-mode min-h-screen bg-white px-6 py-10 relative overflow-hidden">
            {/* Decorative blobs */}
            <div className="absolute top-[-5rem] left-[-3rem] w-60 h-60 rounded-full bg-pink-200/40 blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-4rem] right-[-3rem] w-72 h-72 rounded-full bg-cyan-200/30 blur-3xl pointer-events-none" />
            <div className="absolute top-20 right-20 w-4 h-4 rounded-full bg-yellow-400 opacity-60 pointer-events-none" />
            <div className="absolute top-40 left-[15%] w-3 h-3 rounded-full bg-pink-500 opacity-50 pointer-events-none" />

            <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr] relative z-10">
                <div className="auth-info-panel p-8 text-white" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
                    <div className="relative z-10">
                        <div className="campus-kicker" style={{ color: '#ff6b9d' }}>🔐 Access Control</div>
                        <h1 className="mt-3 text-4xl font-bold" style={{ background: 'linear-gradient(135deg, #00c8ff, #e91e84, #ffc107)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Smart Campus AI</h1>
                        <p className="mt-4 max-w-xl text-sm leading-7 text-white/65">
                            Student, teacher, and admin access follow different rules. Students sign up directly, teachers enter a verification queue, and the admin signs in with a provisioned Admin ID.
                        </p>

                        <div className="mt-8 grid gap-4">
                            <div className="rounded-[1.4rem] border border-emerald-400/15 bg-emerald-500/8 p-5">
                                <div className="text-xs uppercase tracking-[0.2em] text-emerald-700">Teacher Signup Requirements</div>
                                <div className="mt-3 space-y-2 text-sm text-white/70">
                                    <div className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Email verification</div>
                                    <div className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Phone number verification</div>
                                    <div className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Employee ID and ID image upload</div>
                                    <div className="flex items-center gap-2"><span className="text-amber-400">⏳</span> Pending admin verification within 24 hours</div>
                                </div>
                            </div>
                            <div className="rounded-[1.4rem] border border-cyan-400/15 bg-cyan-500/8 p-5">
                                <div className="text-xs uppercase tracking-[0.2em] text-cyan-700">Panel Access</div>
                                <div className="mt-3 space-y-2 text-sm text-white/70">
                                    <div className="flex items-start gap-2"><span className="text-cyan-400">●</span> <span><strong className="text-white/90">Students:</strong> planner, events, clubs, deadlines, chat</span></div>
                                    <div className="flex items-start gap-2"><span className="text-emerald-400">●</span> <span><strong className="text-white/90">Teachers:</strong> courses, grading, progress, lesson plans</span></div>
                                    <div className="flex items-start gap-2"><span className="text-amber-400">●</span> <span><strong className="text-white/90">Admin:</strong> teacher review, users, monitoring, audit</span></div>
                                    <div className="flex items-start gap-2"><span className="text-purple-400">●</span> <span><strong className="text-white/90">Clubs:</strong> event proposals, approval tracking</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="auth-form-panel p-8">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-slate-500">Choose the exact portal you want to open.</div>
                        <Link href="/" className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:border-slate-300">
                            ← Back to role gateway
                        </Link>
                    </div>

                    <div className="campus-tab-group flex gap-2 p-1.5">
                        <button onClick={() => setIsLogin(true)} className={`flex-1 rounded-[1rem] px-4 py-3 text-sm font-medium transition ${isLogin ? 'campus-tab-active' : 'campus-tab-inactive'}`}>
                            Login
                        </button>
                        <button onClick={() => setIsLogin(false)} className={`flex-1 rounded-[1rem] px-4 py-3 text-sm font-medium transition ${!isLogin ? 'campus-tab-active' : 'campus-tab-inactive'}`}>
                            Sign Up
                        </button>
                    </div>

                    <div className="mt-6">
                        <div className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-400">Select Role</div>
                        <div className="campus-tab-group grid grid-cols-3 gap-2 p-1.5">
                            {ACCOUNT_ROLES.map((role) => {
                                const isSelected = selectedRole === role.id;
                                return (
                                    <button
                                        key={role.id}
                                        type="button"
                                        onClick={() => handleRoleChange(role.id)}
                                        className={`rounded-[1rem] px-3 py-3 text-sm font-semibold transition ${isSelected
                                            ? 'campus-tab-active'
                                            : 'campus-tab-inactive'}`}
                                    >
                                        {role.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5">
                        <div className={`inline-flex rounded-full bg-gradient-to-r ${selectedPortal.accent} px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white`}>
                            {selectedPortal.badge}
                        </div>
                        <h2 className="mt-3 text-2xl font-bold text-slate-900">{isLogin ? selectedPortal.loginLabel : selectedPortal.signupLabel}</h2>
                        <p className="mt-2 text-sm leading-7 text-slate-500">{selectedPortal.title}. {selectedPortal.description}</p>
                        {isAdminMode && isLogin ? (
                            <div className="mt-4 rounded-[1rem] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                Admin login requires the account email, password, and the assigned Admin ID.
                            </div>
                        ) : null}
                        {selectedRole === 'teacher' && isLogin ? (
                            <div className="mt-4 rounded-[1rem] border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                Approved teachers can log in here with the same email and password used during teacher signup.
                            </div>
                        ) : null}
                    </div>

                    {/* Club login — uses separate credential system, NOT Supabase Auth */}
                    {isClubMode ? (
                        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                            <div className="rounded-[1.4rem] border border-purple-300 bg-purple-50 p-4 text-sm text-purple-800">
                                Club accounts use a separate system — not email/password. Sign in with your assigned Club Login ID and password.
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Club Login ID</label>
                                <input
                                    type="text"
                                    value={clubLoginId}
                                    onChange={(e) => setClubLoginId(e.target.value)}
                                    placeholder="e.g. cs_club"
                                    className="campus-input w-full rounded-[1rem] px-4 py-3"
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
                                <input
                                    type="password"
                                    value={clubPassword}
                                    onChange={(e) => setClubPassword(e.target.value)}
                                    placeholder="Club password"
                                    className="campus-input w-full rounded-[1rem] px-4 py-3"
                                    required
                                />
                            </div>
                            {message ? (
                                <div className={`rounded-[1rem] px-4 py-3 text-sm ${message.startsWith('Error:') ? 'border border-red-300 bg-red-50 text-red-700' : 'border border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
                                    {message}
                                </div>
                            ) : null}
                            <button type="submit" disabled={loading} className="w-full rounded-[1rem] bg-gradient-to-r from-pink-500 to-purple-500 px-5 py-3 font-semibold text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 transition disabled:opacity-50">
                                {loading ? 'Signing in…' : 'Sign in as Club'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                            {!isLogin ? (
                                <>
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                                        <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700">Age</label>
                                        <input type="number" min="1" value={age} onChange={(event) => setAge(event.target.value)} placeholder="Your age" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                                    </div>
                                    {selectedRole === 'student' ? (
                                        <>
                                            <div>
                                                <label className="mb-2 block text-sm font-medium text-slate-700">Roll Number</label>
                                                <input type="text" value={rollNumber} onChange={(event) => setRollNumber(event.target.value)} placeholder="University roll number" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                                            </div>
                                            <div className="grid gap-4 md:grid-cols-3">
                                                <div>
                                                    <label className="mb-2 block text-sm font-medium text-slate-700">Course</label>
                                                    <input type="text" value={course} onChange={(event) => setCourse(event.target.value)} placeholder="B.Tech" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                                                </div>
                                                <div>
                                                    <label className="mb-2 block text-sm font-medium text-slate-700">Branch</label>
                                                    <input type="text" value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="CSE" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                                                </div>
                                                <div>
                                                    <label className="mb-2 block text-sm font-medium text-slate-700">Semester</label>
                                                    <input type="number" min="1" max="12" value={semester} onChange={(event) => setSemester(event.target.value)} placeholder="5" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                                                </div>
                                            </div>
                                        </>
                                    ) : null}
                                </>
                            ) : null}

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@email.com" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
                                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                            </div>

                            {isTeacherSignup ? (
                                <>
                                    <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                                        <div className="mb-3 text-sm font-semibold text-slate-800">Phone Verification</div>
                                        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                                            <input type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+91 98xxxxxx12" className="campus-input rounded-[1rem] px-4 py-3" />
                                            <button type="button" onClick={handleSendOtp} className="rounded-[1rem] border border-pink-200 bg-pink-50 px-5 py-3 text-sm font-medium text-pink-700 hover:bg-pink-100 transition">
                                                Send code
                                            </button>
                                        </div>
                                        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                                            <input type="text" value={phoneOtp} onChange={(event) => setPhoneOtp(event.target.value)} placeholder="Enter verification code" className="campus-input rounded-[1rem] px-4 py-3" />
                                            <button type="button" onClick={handleVerifyOtp} className={`rounded-[1rem] px-5 py-3 text-sm font-medium transition ${phoneVerified ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                                                {phoneVerified ? '✓ Verified' : 'Verify'}
                                            </button>
                                        </div>
                                        <div className="mt-2 text-xs text-slate-400">
                                            Demo mode generates the verification code in-app so the teacher flow can be tested without an SMS provider.
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700">Employee ID</label>
                                        <input type="text" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="Employee ID" className="campus-input w-full rounded-[1rem] px-4 py-3" />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700">Employee ID Image</label>
                                        <input type="file" accept="image/*" onChange={handleTeacherImageUpload} className="block w-full rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700" />
                                        {employeeIdImageName ? <div className="mt-2 text-xs text-slate-500">Uploaded: {employeeIdImageName}</div> : null}
                                    </div>
                                </>
                            ) : null}

                            {isLogin && isAdminMode ? (
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">Admin ID</label>
                                    <input type="text" value={adminId} onChange={(event) => setAdminId(event.target.value)} placeholder="Single Admin ID" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                                </div>
                            ) : null}

                            {message ? (
                                <div className={`rounded-[1rem] px-4 py-3 text-sm ${message.startsWith('Error:') ? 'border border-red-300 bg-red-50 text-red-700' : 'border border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
                                    {message}
                                </div>
                            ) : null}

                            {!isLogin && !isAdminMode ? (
                                <button
                                    type="button"
                                    onClick={handleResendConfirmation}
                                    disabled={!canResendConfirmation || resendLoading}
                                    className="w-full rounded-[1rem] border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {resendLoading ? 'Resending confirmation...' : 'Resend confirmation email'}
                                </button>
                            ) : null}

                            {!isLogin && isAdminMode ? (
                                <div className="rounded-[1rem] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    Admin signup is disabled. The single admin account must be provisioned manually and can then log in from this screen.
                                </div>
                            ) : null}

                            <button type="submit" disabled={loading || (!isLogin && isAdminMode)} className="w-full rounded-[1rem] bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 px-5 py-3 font-semibold text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 transition disabled:cursor-not-allowed disabled:opacity-50">
                                {loading ? 'Loading...' : isLogin ? `Login as ${selectedRole}` : `Create ${selectedRole} account`}
                            </button>
                        </form>
                    )} {/* end isClubMode ternary */}

                    {!isClubMode && (
                        <p className="mt-6 text-center text-sm text-slate-500">
                            {isLogin ? "Don't have an account? " : 'Already have an account? '}
                            <button onClick={() => setIsLogin((current) => !current)} className="text-pink-500 font-semibold hover:underline">
                                {isLogin ? 'Sign Up' : 'Login'}
                            </button>
                        </p>
                    )}

                </div>
            </div>
        </div>
    );
}

function AuthPageFallback() {
    return (
        <div className="min-h-screen bg-white px-6 py-10">
            <div className="mx-auto max-w-6xl">
                <div className="auth-form-panel p-8">
                    <div className="text-sm text-slate-400">Loading auth portal...</div>
                </div>
            </div>
        </div>
    );
}

export default function AuthPage() {
    return (
        <Suspense fallback={<AuthPageFallback />}>
            <AuthPageContent />
        </Suspense>
    );
}
