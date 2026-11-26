'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const button = 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

async function gate(body) {
    const response = await fetch('/api/hostel/gate', body ? {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    } : { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Gate request failed.');
    return data;
}

export function PassButton({ leaveId, outstanding }) {
    const [token, setToken] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    async function issue() {
        setBusy(true);
        setError('');
        try {
            const data = await gate({ action: 'issue', leaveId });
            setToken(data.token);
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    }
    return <div className="my-3 space-y-3">
        <button type="button" className={button} disabled={busy} onClick={issue}>
            {outstanding ? 'Show return QR' : leaveId ? 'Generate leave pass' : 'Generate daily pass'}
        </button>
        {token && <figure className="w-fit rounded-xl border bg-white p-4">
            <QRCodeSVG value={token} size={180} marginSize={4} />
            <figcaption className="text-center text-sm">Show at exit and entry</figcaption>
        </figure>}
        {error && <p role="alert">{error}</p>}
    </div>;
}

export function HostelGatePanel({ warden }) {
    const [settings, setSettings] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        let active = true;
        async function refresh() {
            try { const data = await gate(); if (active) { setSettings(data); setError(''); } }
            catch (e) { if (active) setError(e.message); }
        }
        void refresh();
        const timer = setInterval(refresh, 10000);
        return () => { active = false; clearInterval(timer); };
    }, []);
    async function toggle() {
        setSaving(true);
        try { setSettings(await gate({ action: 'toggle', enabled: !settings.enabled })); setError(''); }
        catch (e) { setError(e.message); }
        finally { setSaving(false); }
    }
    return <section className="campus-panel space-y-4 rounded-3xl p-6">
        <h2 className="text-xl font-bold">Daily outpasses</h2>
        {settings && <p>Daily outpasses are <strong>{settings.enabled ? 'on' : 'off'}</strong> for all hostel blocks.</p>}
        {warden ? <>
            <button type="button" role="switch" aria-label="Allow daily outpasses for all hostel blocks"
                aria-checked={Boolean(settings?.enabled)} disabled={!settings || saving} className={button} onClick={toggle}>
                {settings?.enabled ? 'Switch daily outpasses off' : 'Switch daily outpasses on'}
            </button>
        </> : (settings?.enabled || settings?.outstanding) && <PassButton outstanding={settings.outstanding} />}
        {!warden && settings?.history?.length > 0 && <section>
            <h3 className="font-semibold">Daily pass scans</h3>
            <ul className="divide-y">{settings.history.map(scan => <li key={scan.pass_day} className="py-2">
                <p>Exit · {new Date(scan.exited_at).toLocaleString()}</p>
                <p>Entry · {scan.entered_at ? new Date(scan.entered_at).toLocaleString() : 'Awaiting return'}</p>
            </li>)}</ul>
        </section>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
    </section>;
}
