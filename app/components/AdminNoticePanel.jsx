'use client';

import { useCallback, useEffect, useState } from 'react';

const ROLE_OPTIONS = [
    { value: 'student', label: 'Students only', color: 'text-cyan-300', bg: 'bg-cyan-500/10 border-cyan-400/20' },
    { value: 'teacher', label: 'Teachers only', color: 'text-violet-300', bg: 'bg-violet-500/10 border-violet-400/20' },
    { value: 'all', label: 'Everyone', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-400/20' },
];

function RoleBadge({ role }) {
    const opt = ROLE_OPTIONS.find(o => o.value === role) || ROLE_OPTIONS[2];
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${opt.bg} ${opt.color}`}>
            {opt.label}
        </span>
    );
}

function NoticeCard({ notice, onDelete }) {
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!window.confirm('Delete this notice?')) return;
        setDeleting(true);
        await onDelete(notice.id);
        setDeleting(false);
    };

    return (
        <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-5 transition hover:bg-white/[0.07]">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                        <RoleBadge role={notice.target_role} />
                        <span className="text-xs text-white/40">
                            {new Date(notice.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                    </div>
                    <div className="font-semibold text-white text-base">{notice.title}</div>
                    <div className="mt-2 text-sm leading-6 text-white/65 whitespace-pre-wrap">{notice.message}</div>
                </div>
                <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="shrink-0 rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-50 transition"
                >
                    {deleting ? 'Deleting…' : 'Delete'}
                </button>
            </div>
        </div>
    );
}

export default function AdminNoticePanel() {
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [form, setForm] = useState({ title: '', message: '', targetRole: 'student' });
    const [result, setResult] = useState(null); // { success, recipientCount, emailsSent, emailError }
    const [error, setError] = useState('');

    const loadNotices = useCallback(async () => {
        setLoading(true);
        const res = await fetch('/api/admin/notices', { credentials: 'same-origin' });
        const payload = await res.json().catch(() => ({}));
        setNotices(Array.isArray(payload.notices) ? payload.notices : []);
        setLoading(false);
    }, []);

    useEffect(() => { void loadNotices(); }, [loadNotices]);

    const handlePost = async () => {
        if (!form.title.trim() || !form.message.trim()) {
            setError('Please enter both a title and message.');
            return;
        }
        setPosting(true);
        setError('');
        setResult(null);

        const res = await fetch('/api/admin/notices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                title: form.title.trim(),
                message: form.message.trim(),
                targetRole: form.targetRole,
            }),
        });
        const payload = await res.json().catch(() => ({ error: 'Request failed.' }));
        setPosting(false);

        if (!res.ok) {
            setError(payload.error || 'Failed to post notice.');
            return;
        }

        setResult({ ...payload, targetRole: form.targetRole });

        // Trigger browser push notification for the admin
        if (payload.pushNotification && 'Notification' in window) {
            try {
                const permission = Notification.permission === 'granted'
                    ? 'granted'
                    : await Notification.requestPermission();
                if (permission === 'granted') {
                    new Notification(payload.pushNotification.title, {
                        body: payload.pushNotification.body,
                        icon: '/favicon.ico',
                    });
                }
            } catch { /* ignore — notification not critical */ }
        }

        setForm({ title: '', message: '', targetRole: 'student' });
        void loadNotices();
    };


    const handleDelete = async (id) => {
        await fetch('/api/admin/notices', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ id }),
        });
        void loadNotices();
    };

    return (
        <div className="space-y-6">
            {/* Compose */}
            <div className="campus-panel-strong rounded-[2rem] p-6">
                <div className="mb-5">
                    <h3 className="text-2xl font-bold text-white">📢 Post a Notice</h3>
                    <p className="mt-1 text-sm text-white/55">
                        Select an audience, write your notice, and hit Publish — emails are sent automatically to all registered users in that group.
                    </p>
                </div>

                {/* Audience selector */}
                <div className="flex flex-wrap gap-2 mb-5">
                    {ROLE_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setForm(f => ({ ...f, targetRole: opt.value }))}
                            className={`rounded-full border px-5 py-2.5 text-sm font-medium transition ${
                                form.targetRole === opt.value
                                    ? `${opt.bg} ${opt.color} scale-[1.03] shadow-lg`
                                    : 'border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            {opt.value === 'student' ? '🎓 ' : opt.value === 'teacher' ? '👩‍🏫 ' : '🌐 '}{opt.label}
                        </button>
                    ))}
                </div>

                <div className="space-y-3">
                    <input
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Notice title (e.g. Exam Schedule Update)"
                        className="campus-input w-full rounded-[1rem] px-4 py-3"
                        maxLength={200}
                    />
                    <textarea
                        value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        placeholder="Write the notice content here…"
                        className="campus-input w-full min-h-32 rounded-[1rem] px-4 py-3 resize-y"
                        maxLength={5000}
                    />
                </div>

                {error && (
                    <div className="mt-3 rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {error}
                    </div>
                )}

                {result && (
                    <div className="mt-3 rounded-[1rem] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                        ✅ Notice posted successfully.
                        {' '}{result.emailsSent > 0
                            ? `Emails sent to ${result.emailsSent} ${result.targetRole === 'all' ? 'user(s)' : `${result.targetRole}(s)`}.`
                            : result.recipientCount === 0
                                ? 'No registered users found in this group yet — check that users have signed up with the correct role.'
                                : `Found ${result.recipientCount} user(s) but emails could not be sent — check GMAIL credentials.`}
                        {result.emailError && <span className="block mt-1 text-amber-300">Email warning: {result.emailError}</span>}
                    </div>
                )}

                <button
                    onClick={() => void handlePost()}
                    disabled={posting || !form.title.trim() || !form.message.trim()}
                    className="mt-4 rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50 transition hover:scale-[1.02] active:scale-100"
                >
                    {posting ? 'Publishing…' : '📨 Publish Notice'}
                </button>
            </div>

            {/* History */}
            <div className="campus-panel rounded-[1.8rem] p-6">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h4 className="text-xl font-bold text-white">Notice History</h4>
                        <p className="mt-1 text-sm text-white/55">{notices.length} notice{notices.length === 1 ? '' : 's'} posted</p>
                    </div>
                    <button
                        onClick={() => void loadNotices()}
                        className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 transition"
                    >
                        Refresh
                    </button>
                </div>
                {loading ? (
                    <div className="rounded-[1.2rem] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
                        Loading notices…
                    </div>
                ) : notices.length === 0 ? (
                    <div className="rounded-[1.2rem] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
                        No notices posted yet. Use the form above to publish your first notice.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {notices.map(notice => (
                            <NoticeCard key={notice.id} notice={notice} onDelete={handleDelete} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
