'use client';
import { useEffect, useMemo, useState } from 'react';
import { TAB_LABELS } from '@/lib/smart-campus/constants';
import { formatDuration } from '@/lib/smart-campus/utils';

function AttentionSectionBreakdown({ tabAttentionBreakdown, totalFocusedMs, keyPrefix }) {
    return (
        <div className="space-y-3">
            {tabAttentionBreakdown.map((tab) => {
                const share = totalFocusedMs > 0 ? Math.round((tab.focusedMs / totalFocusedMs) * 100) : 0;
                const barWidth = tab.totalMs > 0 ? Math.max(share, tab.focusedMs > 0 ? 6 : 0) : 0;
                return (
                    <div key={`${keyPrefix}-${tab.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="font-medium text-slate-900">{tab.label}</div>
                                <div className="text-sm text-slate-400">{tab.visits} visits</div>
                            </div>
                            <div className="grid gap-3 text-sm text-slate-700 md:min-w-[360px] md:grid-cols-3">
                                <div className="rounded-lg bg-slate-50 px-3 py-2">Focused: {formatDuration(tab.focusedMs)}</div>
                                <div className="rounded-lg bg-slate-50 px-3 py-2">Background: {formatDuration(tab.backgroundMs)}</div>
                                <div className="rounded-lg bg-slate-50 px-3 py-2">Share: {share}%</div>
                            </div>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-gradient-to-r from-sky-400 via-sky-400 to-emerald-400" style={{ width: `${barWidth}%` }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function DashboardOverviewTab({ events = [], clubs = [], reminders = [], deadlines = [], attendedEventsCount = 0, joinedClubsCount = 0, upcomingRemindersCount = 0, openDeadlinesCount = 0, userId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const recentQueries = useMemo(() => {
        if (typeof window === 'undefined' || !userId) {
            return [];
        }
        try {
            const raw = window.localStorage.getItem(`sc-recent-ai-queries-${userId}`);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }, [userId]);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        fetch('/api/student/dashboard')
            .then(r => r.json())
            .then(d => {
                if (d.error) {
                    setError(d.error);
                    return;
                }
                setData(d);
                if (Array.isArray(d.warnings) && d.warnings.length > 0) {
                    setError(`Some dashboard sources are unavailable: ${d.warnings.join('; ')}`);
                }
            })
            .catch(() => setError('Dashboard data could not be loaded right now.'))
            .finally(() => setLoading(false));
    }, []);

    const pct = data?.attendance?.overall;
    const dashboardEvents = data?.events?.length ? data.events : events.filter((event) => event.attending || event.checkedIn).map((event) => ({
        title: event.name,
        date: event.date,
        time: event.time,
        isPublished: true,
    }));
    const dashboardClubs = data?.clubs?.length ? data.clubs : clubs.filter((club) => club.joined).map((club) => ({ id: club.id, name: club.name }));
    const dashboardReminders = data?.planner?.reminders?.length ? data.planner.reminders : reminders.map((reminder) => ({
        id: reminder.id,
        title: reminder.eventName || reminder.title || 'Reminder',
        at: reminder.date && reminder.time ? `${reminder.date} ${reminder.time}` : reminder.date,
    }));
    const dashboardDeadlines = data?.planner?.deadlines?.length ? data.planner.deadlines : deadlines
        .filter((deadline) => !deadline.completed)
        .map((deadline) => ({
            id: deadline.id,
            title: deadline.title || 'Deadline',
            due: deadline.date && deadline.time ? `${deadline.date} ${deadline.time}` : deadline.date,
        }));
    const eventCount = data?.events?.length ? data.events.length : Math.max(dashboardEvents.length, attendedEventsCount);
    const clubCount = data?.clubs?.length ? data.clubs.length : Math.max(dashboardClubs.length, joinedClubsCount);
    const taskCount = data?.planner ? Math.max(dashboardReminders.length + dashboardDeadlines.length, upcomingRemindersCount + openDeadlinesCount) : upcomingRemindersCount + openDeadlinesCount;
    const attColor = pct == null ? 'border-slate-500/30 from-slate-500/20 text-slate-500'
        : pct >= 75 ? 'border-emerald-400/30 from-emerald-500/20 text-emerald-700'
        : pct >= 60 ? 'border-amber-400/30 from-amber-500/20 text-amber-700'
        : 'border-red-400/30 from-red-500/20 text-red-600';

    const fmtDate = s => { try { return new Date(s).toLocaleDateString([], { day: 'numeric', month: 'short' }); } catch { return s || ''; } };
    const fmtTime = s => { try { return new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
    const ago = ts => { if (!now) return ''; const m = Math.floor((now - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m/60)}h ago` : `${Math.floor(m/1440)}d ago`; };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">My Dashboard</h2>
                    <p className="mt-1 text-sm text-slate-400">Your campus activity at a glance</p>
                </div>
                {loading && <div className="text-sm text-slate-400 animate-pulse">Loading…</div>}
            </div>

            {error ? (
                <div className="rounded-[1rem] border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
                    {error} Showing locally synced dashboard items where available.
                </div>
            ) : null}

            {/* Stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className={`rounded-2xl border bg-gradient-to-br to-transparent p-6 ${attColor}`}>
                    <div className="mb-1 text-3xl">📊</div>
                    <div className="text-3xl font-bold text-slate-900">{pct != null ? `${pct}%` : '—'}</div>
                    <div className="mt-1 text-sm opacity-80">Overall Attendance</div>
                    {data?.attendance?.total > 0 && <div className="mt-1 text-xs opacity-55">{data.attendance.present}/{data.attendance.total} classes</div>}
                </div>
                <div className="rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/20 to-transparent p-6">
                    <div className="mb-1 text-3xl">🎟️</div>
                    <div className="text-3xl font-bold text-slate-900">{eventCount}</div>
                    <div className="mt-1 text-sm text-sky-700">Events Registered</div>
                </div>
                <div className="rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-500/20 to-transparent p-6">
                    <div className="mb-1 text-3xl">🏛️</div>
                    <div className="text-3xl font-bold text-slate-900">{clubCount}</div>
                    <div className="mt-1 text-sm text-purple-700">Club Memberships</div>
                </div>
                <div className="rounded-2xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/20 to-transparent p-6">
                    <div className="mb-1 text-3xl">📅</div>
                    <div className="text-3xl font-bold text-slate-900">{taskCount}</div>
                    <div className="mt-1 text-sm text-fuchsia-700">Upcoming Tasks</div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Attendance by subject */}
                <div className="campus-panel rounded-[1.7rem] p-6">
                    <h3 className="mb-4 text-lg font-bold text-slate-900">Attendance by Subject</h3>
                    {!data || data.attendance.bySubject.length === 0
                        ? <div className="py-8 text-center text-sm text-slate-400">No attendance records yet</div>
                        : <div className="space-y-3">{data.attendance.bySubject.map((s, i) => (
                            <div key={i}>
                                <div className="mb-1 flex justify-between text-sm">
                                    <span className="truncate max-w-[65%] text-slate-700">{s.name}</span>
                                    <span className={`font-semibold ${s.pct >= 75 ? 'text-emerald-700' : s.pct >= 60 ? 'text-amber-700' : 'text-red-600'}`}>{s.pct}%</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                    <div className={`h-full rounded-full ${s.pct >= 75 ? 'bg-emerald-400' : s.pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${s.pct}%` }} />
                                </div>
                            </div>
                        ))}</div>
                    }
                </div>

                {/* Planner */}
                <div className="campus-panel rounded-[1.7rem] p-6">
                    <h3 className="mb-4 text-lg font-bold text-slate-900">Upcoming Planner</h3>
                    {dashboardReminders.length + dashboardDeadlines.length === 0
                        ? <div className="py-8 text-center text-sm text-slate-400">All clear — no pending tasks 🎉</div>
                        : <div className="space-y-2">
                            {dashboardReminders.map(r => (
                                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-sky-400/15 bg-sky-500/8 px-4 py-3">
                                    <span>🔔</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate text-sm text-slate-900">{r.title}</div>
                                        <div className="text-xs text-slate-400">{fmtDate(r.at)} · {fmtTime(r.at)}</div>
                                    </div>
                                    <span className="text-[10px] text-sky-600 bg-sky-500/20 px-2 py-0.5 rounded-full">Reminder</span>
                                </div>
                            ))}
                            {dashboardDeadlines.map(d => (
                                <div key={d.id} className="flex items-center gap-3 rounded-xl border border-amber-400/15 bg-amber-500/8 px-4 py-3">
                                    <span>⏰</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate text-sm text-slate-900">{d.title}</div>
                                        <div className="text-xs text-slate-400">Due {fmtDate(d.due)}</div>
                                    </div>
                                    <span className="text-[10px] text-amber-700 bg-amber-500/20 px-2 py-0.5 rounded-full">Deadline</span>
                                </div>
                            ))}
                        </div>
                    }
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Registered events */}
                <div className="campus-panel rounded-[1.7rem] p-6">
                    <h3 className="mb-4 text-lg font-bold text-slate-900">Event Registrations</h3>
                    {dashboardEvents.length === 0
                        ? <div className="py-8 text-center text-sm text-slate-400">No events registered yet</div>
                        : <div className="space-y-2">{dashboardEvents.map((e, i) => {
                            const today = new Date().toDateString();
                            const eventDate = e.date ? new Date(e.date).toDateString() : null;
                            const isPast = e.date && new Date(e.date) < new Date(today);
                            const isToday = eventDate === today;
                            const badge = isPast
                                ? { label: 'Past', cls: 'text-slate-500 bg-slate-200' }
                                : isToday
                                ? { label: 'Today 🔴', cls: 'text-red-700 bg-red-500/20' }
                                : { label: 'Upcoming', cls: 'text-emerald-700 bg-emerald-500/20' };
                            return (
                                <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <span>🎟️</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate text-sm font-medium text-slate-900">{e.title}</div>
                                        <div className="text-xs text-slate-400">{fmtDate(e.date)}{e.time ? ` · ${e.time}` : ''}</div>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>{badge.label}</span>
                                </div>
                            );
                        })}</div>
                    }
                </div>

                {/* Recent AI searches */}
                <div className="campus-panel rounded-[1.7rem] p-6">
                    <h3 className="mb-4 text-lg font-bold text-slate-900">Recent AI Searches</h3>
                    {recentQueries.length === 0
                        ? <div className="py-8 text-center text-sm text-slate-400"><div className="text-3xl mb-2">🤖</div>Ask the AI chatbot — recent searches appear here</div>
                        : <div className="space-y-2">{recentQueries.map((q, i) => (
                            <div key={i} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <span className="shrink-0">🤖</span>
                                <span className="flex-1 text-sm text-slate-700 leading-5">{q.text}</span>
                                <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">{ago(q.at)}</span>
                            </div>
                        ))}</div>
                    }
                </div>
            </div>

            {/* Club memberships */}
            {dashboardClubs.length > 0 && (
                <div className="campus-panel rounded-[1.7rem] p-6">
                    <h3 className="mb-4 text-lg font-bold text-slate-900">My Clubs</h3>
                    <div className="flex flex-wrap gap-3">
                        {dashboardClubs.map((c, i) => (
                            <div key={i} className="rounded-full border border-purple-400/25 bg-purple-500/15 px-4 py-2 text-sm font-medium text-purple-700">🏛️ {c.name}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export function ProfileTab({ displayName, username, isOnline, lastSeenLabel, attendedEventsCount, joinedClubsCount, upcomingRemindersCount, openDeadlinesCount, fullName, profileAge, profileEmail, userId, rollNumber, course, branch, semester, mostFocusedTab, attentionLevel, focusRatio, totalFocusedMs, visibleInsights, onSaveProfile, isSavingProfile = false }) {
    const currentFormValues = { fullName, age: profileAge ?? '', rollNumber: rollNumber || '', course: course || '', branch: branch || '', semester: semester ?? '' };
    const [isEditing, setIsEditing] = useState(false);
    const [formValues, setFormValues] = useState(currentFormValues);
    const [saveMessage, setSaveMessage] = useState('');
    const handleFieldChange = (field, value) => setFormValues(c => ({ ...c, [field]: value }));
    const handleSaveProfile = async () => {
        setSaveMessage('');
        const result = await onSaveProfile?.({ fullName: formValues.fullName, age: formValues.age, rollNumber: formValues.rollNumber, course: formValues.course, branch: formValues.branch, semester: formValues.semester });
        if (!result?.success) { setSaveMessage(result?.error || 'Failed to update profile.'); return; }
        setSaveMessage('Profile updated successfully.');
        setIsEditing(false);
    };
    return (
        <div className="space-y-6">
            <div className="campus-panel-strong rounded-[2rem] p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-5">
                        <div className="flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-gradient-to-br from-sky-400 via-sky-400 to-emerald-400 text-3xl font-bold text-slate-950">{displayName.slice(0, 1).toUpperCase()}</div>
                        <div>
                            <div className="campus-kicker">Student Profile</div>
                            <h2 className="mt-2 text-3xl font-bold text-slate-900">{displayName}</h2>
                            <p className="mt-1 text-slate-500">@{username}</p>
                        </div>
                    </div>
                    <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Account Status</div>
                        <div className="mt-2 text-base font-semibold text-slate-900">{isOnline ? 'Online' : 'Signed in'}</div>
                        <div className="mt-1">Last seen: {lastSeenLabel}</div>
                    </div>
                </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: 'Events', value: attendedEventsCount, color: 'sky', sub: 'Checked in and attended' },
                    { label: 'Clubs', value: joinedClubsCount, color: 'emerald', sub: 'Communities you joined' },
                    { label: 'Reminders', value: upcomingRemindersCount, color: 'fuchsia', sub: 'Active reminder items' },
                    { label: 'Deadlines', value: openDeadlinesCount, color: 'amber', sub: 'Open tasks still pending' },
                ].map(({ label, value, color, sub }) => (
                    <div key={label} className={`rounded-[1.7rem] border border-${color}-400/20 bg-gradient-to-br from-${color}-500/20 to-${color}-500/5 p-6`}>
                        <div className={`text-sm uppercase tracking-[0.2em] text-${color}-700/70`}>{label}</div>
                        <div className="mt-3 text-4xl font-bold text-slate-900">{value}</div>
                        <div className="mt-2 text-sm text-slate-500">{sub}</div>
                    </div>
                ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="campus-panel rounded-[1.8rem] p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-xl font-bold text-slate-900">Account Details</h3>
                        <div className="flex gap-3">
                            {isEditing && <button onClick={() => { setIsEditing(false); setSaveMessage(''); setFormValues(currentFormValues); }} className="rounded-[1rem] border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900">Cancel</button>}
                            <button onClick={() => { if (isEditing) { void handleSaveProfile(); return; } setFormValues(currentFormValues); setSaveMessage(''); setIsEditing(true); }} disabled={isSavingProfile} className="rounded-[1rem] bg-gradient-to-r from-sky-500 to-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
                                {isEditing ? (isSavingProfile ? 'Saving...' : 'Save Profile') : 'Edit Profile'}
                            </button>
                        </div>
                    </div>
                    {saveMessage && <div className={`mt-4 rounded-[1rem] border px-4 py-3 text-sm ${saveMessage.includes('successfully') ? 'border-sky-400/20 bg-sky-500/10 text-sky-700' : 'border-red-400/30 bg-red-500/10 text-red-600'}`}>{saveMessage}</div>}
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {[
                            { label: 'Full Name', field: 'fullName', value: fullName, type: 'text' },
                            { label: 'Age', field: 'age', value: profileAge, type: 'number' },
                            { label: 'Username', value: `@${username}`, readOnly: true },
                            { label: 'Email', value: profileEmail, readOnly: true },
                            { label: 'Roll Number', field: 'rollNumber', value: rollNumber, type: 'text' },
                            { label: 'Course', field: 'course', value: course, type: 'text' },
                            { label: 'Branch', field: 'branch', value: branch, type: 'text' },
                            { label: 'Semester', field: 'semester', value: semester, type: 'number' },
                        ].map(({ label, field, value, type }) => (
                            <div key={label} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
                                {isEditing && field ? <input type={type} value={formValues[field]} onChange={e => handleFieldChange(field, e.target.value)} className="campus-input mt-3 w-full rounded-[1rem] px-4 py-3" /> : <div className="mt-2 break-all text-slate-900">{value ?? 'Not set yet'}</div>}
                            </div>
                        ))}
                        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4"><div className="text-xs uppercase tracking-[0.2em] text-slate-400">User ID</div><div className="mt-2 break-all text-slate-700">{userId}</div></div>
                    </div>
                </div>
                <div className="campus-panel rounded-[1.8rem] p-6">
                    <h3 className="text-xl font-bold text-slate-900">Student Activity Snapshot</h3>
                    <div className="mt-5 space-y-3">
                        {[
                            `Most focused section: ${TAB_LABELS[mostFocusedTab]}`,
                            `Attention level: ${attentionLevel}`,
                            `Focus ratio: ${Math.round(focusRatio * 100)}%`,
                            `Total focused time: ${formatDuration(totalFocusedMs)}`,
                        ].map((line, i) => <div key={i} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 text-slate-700">{line}</div>)}
                    </div>
                </div>
            </div>
            <div className="campus-panel rounded-[1.8rem] p-6">
                <h3 className="text-xl font-bold text-slate-900">What Smart Campus AI Knows About You</h3>
                <div className="mt-5 grid gap-3">
                    {visibleInsights.length === 0
                        ? <div className="rounded-[1.2rem] border border-dashed border-slate-200 px-4 py-5 text-slate-500">Start using events, clubs, reminders, deadlines, and chat to build your profile automatically.</div>
                        : visibleInsights.map((insight, i) => <div key={i} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700">{insight}</div>)
                    }
                </div>
            </div>
        </div>
    );
}

export function AttentionTab({ mostFocusedTab, attentionScore, attentionLevel, totalFocusedMs, totalBackgroundMs, totalVisits, attentionReport, focusRatio, averageFocusPerVisitMs, tabAttentionBreakdown }) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Attention Span</h2>
                    <p className="text-sm text-slate-500">Phase 1 tracking inside Smart Campus AI. Full device tracking needs a desktop app or extension.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Most focused section: <span className="font-semibold text-slate-900">{TAB_LABELS[mostFocusedTab]}</span></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {[
                    { label: 'Attention Score', value: attentionScore, color: 'sky' },
                    { label: 'Focus Pattern', value: attentionLevel, color: 'purple' },
                    { label: 'Focused Time', value: formatDuration(totalFocusedMs), color: 'pink' },
                    { label: 'Background Time', value: formatDuration(totalBackgroundMs), color: 'amber' },
                    { label: 'Section Visits', value: totalVisits, color: 'emerald' },
                ].map(({ label, value, color }) => (
                    <div key={label} className={`rounded-2xl border border-${color}-500/30 bg-gradient-to-br from-${color}-500/20 to-${color}-500/5 p-6`}>
                        <div className="text-3xl font-bold text-slate-900">{value}</div>
                        <div className={`text-sm text-${color}-700`}>{label}</div>
                    </div>
                ))}
            </div>
            <div className="campus-panel rounded-[1.7rem] p-6">
                <h3 className="mb-4 text-xl font-bold text-slate-900">Analysis Report</h3>
                <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                    <div className="space-y-3">{attentionReport.map((line, i) => <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">{line}</div>)}</div>
                    <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-5">
                        <div className="text-sm uppercase tracking-[0.2em] text-sky-700/70">Roadmap Status</div>
                        <div className="mt-3 text-2xl font-bold text-slate-900">Website Scope</div>
                        <div className="mt-2 text-sm text-slate-600">This version measures focus across Smart Campus AI sections.</div>
                        <div className="mt-5 text-sm text-slate-500">Focus ratio: {Math.round(focusRatio * 100)}%</div>
                        <div className="mt-1 text-sm text-slate-500">Avg focused stretch: {formatDuration(averageFocusPerVisitMs)}</div>
                    </div>
                </div>
            </div>
            <div className="campus-panel rounded-[1.7rem] p-6">
                <h3 className="mb-4 text-xl font-bold text-slate-900">Section Breakdown</h3>
                <AttentionSectionBreakdown keyPrefix="attention" tabAttentionBreakdown={tabAttentionBreakdown} totalFocusedMs={totalFocusedMs} />
            </div>
        </div>
    );
}
