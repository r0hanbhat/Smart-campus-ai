'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import HostelMaintenancePanel from './HostelMaintenancePanel.jsx';
import HostelMessPanel from './HostelMessPanel.jsx';
import HostelOutpassPanel from './HostelOutpassPanel.jsx';
import FacilityBookingPanel from './FacilityBookingPanel.jsx';
import HostelAccessRequestPanel from './HostelAccessRequestPanel.jsx';
import HostelRegistrationRequestsPanel from './HostelRegistrationRequestsPanel.jsx';
import HostelSectionTabs from './HostelSectionTabs.jsx';

function PortalCard({ children }) {
    return <div className="campus-panel mx-auto w-full max-w-4xl rounded-[2rem] p-6 sm:p-8">{children}</div>;
}

function HostelServiceTabs() {
    const [activeService, setActiveService] = useState('outpass');

    return (
        <div className="space-y-4">
            <HostelSectionTabs
                label="Hostel service requests"
                sections={[
                    { id: 'outpass', label: 'Leave & outpass requests' },
                    { id: 'maintenance', label: 'Maintenance requests' },
                ]}
                activeSection={activeService}
                onSelect={setActiveService}
            />
            {activeService === 'outpass' ? <HostelOutpassPanel /> : <HostelMaintenancePanel />}
        </div>
    );
}

function HostelExperienceTabs({ includeFacilities = false }) {
    const [activeSection, setActiveSection] = useState('dining');

    return (
        <div className="space-y-4">
            <HostelSectionTabs
                label="Hostel sections"
                sections={[
                    { id: 'dining', label: 'Hostel dining' },
                    { id: 'services', label: 'Hostel services' },
                    ...(includeFacilities ? [{ id: 'facilities', label: 'Hostel facilities' }] : []),
                ]}
                activeSection={activeSection}
                onSelect={setActiveSection}
            />

            {activeSection === 'dining' ? <HostelMessPanel /> : activeSection === 'facilities' && includeFacilities ? (
                <FacilityBookingPanel scope="hostel" />
            ) : (
                <HostelServiceTabs />
            )}
        </div>
    );
}

