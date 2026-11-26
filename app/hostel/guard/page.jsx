'use client';

import { useEffect, useState } from 'react';
import EventCheckInScanner from '@/app/components/EventCheckInScanner';

const endpoint = '/api/hostel/guard/session';

export default function GuardPortal() {
    const [guard, setGuard] = useState(null);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState('');
    const [direction, setDirection] = useState('exit');
    useEffect(() => {
        let active = true;
        fetch(endpoint, { cache: 'no-store' }).then(r => r.json()).then(data => {
            if (active) setGuard(data.guard);
        }).catch(() => { if (active) setError('Could not load the guard session.'); })
            .finally(() => { if (active) setBusy(false); });
        return () => { active = false; };
    }, []);
    async function submit(event) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setError('');
        try {
            const response = await fetch(endpoint, guard ? { method: 'DELETE' } : {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setGuard(data.guard);
            setDirection('exit');
        } catch (e) { setError(e.message || 'Guard request failed.'); }
        finally { setBusy(false); }
    }
    return <main className="mx-auto max-w-xl p-6"><section className="campus-panel space-y-5 rounded-3xl p-6">
        <h1 className="text-2xl font-bold">{guard ? 'Hostel gate scanner' : 'Guard login'}</h1>
        <form onSubmit={submit} className="grid gap-4">
            {guard ? <p>Signed in as {guard}</p> : <>
                <label>Guard ID<input className="campus-input block w-full p-2" name="guardId" required autoComplete="username" /></label>
                <label>Password<input className="campus-input block w-full p-2" type="password" name="password" required autoComplete="current-password" /></label>
            </>}
            <button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-white">{guard ? 'Sign out' : 'Sign in'}</button>
        </form>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {guard && <>
            <label>Gate scan <select value={direction} onChange={e => setDirection(e.target.value)} className="campus-input p-2">
                <option value="exit">Exit</option><option value="entry">Entry</option></select></label>
            <EventCheckInScanner key={direction} gateDirection={direction} />
        </>}
    </section></main>;
}
