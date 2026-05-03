'use client';
import { useState, useEffect } from 'react';
import { TAB_LABELS } from '@/lib/smart-campus/constants';
import { formatDuration } from '@/lib/smart-campus/utils';

function AttentionSectionBreakdown({ tabAttentionBreakdown, totalFocusedMs, keyPrefix }) {
    return (
        <div className="space-y-3">
            {tabAttentionBreakdown.map((tab) => {
                const share = totalFocusedMs > 0 ? Math.round((tab.focusedMs / totalFocusedMs) * 100) : 0;
                const barWidth = tab.totalMs > 0 ? Math.max(share, tab.focusedMs > 0 ? 6 : 0) : 0;
                return (
                    <div key={`${keyPrefix}-${tab.id}`} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="font-medium text-white">{tab.label}</div>
                                <div className="text-sm text-white/50">{tab.visits} visits</div>
                            </div>
                            <div className="grid gap-3 text-sm text-white/80 md:min-w-[360px] md:grid-cols-3">
                                <div className="rounded-lg bg-white/5 px-3 py-2">Focused: {formatDuration(tab.focusedMs)}</div>
                                <div className="rounded-lg bg-white/5 px-3 py-2">Background: {formatDuration(tab.backgroundMs)}</div>
                                <div className="rounded-lg bg-white/5 px-3 py-2">Share: {share}%</div>
                            </div>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400" style={{ width: `${barWidth}%` }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function DashboardOverviewTab() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recentQueries] = useState(() => {
        if (typeof window === 'undefined') {
            return [];
        }
        try {
            const raw = window.localStorage.getItem('sc-recent-ai-queries');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        fetch('/api/student/dashboard')
            .then(r => r.json())
            .then(d => { if (!d.error) setData(d); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const pct = data?.attendance?.overall;
    const attColor = pct == null ? 'border-slate-500/30 from-slate-500/20 text-slate-200'
        : pct >= 75 ? 'border-emerald-400/30 from-emerald-500/20 text-emerald-200'
        : pct >= 60 ? 'border-amber-400/30 from-amber-500/20 text-amber-200'
        : 'border-red-400/30 from-red-500/20 text-red-200';

    const fmtDate = s => { try { return new Date(s).toLocaleDateString([], { day: 'numeric', month: 'short' }); } catch { return s || ''; } };
    const fmtTime = s => { try { return new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
    const ago = ts => { if (!now) return ''; const m = Math.floor((now - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m/60)}h ago` : `${Math.floor(m/1440)}d ago`; };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">My Dashboard</h2>
                    <p className="mt-1 text-sm text-white/50">Your campus activity at a glance</p>
                </div>
                {loading && <div className="text-sm text-white/40 animate-pulse">Loading…</div>}
            </div>

            {/* Stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className={`rounded-2xl border bg-gradient-to-br to-transparent p-6 ${attColor}`}>
                    <div className="mb-1 text-3xl">📊</div>
                    <div className="text-3xl font-bold text-white">{pct != null ? `${pct}%` : '—'}</div>
                    <div className="mt-1 text-sm opacity-80">Overall Attendance</div>
                    {data?.attendance?.total > 0 && <div className="mt-1 text-xs opacity-55">{data.attendance.present}/{data.attendance.total} classes</div>}
                </div>
                <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/20 to-transparent p-6">
                    <div className="mb-1 text-3xl">🎟️</div>
                    <div className="text-3xl font-bold text-white">{data?.events?.length ?? '—'}</div>
                    <div className="mt-1 text-sm text-cyan-200">Events Registered</div>
                </div>
                <div className="rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-500/20 to-transparent p-6">
                    <div className="mb-1 text-3xl">🏛️</div>
                    <div className="text-3xl font-bold text-white">{data?.clubs?.length ?? '—'}</div>
                    <div className="mt-1 text-sm text-purple-200">Club Memberships</div>
                </div>
                <div className="rounded-2xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/20 to-transparent p-6">
                    <div className="mb-1 text-3xl">📅</div>
                    <div className="text-3xl font-bold text-white">{data ? data.planner.reminders.length + data.planner.deadlines.length : '—'}</div>
                    <div className="mt-1 text-sm text-fuchsia-200">Upcoming Tasks</div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Attendance by subject */}
                <div className="campus-panel rounded-[1.7rem] p-6">
                    <h3 className="mb-4 text-lg font-bold text-white">Attendance by Subject</h3>
                    {!data || data.attendance.bySubject.length === 0
                        ? <div className="py-8 text-center text-sm text-white/40">No attendance records yet</div>
                        : <div className="space-y-3">{data.attendance.bySubject.map((s, i) => (
                            <div key={i}>
                                <div className="mb-1 flex justify-between text-sm">
                                    <span className="truncate max-w-[65%] text-white/80">{s.name}</span>
                                    <span className={`font-semibold ${s.pct >= 75 ? 'text-emerald-300' : s.pct >= 60 ? 'text-amber-300' : 'text-red-300'}`}>{s.pct}%</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                    <div className={`h-full rounded-full ${s.pct >= 75 ? 'bg-emerald-400' : s.pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${s.pct}%` }} />
                                </div>
                            </div>
                        ))}</div>
                    }
                </div>

                {/* Planner */}
                <div className="campus-panel rounded-[1.7rem] p-6">
                    <h3 className="mb-4 text-lg font-bold text-white">Upcoming Planner</h3>
                    {!data || (data.planner.reminders.length + data.planner.deadlines.length) === 0
                        ? <div className="py-8 text-center text-sm text-white/40">All clear — no pending tasks 🎉</div>
                        : <div className="space-y-2">
                            {data.planner.reminders.map(r => (
                                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-cyan-400/15 bg-cyan-500/8 px-4 py-3">
                                    <span>🔔</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate text-sm text-white">{r.title}</div>
                                        <div className="text-xs text-white/45">{fmtDate(r.at)} · {fmtTime(r.at)}</div>
                                    </div>
                                    <span className="text-[10px] text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full">Reminder</span>
                                </div>
                            ))}
                            {data.planner.deadlines.map(d => (
                                <div key={d.id} className="flex items-center gap-3 rounded-xl border border-amber-400/15 bg-amber-500/8 px-4 py-3">
                                    <span>⏰</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate text-sm text-white">{d.title}</div>
                                        <div className="text-xs text-white/45">Due {fmtDate(d.due)}</div>
                                    </div>
                                    <span className="text-[10px] text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full">Deadline</span>
                                </div>
                            ))}
                        </div>
                    }
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Registered events */}
                <div className="campus-panel rounded-[1.7rem] p-6">
                    <h3 className="mb-4 text-lg font-bold text-white">Event Registrations</h3>
                    {!data || data.events.length === 0
                        ? <div className="py-8 text-center text-sm text-white/40">No events registered yet</div>
                        : <div className="space-y-2">{data.events.map((e, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                <span>🎟️</span>
                                <div className="flex-1 min-w-0">
                                    <div className="truncate text-sm font-medium text-white">{e.title}</div>
                                    <div className="text-xs text-white/45">{fmtDate(e.date)}{e.time ? ` · ${e.time}` : ''}</div>
                                </div>
                                {e.isPublished && <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">Live</span>}
                            </div>
                        ))}</div>
                    }
                </div>

                {/* Recent AI searches */}
                <div className="campus-panel rounded-[1.7rem] p-6">
                    <h3 className="mb-4 text-lg font-bold text-white">Recent AI Searches</h3>
                    {recentQueries.length === 0
                        ? <div className="py-8 text-center text-sm text-white/40"><div className="text-3xl mb-2">🤖</div>Ask the AI chatbot — recent searches appear here</div>
                        : <div className="space-y-2">{recentQueries.map((q, i) => (
                            <div key={i} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                <span className="shrink-0">🤖</span>
                                <span className="flex-1 text-sm text-white/80 leading-5">{q.text}</span>
                                <span className="text-xs text-white/35 shrink-0 whitespace-nowrap">{ago(q.at)}</span>
                            </div>
                        ))}</div>
                    }
                </div>
            </div>

            {/* Club memberships */}
            {data?.clubs?.length > 0 && (
                <div className="campus-panel rounded-[1.7rem] p-6">
                    <h3 className="mb-4 text-lg font-bold text-white">My Clubs</h3>
                    <div className="flex flex-wrap gap-3">
                        {data.clubs.map((c, i) => (
                            <div key={i} className="rounded-full border border-purple-400/25 bg-purple-500/15 px-4 py-2 text-sm font-medium text-purple-100">🏛️ {c.name}</div>
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
                        <div className="flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-gradient-to-br from-cyan-400 via-sky-400 to-emerald-400 text-3xl font-bold text-slate-950">{displayName.slice(0, 1).toUpperCase()}</div>
                        <div>
                            <div className="campus-kicker">Student Profile</div>
                            <h2 className="mt-2 text-3xl font-bold text-white">{displayName}</h2>
                            <p className="mt-1 text-white/65">@{username}</p>
                        </div>
                    </div>
                    <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/75">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">Account Status</div>
                        <div className="mt-2 text-base font-semibold text-white">{isOnline ? 'Online' : 'Signed in'}</div>
                        <div className="mt-1">Last seen: {lastSeenLabel}</div>
                    </div>
                </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: 'Events', value: attendedEventsCount, color: 'cyan', sub: 'Checked in and attended' },
                    { label: 'Clubs', value: joinedClubsCount, color: 'emerald', sub: 'Communities you joined' },
                    { label: 'Reminders', value: upcomingRemindersCount, color: 'fuchsia', sub: 'Active reminder items' },
                    { label: 'Deadlines', value: openDeadlinesCount, color: 'amber', sub: 'Open tasks still pending' },
                ].map(({ label, value, color, sub }) => (
                    <div key={label} className={`rounded-[1.7rem] border border-${color}-400/20 bg-gradient-to-br from-${color}-500/20 to-${color}-500/5 p-6`}>
                        <div className={`text-sm uppercase tracking-[0.2em] text-${color}-200/70`}>{label}</div>
                        <div className="mt-3 text-4xl font-bold text-white">{value}</div>
                        <div className="mt-2 text-sm text-white/65">{sub}</div>
                    </div>
                ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="campus-panel rounded-[1.8rem] p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-xl font-bold text-white">Account Details</h3>
                        <div className="flex gap-3">
                            {isEditing && <button onClick={() => { setIsEditing(false); setSaveMessage(''); setFormValues(currentFormValues); }} className="rounded-[1rem] border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white">Cancel</button>}
                            <button onClick={() => { if (isEditing) { void handleSaveProfile(); return; } setFormValues(currentFormValues); setSaveMessage(''); setIsEditing(true); }} disabled={isSavingProfile} className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
                                {isEditing ? (isSavingProfile ? 'Saving...' : 'Save Profile') : 'Edit Profile'}
                            </button>
                        </div>
                    </div>
                    {saveMessage && <div className={`mt-4 rounded-[1rem] border px-4 py-3 text-sm ${saveMessage.includes('successfully') ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100' : 'border-red-400/30 bg-red-500/10 text-red-100'}`}>{saveMessage}</div>}
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
                            <div key={label} className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/45">{label}</div>
                                {isEditing && field ? <input type={type} value={formValues[field]} onChange={e => handleFieldChange(field, e.target.value)} className="campus-input mt-3 w-full rounded-[1rem] px-4 py-3" /> : <div className="mt-2 break-all text-white">{value ?? 'Not set yet'}</div>}
                            </div>
                        ))}
                        <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4"><div className="text-xs uppercase tracking-[0.2em] text-white/45">User ID</div><div className="mt-2 break-all text-white/80">{userId}</div></div>
                    </div>
                </div>
                <div className="campus-panel rounded-[1.8rem] p-6">
                    <h3 className="text-xl font-bold text-white">Student Activity Snapshot</h3>
                    <div className="mt-5 space-y-3">
                        {[
                            `Most focused section: ${TAB_LABELS[mostFocusedTab]}`,
                            `Attention level: ${attentionLevel}`,
                            `Focus ratio: ${Math.round(focusRatio * 100)}%`,
                            `Total focused time: ${formatDuration(totalFocusedMs)}`,
                        ].map((line, i) => <div key={i} className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4 text-white/80">{line}</div>)}
                    </div>
                </div>
            </div>
            <div className="campus-panel rounded-[1.8rem] p-6">
                <h3 className="text-xl font-bold text-white">What Smart Campus AI Knows About You</h3>
                <div className="mt-5 grid gap-3">
                    {visibleInsights.length === 0
                        ? <div className="rounded-[1.2rem] border border-dashed border-white/15 px-4 py-5 text-white/55">Start using events, clubs, reminders, deadlines, and chat to build your profile automatically.</div>
                        : visibleInsights.map((insight, i) => <div key={i} className="rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-4 text-white/80">{insight}</div>)
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
                    <h2 className="text-2xl font-bold text-white">Attention Span</h2>
                    <p className="text-sm text-white/60">Phase 1 tracking inside Smart Campus AI. Full device tracking needs a desktop app or extension.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">Most focused section: <span className="font-semibold text-white">{TAB_LABELS[mostFocusedTab]}</span></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {[
                    { label: 'Attention Score', value: attentionScore, color: 'cyan' },
                    { label: 'Focus Pattern', value: attentionLevel, color: 'purple' },
                    { label: 'Focused Time', value: formatDuration(totalFocusedMs), color: 'pink' },
                    { label: 'Background Time', value: formatDuration(totalBackgroundMs), color: 'amber' },
                    { label: 'Section Visits', value: totalVisits, color: 'emerald' },
                ].map(({ label, value, color }) => (
                    <div key={label} className={`rounded-2xl border border-${color}-500/30 bg-gradient-to-br from-${color}-500/20 to-${color}-500/5 p-6`}>
                        <div className="text-3xl font-bold text-white">{value}</div>
                        <div className={`text-sm text-${color}-200`}>{label}</div>
                    </div>
                ))}
            </div>
            <div className="campus-panel rounded-[1.7rem] p-6">
                <h3 className="mb-4 text-xl font-bold text-white">Analysis Report</h3>
                <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                    <div className="space-y-3">{attentionReport.map((line, i) => <div key={i} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/80">{line}</div>)}</div>
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5">
                        <div className="text-sm uppercase tracking-[0.2em] text-cyan-200/70">Roadmap Status</div>
                        <div className="mt-3 text-2xl font-bold text-white">Website Scope</div>
                        <div className="mt-2 text-sm text-white/70">This version measures focus across Smart Campus AI sections.</div>
                        <div className="mt-5 text-sm text-white/60">Focus ratio: {Math.round(focusRatio * 100)}%</div>
                        <div className="mt-1 text-sm text-white/60">Avg focused stretch: {formatDuration(averageFocusPerVisitMs)}</div>
                    </div>
                </div>
            </div>
            <div className="campus-panel rounded-[1.7rem] p-6">
                <h3 className="mb-4 text-xl font-bold text-white">Section Breakdown</h3>
                <AttentionSectionBreakdown keyPrefix="attention" tabAttentionBreakdown={tabAttentionBreakdown} totalFocusedMs={totalFocusedMs} />
            </div>
        </div>
    );
}
