'use client';

import { useCallback, useEffect, useState } from 'react';

const ROLE_COLORS = {
    student: { pill: 'bg-sky-500/10 border-sky-400/20 text-sky-600', dot: 'bg-sky-400' },
    teacher: { pill: 'bg-violet-500/10 border-violet-400/20 text-violet-700', dot: 'bg-violet-400' },
    all: { pill: 'bg-emerald-500/10 border-emerald-400/20 text-emerald-700', dot: 'bg-emerald-400' },
};

const SOURCE_LABELS = {
    admin: 'Admin Notice',
    teacher_announcement: 'Teacher Notice',
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
    const preview = isLong && !expanded ? `${notice.message.slice(0, 180)}...` : notice.message;
    const sourceLabel = SOURCE_LABELS[notice.source] || 'Notice';
    const subjectLabel = notice.subjectCode ? `${notice.subjectName} (${notice.subjectCode})` : notice.subjectName;

    return (
        <div className={`relative rounded-[1.3rem] border p-5 transition ${isNew ? 'border-sky-400/30 bg-gradient-to-br from-sky-500/10 to-transparent' : 'border-slate-200 bg-slate-50 hover:bg-white/[0.07]'}`}>
            {isNew && (
                <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-sky-600">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
                    New
                </span>
            )}
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <RolePill role={notice.target_role} />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.15em] text-slate-500">
                    {sourceLabel}
                </span>
                <span className="text-xs text-slate-400">
                    {new Date(notice.created_at).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
                </span>
            </div>
            <h4 className="text-base font-semibold leading-snug text-slate-900">{notice.title}</h4>
            {notice.source === 'teacher_announcement' ? (
                <div className="mt-2 space-y-1 text-xs text-sky-700/75">
                    <div>Sent by {notice.teacherName || 'Teacher'}</div>
                    <div>Subject: {subjectLabel || 'Subject'}</div>
                </div>
            ) : null}
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-500">{preview}</p>
            {isLong && (
                <button
                    onClick={() => setExpanded((value) => !value)}
                    className="mt-2 text-xs text-sky-400 transition hover:text-sky-600"
                >
                    {expanded ? 'Show less' : 'Read more'}
                </button>
            )}
        </div>
    );
}

export default function NoticeBoard({ role = 'student', className = '' }) {
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [seenIds, setSeenIds] = useState(() => {
        try {
            return new Set(JSON.parse(window?.localStorage?.getItem('seen-notice-ids') || '[]'));
        } catch {
            return new Set();
        }
    });

    const loadNotices = useCallback(async () => {
        setLoading(true);
        setError('');
        const res = await fetch('/api/notices', { credentials: 'same-origin' });
        const payload = await res.json().catch(() => ({ notices: [] }));
        if (!res.ok) {
            setError(payload.error || 'Failed to load notices.');
            setLoading(false);
            return;
        }
        setNotices(Array.isArray(payload.notices) ? payload.notices : []);
        setLoading(false);
    }, []);

    useEffect(() => {
        void loadNotices();
    }, [loadNotices]);

    useEffect(() => {
        if (notices.length === 0) {
            return;
        }

        const ids = notices.map((notice) => notice.id);
        const next = new Set([...seenIds, ...ids]);
        setSeenIds(next);

        try {
            window.localStorage.setItem('seen-notice-ids', JSON.stringify([...next]));
        } catch {
            // Ignore storage write issues.
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [notices]);

    const unreadCount = notices.filter((notice) => !seenIds.has(notice.id)).length;

    return (
        <div className={className ? `${className} space-y-4` : 'space-y-4'}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                        Notice Board
                        {unreadCount > 0 && (
                            <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-sky-500 px-2 py-0.5 text-xs font-bold text-slate-950">
                                {unreadCount}
                            </span>
                        )}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                        {role === 'student'
                            ? 'Admin notices and teacher announcements for your subject stream.'
                            : 'Official notices from the administration for teachers.'}
                    </p>
                </div>
                <button
                    onClick={() => void loadNotices()}
                    className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-900 transition hover:bg-slate-150"
                >
                    Refresh
                </button>
            </div>

            {error ? (
                <div className="rounded-[1.1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>
            ) : null}

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                        <div key={item} className="h-28 rounded-[1.3rem] border border-white/5 bg-slate-50 animate-pulse" />
                    ))}
                </div>
            ) : notices.length === 0 ? (
                <div className="rounded-[1.3rem] border border-dashed border-slate-200 px-4 py-12 text-center">
                    <div className="mb-3 text-3xl">Notice</div>
                    <div className="text-sm text-slate-400">No notices yet. Check back later.</div>
                </div>
            ) : (
                <div className="space-y-3">
                    {notices.map((notice) => (
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

export function NoticeBellBadge() {
    const [unread, setUnread] = useState(0);

    useEffect(() => {
        async function check() {
            try {
                const res = await fetch('/api/notices', { credentials: 'same-origin' });
                if (!res.ok) {
                    return;
                }
                const { notices = [] } = await res.json().catch(() => ({}));
                const seen = new Set(JSON.parse(window.localStorage.getItem('seen-notice-ids') || '[]'));
                setUnread(notices.filter((notice) => !seen.has(notice.id)).length);
            } catch {
                // Ignore polling failures.
            }
        }

        void check();
        const timer = setInterval(check, 60_000);
        return () => clearInterval(timer);
    }, []);

    if (unread === 0) {
        return null;
    }

    return (
        <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-sky-500 px-2 py-0.5 text-[11px] font-bold text-slate-950 animate-bounce">
            {unread}
        </span>
    );
}
