'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { buildInboxItems, readInboxReadKeys, writeInboxReadKeys } from '@/lib/smart-campus/inbox.js';

const EMPTY_SOURCES = {
    notices: [],
    registeredEvents: [],
    hostelAnnouncements: [],
    chatNotifications: [],
};

async function loadEndpoint(url, label, ignoreForbidden = false) {
    try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (ignoreForbidden && response.status === 403) {
            return { data: [], error: '' };
        }
        if (!response.ok) {
            return { data: [], error: `${label}: ${payload.error || response.statusText}` };
        }
        return { data: payload, error: '' };
    } catch (error) {
        return {
            data: {},
            error: `${label}: ${error instanceof Error ? error.message : 'Unable to load this source.'}`,
        };
    }
}

function formatTimestamp(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'Date unavailable'
        : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function UnifiedInbox({
    userId,
    reminders,
    deadlines,
    issues,
    supabase,
    onSelectTab,
    onOpenChat,
    onUnreadCountChange,
}) {
    const [sources, setSources] = useState(EMPTY_SOURCES);
    const [readKeys, setReadKeys] = useState([]);
    const [sourceErrors, setSourceErrors] = useState([]);
    const [storageError, setStorageError] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshVersion, setRefreshVersion] = useState(0);

    useEffect(() => {
        setReadKeys(readInboxReadKeys(userId));
    }, [userId]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setSourceErrors([]);

        const loadSources = async () => {
            const [noticesResult, eventsResult, hostelResult, chatResult] = await Promise.all([
                loadEndpoint('/api/notices', 'Campus notices'),
                loadEndpoint('/api/events/published', 'Event updates'),
                loadEndpoint('/api/hostel/mess', 'Hostel notices', true),
                supabase
                    .from('notifications')
                    .select('id, type, title, body, payload, is_read, created_at')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(100)
                    .then((result) => ({
                        data: result.data || [],
                        error: result.error ? `Chat alerts: ${result.error.message}` : '',
                    }))
                    .catch((error) => ({
                        data: [],
                        error: `Chat alerts: ${error instanceof Error ? error.message : 'Unable to load this source.'}`,
                    })),
            ]);

            if (cancelled) {
                return;
            }

            setSources({
                notices: noticesResult.data.notices || [],
                registeredEvents: eventsResult.data.enrolled || [],
                hostelAnnouncements: hostelResult.data.announcements || [],
                chatNotifications: chatResult.data,
            });
            setSourceErrors([
                noticesResult.error,
                eventsResult.error,
                hostelResult.error,
                chatResult.error,
            ].filter(Boolean));
            setLoading(false);
        };

        void loadSources();
        return () => {
            cancelled = true;
        };
    }, [refreshVersion, supabase, userId]);

    const items = useMemo(() => buildInboxItems({
        reminders,
        deadlines,
        issues,
        ...sources,
        readKeys,
    }), [deadlines, issues, readKeys, reminders, sources]);

    const unreadCount = items.filter((item) => !item.isRead).length;
    const [filter, setFilter] = useState('all');
    const visibleItems = filter === 'unread' ? items.filter((item) => !item.isRead) : items;

    useEffect(() => {
        onUnreadCountChange?.(unreadCount);
    }, [onUnreadCountChange, unreadCount]);

    const saveReadKeys = (nextKeys) => {
        setReadKeys(nextKeys);
        setStorageError(writeInboxReadKeys(userId, nextKeys)
            ? ''
            : 'Read status could not be saved in this browser.');
    };

    const markRead = (key) => {
        saveReadKeys([...readKeys, key]);
    };

    const markAllRead = () => {
        saveReadKeys([...readKeys, ...items.map((item) => item.key)]);
    };

    return (
        <section className="campus-panel-strong space-y-5 rounded-[1.8rem] p-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="campus-kicker">Student updates</div>
                    <h2 className="mt-2 text-2xl font-bold text-white">
                        Inbox
                        {unreadCount > 0 && (
                            <span className="ml-3 inline-flex min-w-7 items-center justify-center rounded-full bg-sky-400 px-2 py-1 text-xs font-bold text-slate-950">
                                {unreadCount}
                            </span>
                        )}
                    </h2>
                    <p className="mt-1 text-sm text-white/60">
                        Reminders, event changes, issue updates, campus and hostel notices, and Campus Chat alerts.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setRefreshVersion((value) => value + 1)}
                        disabled={loading}
                        className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50"
                    >
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <button
                        type="button"
                        onClick={markAllRead}
                        disabled={unreadCount === 0}
                        className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Mark all read
                    </button>
                </div>
            </header>

            {sourceErrors.length > 0 && (
                <div role="status" className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                    Some inbox sources could not be loaded: {sourceErrors.join(' · ')}
                </div>
            )}
            {storageError && (
                <div role="status" className="rounded-2xl border border-red-300/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                    {storageError}
                </div>
            )}

            <div className="flex gap-2">
                {[
                    { id: 'all', label: `All (${items.length})` },
                    { id: 'unread', label: `Unread (${unreadCount})` },
                ].map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => setFilter(option.id)}
                        className={`rounded-full px-4 py-2 text-sm transition ${filter === option.id
                            ? 'bg-white text-slate-950'
                            : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'}`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="space-y-3" aria-label="Loading inbox">
                    {[1, 2, 3].map((item) => (
                        <div key={item} className="h-28 animate-pulse rounded-[1.2rem] border border-white/10 bg-white/5" />
                    ))}
                </div>
            ) : visibleItems.length === 0 ? (
                <div className="rounded-[1.2rem] border border-dashed border-white/15 px-4 py-12 text-center">
                    <div className="text-lg font-semibold text-white">
                        {filter === 'unread' ? "You're all caught up." : 'Your inbox is empty.'}
                    </div>
                    <div className="mt-2 text-sm text-white/55">
                        New reminders and campus updates will show up here.
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {visibleItems.map((item) => (
                        <article
                            key={item.key}
                            className={`rounded-[1.2rem] border p-4 transition ${
                                item.isRead
                                    ? 'border-white/10 bg-white/[0.03]'
                                    : 'border-sky-300/30 bg-sky-400/[0.08]'
                            }`}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-100">
                                    {item.category}
                                </span>
                                {!item.isRead && (
                                    <span className="rounded-full bg-sky-300 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-950">
                                        Unread
                                    </span>
                                )}
                                <time className="text-xs text-white/45">{formatTimestamp(item.timestamp)}</time>
                            </div>
                            <h3 className="mt-3 font-semibold text-white">{item.title}</h3>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/65">{item.message}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                {item.actionHref ? (
                                    <Link href={item.actionHref} className="text-sm font-medium text-sky-200 hover:text-white">
                                        Open hostel portal
                                    </Link>
                                ) : item.actionTab ? (
                                    <button
                                        type="button"
                                        onClick={() => item.actionTab === 'chat'
                                            ? onOpenChat?.()
                                            : onSelectTab(item.actionTab)}
                                        className="text-sm font-medium text-sky-200 hover:text-white"
                                    >
                                        {item.actionTab === 'chat' ? 'Open Campus Chat alerts' : `Open ${item.actionTab}`}
                                    </button>
                                ) : null}
                                {!item.isRead && (
                                    <button
                                        type="button"
                                        onClick={() => markRead(item.key)}
                                        className="text-sm text-white/55 transition hover:text-white"
                                    >
                                        Mark as read
                                    </button>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
