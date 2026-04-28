'use client';

import { useCallback, useEffect, useState } from 'react';

const ROLE_COLORS = {
    student: { pill: 'bg-cyan-500/10 border-cyan-400/20 text-cyan-300', dot: 'bg-cyan-400' },
    teacher: { pill: 'bg-violet-500/10 border-violet-400/20 text-violet-300', dot: 'bg-violet-400' },
    all: { pill: 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300', dot: 'bg-emerald-400' },
};

function RolePill({ role }) {
    const colors = ROLE_COLORS[role] || ROLE_COLORS.all;
    const label = role === 'all' ? 'Everyone' : role === 'teacher' ? 'Teachers' : 'Students';
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.15em] ${colors.pill}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors.dot}`} />
            {label}
        </span>
    );
}

function NoticeCard({ notice, isNew }) {
    const [expanded, setExpanded] = useState(false);
    const isLong = notice.message.length > 180;
    const preview = isLong && !expanded ? `${notice.message.slice(0, 180)}…` : notice.message;

    return (
        <div className={`relative rounded-[1.3rem] border p-5 transition ${isNew ? 'border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-transparent' : 'border-white/10 bg-white/5 hover:bg-white/[0.07]'}`}>
            {isNew && (
                <span className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-cyan-500/20 border border-cyan-400/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    New
                </span>
            )}
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <RolePill role={notice.target_role} />
                <span className="text-xs text-white/40">
                    {new Date(notice.created_at).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
                </span>
            </div>
            <h4 className="text-base font-semibold text-white leading-snug">{notice.title}</h4>
            <p className="mt-2 text-sm leading-6 text-white/65 whitespace-pre-wrap">{preview}</p>
            {isLong && (
                <button
                    onClick={() => setExpanded(v => !v)}
                    className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition"
                >
                    {expanded ? 'Show less ↑' : 'Read more ↓'}
                </button>
            )}
        </div>
    );
}

export default function NoticeBoard({ role = 'student' }) {
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [seenIds, setSeenIds] = useState(() => {
        try { return new Set(JSON.parse(window?.localStorage?.getItem('seen-notice-ids') || '[]')); }
        catch { return new Set(); }
    });

    const loadNotices = useCallback(async () => {
        setLoading(true);
        setError('');
        const res = await fetch('/api/notices', { credentials: 'same-origin' });
        const payload = await res.json().catch(() => ({ notices: [] }));
        if (!res.ok) { setError(payload.error || 'Failed to load notices.'); setLoading(false); return; }
        const fetched = Array.isArray(payload.notices) ? payload.notices : [];
        setNotices(fetched);
        setLoading(false);
    }, []);

    useEffect(() => { void loadNotices(); }, [loadNotices]);

    // Mark all as seen when the board is viewed
    useEffect(() => {
        if (notices.length === 0) return;
        const ids = notices.map(n => n.id);
        const next = new Set([...seenIds, ...ids]);
        setSeenIds(next);
        try { window.localStorage.setItem('seen-notice-ids', JSON.stringify([...next])); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [notices]);

    const unreadCount = notices.filter(n => !seenIds.has(n.id)).length;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        📋 Notice Board
                        {unreadCount > 0 && (
                            <span className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-2 py-0.5 text-xs font-bold text-slate-950 min-w-[22px]">
                                {unreadCount}
                            </span>
                        )}
                    </h3>
                    <p className="mt-1 text-sm text-white/55">
                        {role === 'student' ? 'Notices from the administration for students.' : 'Notices from the administration for teachers.'}
                    </p>
                </div>
                <button
                    onClick={() => void loadNotices()}
                    className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 transition"
                >
                    Refresh
                </button>
            </div>

            {error && (
                <div className="rounded-[1.1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
            )}

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="rounded-[1.3rem] border border-white/5 bg-white/5 h-28 animate-pulse" />
                    ))}
                </div>
            ) : notices.length === 0 ? (
                <div className="rounded-[1.3rem] border border-dashed border-white/10 px-4 py-12 text-center">
                    <div className="text-3xl mb-3">📭</div>
                    <div className="text-sm text-white/45">No notices yet. Check back later.</div>
                </div>
            ) : (
                <div className="space-y-3">
                    {notices.map(notice => (
                        <NoticeCard
                            key={notice.id}
                            notice={notice}
                            isNew={!seenIds.has(notice.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/** Compact notification bell badge — shows unread count */
export function NoticeBellBadge() {
    const [unread, setUnread] = useState(0);

    useEffect(() => {
        async function check() {
            try {
                const res = await fetch('/api/notices', { credentials: 'same-origin' });
                if (!res.ok) return;
                const { notices = [] } = await res.json().catch(() => ({}));
                const seen = new Set(JSON.parse(window.localStorage.getItem('seen-notice-ids') || '[]'));
                setUnread(notices.filter(n => !seen.has(n.id)).length);
            } catch { /* ignore */ }
        }
        void check();
        const timer = setInterval(check, 60_000); // poll every 60s
        return () => clearInterval(timer);
    }, []);

    if (unread === 0) return null;
    return (
        <span className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-2 py-0.5 text-[11px] font-bold text-slate-950 min-w-[20px] animate-bounce">
            {unread}
        </span>
    );
}
