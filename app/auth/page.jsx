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
        accent: 'from-sky-400 to-cyan-300',
        loginLabel: 'Student Login',
        signupLabel: 'Student Signup',
    },
    teacher: {
        badge: 'Teacher Portal',
        title: 'Manage classes after verification approval',
        description: 'Teachers can sign up with an email, phone verification, and employee ID. Approved accounts get the teacher dashboard after login.',
        accent: 'from-emerald-400 to-lime-300',
        loginLabel: 'Teacher Login',
        signupLabel: 'Teacher Signup',
    },
    admin: {
        badge: 'Admin Portal',
        title: 'Review teachers and monitor the system',
        description: 'The admin account signs in with email, password, and the assigned Admin ID. Public admin signup stays disabled.',
        accent: 'from-amber-300 to-orange-300',
        loginLabel: 'Admin Login',
        signupLabel: 'Admin Setup Only',
    },
    club: {
        badge: 'Club Portal',
        title: 'Submit and track event proposals',
        description: 'Clubs sign in with their unique Club Login ID and password. Events go through coordinator and admin approval before being published.',
        accent: 'from-purple-400 to-fuchsia-300',
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
    const [message, setMessage] = useState('');
    const { signIn, signUp, signOut } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedPortal = ROLE_PORTAL_COPY[selectedRole] || ROLE_PORTAL_COPY.student;

    const isTeacherSignup = !isLogin && selectedRole === 'teacher';
    const isAdminMode = selectedRole === 'admin';
    const isClubMode = selectedRole === 'club';

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
                else if (selectedRole === 'teacher' && data.user?.user_metadata?.role !== 'teacher') {
                    await signOut();
                    setMessage('Error: ' + ROLE_MISMATCH_MESSAGES.teacher);
                }
                else if (selectedRole === 'student' && data.user?.user_metadata?.role !== 'student') {
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
            else if (selectedRole === 'teacher') {
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
                }));
                setMessage('Teacher signup submitted. After email verification and login, your approval request will appear in the admin portal.');
            }
            else {
                setMessage('Check your email to confirm your account.');
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
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 px-6 py-10">
            <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="campus-panel-strong rounded-[2rem] p-8 text-white">
                    <div className="campus-kicker">Access Control</div>
                    <h1 className="mt-3 text-4xl font-bold">Smart Campus AI</h1>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-white/65">
                        Student, teacher, and admin access now follow different rules. Students can sign up directly, teacher accounts enter a verification queue, and the single admin account signs in with its assigned Admin ID.
                    </p>

                    <div className="mt-8 grid gap-4">
                        <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-5">
                            <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Teacher Signup Requirements</div>
                            <div className="mt-3 space-y-2 text-sm text-white/75">
                                <div>Email verification</div>
                                <div>Phone number verification</div>
                                <div>Employee ID and ID image upload</div>
                                <div>Pending admin verification within 24 hours</div>
                            </div>
                        </div>
                        <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-5">
                            <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Panel Access</div>
                            <div className="mt-3 space-y-2 text-sm text-white/75">
                                <div>Students: campus planner, events, clubs, deadlines, chat</div>
                                <div>Teachers: courses, assignments, grading, progress, lesson plans, messaging</div>
                                <div>Admin: teacher review queue, users, monitoring, sessions, audit trails</div>
                                <div>Clubs: submit event proposals, track approval status</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="campus-panel rounded-[2rem] border border-white/10 bg-black/35 p-8">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-white/60">Choose the exact portal you want to open.</div>
                        <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10">
                            Back to role gateway
                        </Link>
                    </div>

                    <div className="flex gap-2 rounded-[1.2rem] border border-white/10 bg-white/5 p-2">
                        <button onClick={() => setIsLogin(true)} className={`flex-1 rounded-[1rem] px-4 py-3 text-sm font-medium transition ${isLogin ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950' : 'text-white/60'}`}>
                            Login
                        </button>
                        <button onClick={() => setIsLogin(false)} className={`flex-1 rounded-[1rem] px-4 py-3 text-sm font-medium transition ${!isLogin ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950' : 'text-white/60'}`}>
                            Sign Up
                        </button>
                    </div>

                    <div className="mt-6">
                        <div className="mb-3 text-xs uppercase tracking-[0.22em] text-white/45">Select Role</div>
                        <div className="grid grid-cols-3 gap-2 rounded-[1.2rem] border border-white/10 bg-white/5 p-2">
                            {ACCOUNT_ROLES.map((role) => {
                                const isSelected = selectedRole === role.id;
                                return (
                                    <button
                                        key={role.id}
                                        type="button"
                                        onClick={() => handleRoleChange(role.id)}
                                        className={`rounded-[1rem] px-3 py-3 text-sm font-semibold transition ${isSelected
                                            ? 'bg-gradient-to-r from-cyan-500 via-violet-400 to-fuchsia-400 text-slate-950 shadow-lg'
                                            : 'bg-transparent text-white/65 hover:bg-white/8 hover:text-white'}`}
                                    >
                                        {role.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/5 p-5 text-white">
                        <div className={`inline-flex rounded-full bg-gradient-to-r ${selectedPortal.accent} px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-950`}>
                            {selectedPortal.badge}
                        </div>
                        <h2 className="mt-3 text-2xl font-bold">{isLogin ? selectedPortal.loginLabel : selectedPortal.signupLabel}</h2>
                        <p className="mt-2 text-sm leading-7 text-white/70">{selectedPortal.title}. {selectedPortal.description}</p>
                        {isAdminMode && isLogin ? (
                            <div className="mt-4 rounded-[1rem] border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                                Admin login requires the account email, password, and the assigned Admin ID.
                            </div>
                        ) : null}
                        {selectedRole === 'teacher' && isLogin ? (
                            <div className="mt-4 rounded-[1rem] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                                Approved teachers can log in here with the same email and password used during teacher signup.
                            </div>
                        ) : null}
                    </div>

                    {/* Club login — uses separate credential system, NOT Supabase Auth */}
                    {isClubMode ? (
                        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                            <div className="rounded-[1.4rem] border border-purple-400/20 bg-purple-500/10 p-4 text-sm text-purple-100">
                                Club accounts use a separate system — not email/password. Sign in with your assigned Club Login ID and password.
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-white">Club Login ID</label>
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
                                <label className="mb-2 block text-sm font-medium text-white">Password</label>
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
                                <div className={`rounded-[1rem] px-4 py-3 text-sm ${message.startsWith('Error:') ? 'border border-red-400/30 bg-red-500/10 text-red-100' : 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-100'}`}>
                                    {message}
                                </div>
                            ) : null}
                            <button type="submit" disabled={loading} className="w-full rounded-[1rem] bg-gradient-to-r from-purple-500 to-fuchsia-400 px-5 py-3 font-semibold text-white disabled:opacity-50">
                                {loading ? 'Signing in…' : 'Sign in as Club'}
                            </button>
                        </form>
                    ) : (
                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                        {!isLogin ? (
                            <>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-white">Name</label>
                                    <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-white">Age</label>
                                    <input type="number" min="1" value={age} onChange={(event) => setAge(event.target.value)} placeholder="Your age" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                                </div>
                                {selectedRole === 'student' ? (
                                    <>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-white">Roll Number</label>
                                            <input type="text" value={rollNumber} onChange={(event) => setRollNumber(event.target.value)} placeholder="University roll number" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-3">
                                            <div>
                                                <label className="mb-2 block text-sm font-medium text-white">Course</label>
                                                <input type="text" value={course} onChange={(event) => setCourse(event.target.value)} placeholder="B.Tech" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                                            </div>
                                            <div>
                                                <label className="mb-2 block text-sm font-medium text-white">Branch</label>
                                                <input type="text" value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="CSE" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                                            </div>
                                            <div>
                                                <label className="mb-2 block text-sm font-medium text-white">Semester</label>
                                                <input type="number" min="1" max="12" value={semester} onChange={(event) => setSemester(event.target.value)} placeholder="5" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                                            </div>
                                        </div>
                                    </>
                                ) : null}
                            </>
                        ) : null}

                        <div>
                            <label className="mb-2 block text-sm font-medium text-white">Email</label>
                            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@email.com" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-white">Password</label>
                            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                        </div>

                        {isTeacherSignup ? (
                            <>
                                <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                                    <div className="mb-3 text-sm font-semibold text-white">Phone Verification</div>
                                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                                        <input type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+91 98xxxxxx12" className="campus-input rounded-[1rem] px-4 py-3" />
                                        <button type="button" onClick={handleSendOtp} className="rounded-[1rem] border border-white/10 bg-white/10 px-5 py-3 text-sm font-medium text-white">
                                            Send code
                                        </button>
                                    </div>
                                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                                        <input type="text" value={phoneOtp} onChange={(event) => setPhoneOtp(event.target.value)} placeholder="Enter verification code" className="campus-input rounded-[1rem] px-4 py-3" />
                                        <button type="button" onClick={handleVerifyOtp} className={`rounded-[1rem] px-5 py-3 text-sm font-medium ${phoneVerified ? 'bg-emerald-500/20 text-emerald-100' : 'border border-white/10 bg-white/10 text-white'}`}>
                                            {phoneVerified ? 'Verified' : 'Verify'}
                                        </button>
                                    </div>
                                    <div className="mt-2 text-xs text-white/45">
                                        Demo mode generates the verification code in-app so the teacher flow can be tested without an SMS provider.
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-white">Employee ID</label>
                                    <input type="text" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="Employee ID" className="campus-input w-full rounded-[1rem] px-4 py-3" />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-white">Employee ID Image</label>
                                    <input type="file" accept="image/*" onChange={handleTeacherImageUpload} className="block w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white" />
                                    {employeeIdImageName ? <div className="mt-2 text-xs text-white/55">Uploaded: {employeeIdImageName}</div> : null}
                                </div>
                            </>
                        ) : null}

                        {isLogin && isAdminMode ? (
                            <div>
                                <label className="mb-2 block text-sm font-medium text-white">Admin ID</label>
                                <input type="text" value={adminId} onChange={(event) => setAdminId(event.target.value)} placeholder="Single Admin ID" className="campus-input w-full rounded-[1rem] px-4 py-3" required />
                            </div>
                        ) : null}

                        {message ? (
                            <div className={`rounded-[1rem] px-4 py-3 text-sm ${message.startsWith('Error:') ? 'border border-red-400/30 bg-red-500/10 text-red-100' : 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-100'}`}>
                                {message}
                            </div>
                        ) : null}

                        {!isLogin && isAdminMode ? (
                            <div className="rounded-[1rem] border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                                Admin signup is disabled. The single admin account must be provisioned manually and can then log in from this screen.
                            </div>
                        ) : null}

                        <button type="submit" disabled={loading || (!isLogin && isAdminMode)} className="w-full rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
                            {loading ? 'Loading...' : isLogin ? `Login as ${selectedRole}` : `Create ${selectedRole} account`}
                        </button>
                    </form>
                    )} {/* end isClubMode ternary */}

                    {!isClubMode && (
                    <p className="mt-6 text-center text-sm text-white/60">
                        {isLogin ? "Don't have an account? " : 'Already have an account? '}
                        <button onClick={() => setIsLogin((current) => !current)} className="text-cyan-300 hover:underline">
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
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 px-6 py-10">
            <div className="mx-auto max-w-6xl">
                <div className="campus-panel rounded-[2rem] border border-white/10 bg-black/35 p-8 text-white">
                    <div className="text-sm text-white/60">Loading auth portal...</div>
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
