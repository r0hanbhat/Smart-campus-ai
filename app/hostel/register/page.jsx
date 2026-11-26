'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext.jsx';

export default function HostelRegistrationPage() {
    const { signUp } = useAuth();
    const [name, setName] = useState('');
    const [rollNumber, setRollNumber] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setMessage('');
        if (password.length < 8) {
            setError('Use a password with at least 8 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setError('The passwords do not match.');
            return;
        }

        setSubmitting(true);
        try {
            const { error: signUpError } = await signUp({
                name: name.trim(),
                age: null,
                email: email.trim().toLowerCase(),
                password,
                role: 'student',
                rollNumber: rollNumber.trim(),
                course: '',
                branch: '',
                semester: null,
            });
            if (signUpError) {
                throw signUpError;
            }
            setPassword('');
            setConfirmPassword('');
            setMessage('Account created. Verify your campus email using the link we sent. After verification, sign in to the Hostel Portal and submit your hostel access request. Staff must assign your block and room before you can use hostel services.');
        } catch (signUpError) {
            setError(signUpError instanceof Error ? signUpError.message : 'Unable to create your student account.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="campus-shell flex min-h-screen items-center justify-center px-4 py-10">
            <section className="campus-panel mx-auto w-full max-w-xl rounded-[2rem] p-6 sm:p-8">
                <Link href="/hostel" className="text-sm font-medium text-slate-500 hover:text-slate-900">← Hostel Portal</Link>
                <div className="mt-7 text-center">
                    <div className="campus-kicker">Hostel Services</div>
                    <h1 className="mt-3 text-3xl font-bold text-slate-900">Create a hosteller account</h1>
                    <p className="mt-3 text-sm leading-6 text-slate-600">Use your campus email. Email verification and hostel staff approval are required before hostel access is enabled.</p>
                </div>
                {error ? <p role="alert" className="mt-5 rounded-xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
                {message ? <p role="status" className="mt-5 rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">{message}</p> : null}
                <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4">
                    <label className="block text-sm font-medium text-slate-700">
                        Full name
                        <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} autoComplete="name" className="campus-input mt-2 w-full rounded-xl px-4 py-3" />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                        Roll number
                        <input value={rollNumber} onChange={(event) => setRollNumber(event.target.value)} required maxLength={64} autoComplete="username" className="campus-input mt-2 w-full rounded-xl px-4 py-3" />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                        Campus email
                        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="email" className="campus-input mt-2 w-full rounded-xl px-4 py-3" />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                        Password
                        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" className="campus-input mt-2 w-full rounded-xl px-4 py-3" />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                        Confirm password
                        <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" className="campus-input mt-2 w-full rounded-xl px-4 py-3" />
                    </label>
                    <button type="submit" disabled={submitting} className="campus-button w-full rounded-xl px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                        {submitting ? 'Creating account…' : 'Create hosteller account'}
                    </button>
                </form>
                <p className="mt-6 text-center text-sm text-slate-600">
                    Already have a student account? <Link href="/auth?role=student&mode=login" className="font-semibold text-sky-800 hover:underline">Sign in</Link>
                </p>
            </section>
        </div>
    );
}