function HostelPortalContent() {
    const { user, loading: authLoading, signOut } = useAuth();
    const [activeRole, setActiveRole] = useState('hosteller');
    const [activeWardenSection, setActiveWardenSection] = useState('residents');
    const [wardenId, setWardenId] = useState('');
    const [rollNumber, setRollNumber] = useState('');
    const [password, setPassword] = useState('');
    const [passcode, setPasscode] = useState('');
    const [portalSession, setPortalSession] = useState(null);
    const [pageLoading, setPageLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const loadPortalSession = useCallback(async () => {
        setPageLoading(true);
        setError('');
        try {
            const wardenResponse = await fetch('/api/hostel/warden/session', { credentials: 'same-origin' });
            if (wardenResponse.ok) {
                const payload = await wardenResponse.json();
                setPortalSession({ kind: 'warden', ...payload });
                setPageLoading(false);
                return;
            }

            const residentResponse = await fetch('/api/hostel/resident', { credentials: 'same-origin' });
            if (residentResponse.ok) {
                const payload = await residentResponse.json();
                setPortalSession({ kind: 'hosteller', ...payload });
            } else if (residentResponse.status === 404) {
                setPortalSession({ kind: 'unassigned' });
                const payload = await residentResponse.json();
                setError(payload.error || 'No hostel assignment is linked to this account.');
            } else {
                setPortalSession(null);
            }
        } catch (loadError) {
            setPortalSession(null);
            setError(loadError instanceof Error ? loadError.message : 'Unable to load the hostel portal.');
        } finally {
            setPageLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading) {
            void loadPortalSession();
        }
    }, [authLoading, loadPortalSession, user?.id]);

    const handleLogin = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            const isWarden = activeRole === 'warden';
            const response = await fetch(
                isWarden ? '/api/hostel/warden/login' : '/api/hostel/hosteller/login',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify(isWarden
                        ? { wardenId: wardenId.trim(), passcode }
                        : { rollNumber: rollNumber.trim(), password }),
                }
            );
            const payload = await response.json().catch(() => ({ error: 'Unable to sign in.' }));
            if (!response.ok) {
                throw new Error(payload.error || 'Unable to sign in.');
            }
            setPassword('');
            setPasscode('');
            if (!isWarden) {
                window.location.assign('/hostel');
                return;
            }
            await loadPortalSession();
        } catch (loginError) {
            setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleLogout = async () => {
        setSubmitting(true);
        setError('');
        try {
            if (portalSession?.kind === 'warden') {
                const response = await fetch('/api/hostel/warden/login', {
                    method: 'DELETE',
                    credentials: 'same-origin',
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({ error: 'Unable to sign out.' }));
                    throw new Error(payload.error || 'Unable to sign out.');
                }
            } else {
                await signOut();
            }
            setPortalSession(null);
        } catch (logoutError) {
            setError(logoutError instanceof Error ? logoutError.message : 'Unable to sign out.');
        } finally {
            setSubmitting(false);
        }
    };

    if (authLoading || pageLoading) {
        return (
            <div className="campus-shell flex min-h-screen items-center justify-center px-4">
                <p className="text-sm text-slate-600">Loading hostel portal…</p>
            </div>
        );
    }

    if (portalSession?.kind === 'warden') {
        return (
            <div className="campus-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-6xl space-y-6">
                    <PortalCard>
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="campus-kicker">Warden Portal</div>
                                <h1 className="mt-3 text-3xl font-bold text-slate-900">Welcome, {portalSession.warden.displayName}</h1>
                                <p className="mt-2 text-sm text-slate-500">Warden ID: {portalSession.warden.wardenId}</p>
                            </div>
                            <button onClick={handleLogout} disabled={submitting} className="rounded-full border border-red-300/30 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-500/15 disabled:opacity-50">
                                {submitting ? 'Signing out…' : 'Sign out'}
                            </button>
                        </div>
                    </PortalCard>
                    <HostelSectionTabs
                        label="Warden hostel sections"
                        sections={[
                            { id: 'residents', label: 'Residents & requests' },
                            { id: 'dining', label: 'Hostel dining' },
                            { id: 'services', label: 'Hostel services' },
                        ]}
                        activeSection={activeWardenSection}
                        onSelect={setActiveWardenSection}
                    />
                    {activeWardenSection === 'residents' ? (
                        <>
                            <HostelRegistrationRequestsPanel />
                            {portalSession.blocks.length === 0 ? (
                                <PortalCard>
                                    <h2 className="text-xl font-semibold text-slate-900">No blocks assigned</h2>
                                    <p className="mt-2 text-sm text-slate-500">Contact the hostel administrator to assign your block access.</p>
                                </PortalCard>
                            ) : portalSession.blocks.map((block) => (
                                <PortalCard key={block.id}>
                                    <div className="flex flex-wrap items-end justify-between gap-3">
                                        <div>
                                            <div className="campus-kicker">Assigned Block</div>
                                            <h2 className="mt-2 text-2xl font-bold text-slate-900">{block.name}</h2>
                                        </div>
                                        <span className="rounded-full bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-800">
                                            {block.residents.length} hostellers
                                        </span>
                                    </div>
                                    <div className="mt-5 overflow-x-auto">
                                        {block.residents.length === 0 ? (
                                            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-7 text-center text-sm text-slate-500">No hostellers are assigned to this block yet.</p>
                                        ) : (
                                            <table className="w-full min-w-[28rem] text-left text-sm">
                                                <thead className="text-xs uppercase tracking-wide text-slate-500">
                                                    <tr><th className="px-3 py-2">Roll number</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Room</th></tr>
                                                </thead>
                                                <tbody>
                                                    {block.residents.map((resident) => (
                                                        <tr key={`${resident.rollNumber}-${resident.roomNumber}`} className="border-t border-slate-200">
                                                            <td className="px-3 py-3 font-medium text-slate-900">{resident.rollNumber}</td>
                                                            <td className="px-3 py-3 text-slate-700">{resident.name}</td>
                                                            <td className="px-3 py-3 text-slate-700">{resident.roomNumber}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </PortalCard>
                            ))}
                        </>
                    ) : activeWardenSection === 'dining' ? (
                        <HostelMessPanel />
                    ) : (
                        <HostelServiceTabs />
                    )}
                    <Link href="/" className="inline-flex text-sm font-medium text-sky-800 hover:underline">Back to Smart Campus</Link>
                </div>
            </div>
        );
    }

    if (portalSession?.kind === 'hosteller') {
        const resident = portalSession.resident;
        return (
            <div className="campus-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl space-y-6">
                    <PortalCard>
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="campus-kicker">Hosteller Portal</div>
                                <h1 className="mt-3 text-3xl font-bold text-slate-900">Welcome, {resident.name}</h1>
                                <p className="mt-2 text-sm text-slate-500">Roll number: {resident.rollNumber}</p>
                            </div>
                            <button onClick={handleLogout} disabled={submitting} className="rounded-full border border-red-300/30 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-500/15 disabled:opacity-50">
                                {submitting ? 'Signing out…' : 'Sign out'}
                            </button>
                        </div>
                    </PortalCard>
                    <PortalCard>
                        <div className="campus-kicker">Your Hostel Assignment</div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-white/70 p-5">
                                <div className="text-xs uppercase tracking-wide text-slate-500">Block</div>
                                <div className="mt-2 text-xl font-semibold text-slate-900">{resident.blockName}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white/70 p-5">
                                <div className="text-xs uppercase tracking-wide text-slate-500">Room</div>
                                <div className="mt-2 text-xl font-semibold text-slate-900">{resident.roomNumber}</div>
                            </div>
                        </div>
                    </PortalCard>
                    <HostelExperienceTabs includeFacilities />
                    <Link href="/" className="inline-flex text-sm font-medium text-sky-800 hover:underline">Back to Smart Campus</Link>
                </div>
            </div>
        );
    }

    if (
        (portalSession?.kind === 'unassigned' && user?.id)
        || (portalSession === null && user?.user_metadata?.role === 'student')
    ) {
        return (
            <div className="campus-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl space-y-6">
                    <PortalCard>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <div className="campus-kicker">Hostel Portal</div>
                                <h1 className="mt-3 text-3xl font-bold text-slate-900">No hostel assignment yet</h1>
                                <p className="mt-2 text-sm text-slate-600">Request hostel access with your verified student account. Hostel staff will assign your block and room.</p>
                            </div>
                            <button onClick={handleLogout} disabled={submitting} className="rounded-full border border-red-300/30 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-500/15 disabled:opacity-50">
                                {submitting ? 'Signing out…' : 'Sign out'}
                            </button>
                        </div>
                    </PortalCard>
                    <HostelAccessRequestPanel />
                    <Link href="/" className="inline-flex text-sm font-medium text-sky-800 hover:underline">Back to Smart Campus</Link>
                </div>
            </div>
        );
    }

    const isAdmin = user?.user_metadata?.role === 'admin';
    return (
        <div className="campus-shell min-h-screen px-4 py-10 sm:px-6 lg:px-8">
            <PortalCard>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900">← Smart Campus</Link>
                    {isAdmin ? <Link href="/hostel/admin" className="rounded-full border border-sky-300/50 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-900 hover:bg-sky-500/15">Manage Hostel</Link> : null}
                </div>
                <div className="mt-8 text-center">
                    <div className="campus-kicker">Hostel Services</div>
                    <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Hostel Portal</h1>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">Sign in to view your hostel assignment or the residents of your assigned blocks.</p>
                </div>
                <div className="mx-auto mt-7 grid max-w-xl grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
                    {[
                        { id: 'hosteller', label: 'Hosteller' },
                        { id: 'warden', label: 'Warden' },
                    ].map((role) => (
                        <button
                            key={role.id}
                            type="button"
                            onClick={() => { setActiveRole(role.id); setError(''); }}
                            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${activeRole === role.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            {role.label} Login
                        </button>
                    ))}
                </div>
                {error ? <div role="alert" className="mx-auto mt-5 max-w-xl rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                <form onSubmit={handleLogin} className="mx-auto mt-6 max-w-xl space-y-4">
                    {activeRole === 'warden' ? (
                        <>
                            <label className="block text-sm font-medium text-slate-700">
                                Warden ID
                                <input autoComplete="username" value={wardenId} onChange={(event) => setWardenId(event.target.value)} required className="campus-input mt-2 w-full rounded-xl px-4 py-3" placeholder="Enter your assigned Warden ID" />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                                Passcode
                                <input type="password" autoComplete="current-password" value={passcode} onChange={(event) => setPasscode(event.target.value)} required className="campus-input mt-2 w-full rounded-xl px-4 py-3" placeholder="Enter your passcode" />
                            </label>
                        </>
                    ) : (
                        <>
                            <label className="block text-sm font-medium text-slate-700">
                                Roll number
                                <input autoComplete="username" value={rollNumber} onChange={(event) => setRollNumber(event.target.value)} required className="campus-input mt-2 w-full rounded-xl px-4 py-3" placeholder="Enter your university roll number" />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                                Password
                                <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required className="campus-input mt-2 w-full rounded-xl px-4 py-3" placeholder="Your student account password" />
                            </label>
                        </>
                    )}
                    <button type="submit" disabled={submitting} className="campus-button w-full rounded-xl px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                        {submitting ? 'Signing in…' : `Sign in as ${activeRole === 'warden' ? 'Warden' : 'Hosteller'}`}
                    </button>
                </form>
                {portalSession?.kind === 'unassigned' ? (
                    <p className="mx-auto mt-5 max-w-xl text-center text-sm text-amber-800">{error}</p>
                ) : null}
                <div className="mt-7 flex flex-wrap justify-center gap-5 text-sm">
                    {activeRole === 'hosteller' ? <Link href="/hostel/register" className="font-semibold text-pink-700 hover:underline">Create hosteller account</Link> : null}
                    <Link href="/auth?role=student&mode=login" className="font-medium text-sky-800 hover:underline">Student login</Link>
                    <Link href="/auth?role=admin&mode=login" className="font-medium text-slate-600 hover:underline">Admin login</Link>
                </div>
            </PortalCard>
        </div>
    );
}

export default function HostelPortal() {
    return <HostelPortalContent />;
}
