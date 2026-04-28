'use client';

import { useEffect, useMemo, useState } from 'react';
import { CAMPUS_LOCATIONS } from '@/lib/smart-campus/constants';
import { ISSUE_CATEGORIES, ISSUE_PRIORITY_OPTIONS, ISSUE_STATUS_OPTIONS, getIssueDepartment, isIssueSlaBreached, smartCategorizeIssue } from '@/lib/smart-campus/issues.js';

function EmptyState({ title }) {
    return (
        <div className="rounded-[1.2rem] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
            {title}
        </div>
    );
}

function createEvidenceId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function StatusBadge({ status }) {
    const tone = status === 'resolved' || status === 'closed'
        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
        : status === 'awaiting_student'
            ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
            : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100';
    return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${tone}`}>{status.replace(/_/g, ' ')}</span>;
}

async function readFilesAsEvidence(fileList) {
    const files = Array.from(fileList || []).slice(0, 5);
    return Promise.all(files.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
            id: createEvidenceId(file.type.startsWith('video/') ? 'video' : 'image'),
            type: file.type.startsWith('video/') ? 'video' : 'image',
            name: file.name,
            mimeType: file.type,
            dataUrl: typeof reader.result === 'string' ? reader.result : '',
        });
        reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
        reader.readAsDataURL(file);
    })));
}

export default function IssueReportingTab({
    reportedIssues,
    issueNotificationPreferences,
    issuesLoading,
    issueError,
    onCreateIssue,
    onUpdateIssuePreferences,
    onRateIssueSatisfaction,
    onRefreshIssues,
}) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        category: 'Other',
        priority: 'medium',
        building: '',
        floor: '',
        room: '',
        gpsLabel: '',
        latitude: '',
        longitude: '',
    });
    const [evidence, setEvidence] = useState([]);
    const [formMessage, setFormMessage] = useState('');
    const [selectedIssueId, setSelectedIssueId] = useState('');
    const [ratingDraft, setRatingDraft] = useState({ rating: 5, comment: '' });

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            void onRefreshIssues?.();
        }, 30000);
        return () => window.clearInterval(intervalId);
    }, [onRefreshIssues]);

    const smartCategory = useMemo(() => smartCategorizeIssue(form.title, form.description, form.category), [form.category, form.description, form.title]);
    const resolvedSelectedIssueId = selectedIssueId || reportedIssues[0]?.id || '';
    const selectedIssue = reportedIssues.find((issue) => issue.id === resolvedSelectedIssueId) || null;
    const stats = {
        total: reportedIssues.length,
        open: reportedIssues.filter((issue) => !['resolved', 'closed'].includes(issue.status)).length,
        resolved: reportedIssues.filter((issue) => issue.status === 'resolved' || issue.status === 'closed').length,
        breached: reportedIssues.filter((issue) => isIssueSlaBreached(issue)).length,
    };

    const handleEvidenceUpload = async (event) => {
        const nextFiles = Array.from(event.target.files || []);
        if (nextFiles.length === 0) {
            return;
        }
        if (evidence.length + nextFiles.length > 5) {
            setFormMessage('You can upload up to 5 image or video files per report.');
            return;
        }
        try {
            const nextEvidence = await readFilesAsEvidence(nextFiles);
            setEvidence((current) => [...current, ...nextEvidence].slice(0, 5));
            setFormMessage('');
        }
        catch (error) {
            setFormMessage(error instanceof Error ? error.message : 'Failed to read evidence files.');
        }
    };

    const handleUseGps = () => {
        if (!navigator.geolocation) {
            setFormMessage('Geolocation is not available in this browser.');
            return;
        }
        navigator.geolocation.getCurrentPosition((position) => {
            setForm((current) => ({
                ...current,
                latitude: position.coords.latitude.toFixed(6),
                longitude: position.coords.longitude.toFixed(6),
            }));
            setFormMessage('GPS coordinates captured from your device.');
        }, () => {
            setFormMessage('Unable to fetch your GPS coordinates.');
        });
    };

    const handleSubmit = async () => {
        if (!form.title.trim() || !form.description.trim()) {
            setFormMessage('Enter both a title and a description for the issue.');
            return;
        }
        const didCreate = await onCreateIssue?.({
            title: form.title,
            description: form.description,
            category: form.category,
            priority: form.priority,
            location: {
                building: form.building,
                floor: form.floor,
                room: form.room,
                gpsLabel: form.gpsLabel,
                latitude: form.latitude,
                longitude: form.longitude,
            },
            evidence,
        });
        if (!didCreate) {
            return;
        }
        setForm({
            title: '',
            description: '',
            category: 'Other',
            priority: 'medium',
            building: '',
            floor: '',
            room: '',
            gpsLabel: '',
            latitude: '',
            longitude: '',
        });
        setEvidence([]);
        setFormMessage('Issue submitted successfully. The admin queue now has your report.');
    };

    const toggleNotificationPreference = async (key) => {
        await onUpdateIssuePreferences?.({
            ...issueNotificationPreferences,
            [key]: !issueNotificationPreferences[key],
        });
    };

    const handleSatisfactionSubmit = async () => {
        if (!selectedIssue) {
            return;
        }
        await onRateIssueSatisfaction?.({
            issueId: selectedIssue.id,
            rating: ratingDraft.rating,
            comment: ratingDraft.comment,
        });
        setRatingDraft({ rating: 5, comment: '' });
    };

    return (
        <div className="space-y-6">
            <div className="campus-panel-strong rounded-[2rem] p-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="campus-kicker">Issue Reporting Center</div>
                        <h2 className="mt-3 text-3xl font-bold text-white">Report campus issues with evidence, tracking, and follow-through</h2>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
                            Submit campus issues with smart categorization, media evidence, precise location details, and your preferred notification settings.
                        </p>
                    </div>
                    <button onClick={() => void onRefreshIssues?.()} className="rounded-full border border-white/10 bg-white/10 px-5 py-2.5 text-sm text-white">
                        Refresh status
                    </button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-[1.6rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Total Reports</div>
                    <div className="mt-3 text-3xl font-bold text-white">{stats.total}</div>
                </div>
                <div className="rounded-[1.6rem] border border-amber-400/20 bg-gradient-to-br from-amber-500/20 to-amber-500/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-amber-200/70">Open Issues</div>
                    <div className="mt-3 text-3xl font-bold text-white">{stats.open}</div>
                </div>
                <div className="rounded-[1.6rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">Resolved</div>
                    <div className="mt-3 text-3xl font-bold text-white">{stats.resolved}</div>
                </div>
                <div className="rounded-[1.6rem] border border-rose-400/20 bg-gradient-to-br from-rose-500/20 to-rose-500/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-rose-200/70">SLA Alerts</div>
                    <div className="mt-3 text-3xl font-bold text-white">{stats.breached}</div>
                </div>
            </div>

            {(issueError || formMessage) ? (
                <div className={`rounded-[1.2rem] border px-4 py-3 text-sm ${issueError ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100'}`}>
                    {issueError || formMessage}
                </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="campus-panel rounded-[1.8rem] p-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-white">Create Issue Report</h3>
                            <p className="mt-1 text-sm text-white/60">Add a clear summary, smart category, evidence files, and detailed location context.</p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/60">
                            Routed to {smartCategory.department}
                        </div>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                        <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Issue title" className="campus-input rounded-[1rem] px-4 py-3" />
                        <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                            {ISSUE_CATEGORIES.map((category) => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                        <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe what happened, what is affected, and what evidence you captured." className="campus-input min-h-32 rounded-[1rem] px-4 py-3 md:col-span-2" />
                        <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                            {ISSUE_PRIORITY_OPTIONS.map((priority) => (
                                <option key={priority} value={priority}>{priority.toUpperCase()}</option>
                            ))}
                        </select>
                        <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
                            Smart category: <span className="font-semibold text-white">{smartCategory.category}</span> ({Math.round(smartCategory.confidence * 100)}%)
                        </div>
                        <select value={form.building} onChange={(event) => setForm((current) => ({ ...current, building: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                            <option value="">Choose building</option>
                            {Object.keys(CAMPUS_LOCATIONS).map((location) => (
                                <option key={location} value={location}>{location}</option>
                            ))}
                        </select>
                        <input value={form.floor} onChange={(event) => setForm((current) => ({ ...current, floor: event.target.value }))} placeholder="Floor" className="campus-input rounded-[1rem] px-4 py-3" />
                        <input value={form.room} onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))} placeholder="Room / area" className="campus-input rounded-[1rem] px-4 py-3" />
                        <input value={form.gpsLabel} onChange={(event) => setForm((current) => ({ ...current, gpsLabel: event.target.value }))} placeholder="GPS label or landmark" className="campus-input rounded-[1rem] px-4 py-3" />
                        <input value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} placeholder="Latitude" className="campus-input rounded-[1rem] px-4 py-3" />
                        <input value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} placeholder="Longitude" className="campus-input rounded-[1rem] px-4 py-3" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <button onClick={handleUseGps} className="rounded-[1rem] border border-white/10 bg-white/10 px-4 py-3 text-sm text-white">
                            Use live GPS
                        </button>
                        <label className="rounded-[1rem] border border-white/10 bg-white/10 px-4 py-3 text-sm text-white">
                            Upload evidence
                            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleEvidenceUpload} />
                        </label>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {evidence.length === 0 ? <EmptyState title="Upload up to 5 images or videos as proof." /> : evidence.map((item) => (
                            <div key={item.id} className="rounded-[1rem] border border-white/10 bg-white/5 p-3 text-sm text-white/75">
                                <div className="font-semibold text-white">{item.name}</div>
                                <div className="mt-1 uppercase text-white/50">{item.type}</div>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => void handleSubmit()} disabled={issuesLoading} className="mt-5 rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
                        {issuesLoading ? 'Submitting...' : 'Submit issue'}
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="campus-panel rounded-[1.8rem] p-6">
                        <h3 className="text-xl font-bold text-white">Notification Preferences</h3>
                        <p className="mt-1 text-sm text-white/60">Choose how you want issue updates delivered when admins respond.</p>
                        <div className="mt-5 space-y-3">
                            {Object.entries(issueNotificationPreferences).map(([key, enabled]) => (
                                <button key={key} onClick={() => void toggleNotificationPreference(key)} className={`flex w-full items-center justify-between rounded-[1rem] border px-4 py-3 text-left text-sm ${enabled ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-white/5 text-white/70'}`}>
                                    <span>{key === 'inApp' ? 'In-app' : key.toUpperCase()}</span>
                                    <span>{enabled ? 'On' : 'Off'}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="campus-panel rounded-[1.8rem] p-6">
                        <h3 className="text-xl font-bold text-white">Issue Status Board</h3>
                        <div className="mt-4 space-y-3">
                            {ISSUE_STATUS_OPTIONS.map((status) => (
                                <div key={status} className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="capitalize">{status.replace(/_/g, ' ')}</span>
                                        <span className="font-semibold text-white">{reportedIssues.filter((issue) => issue.status === status).length}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="campus-panel rounded-[1.8rem] p-6">
                    <h3 className="text-xl font-bold text-white">My Issue Tracker</h3>
                    <div className="mt-5 space-y-3">
                            {reportedIssues.length === 0 ? <EmptyState title="No issue reports yet. Your submissions will show up here with live admin status changes." /> : reportedIssues.map((issue) => (
                            <button key={issue.id} onClick={() => setSelectedIssueId(issue.id)} className={`w-full rounded-[1rem] border p-4 text-left ${resolvedSelectedIssueId === issue.id ? 'border-cyan-400/30 bg-cyan-500/10' : 'border-white/10 bg-white/5'}`}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="font-semibold text-white">{issue.title}</div>
                                        <div className="mt-1 text-sm text-white/60">{issue.category} | {issue.department}</div>
                                    </div>
                                    <StatusBadge status={issue.status} />
                                </div>
                                <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/60">
                                    <span className="rounded-full border border-white/10 px-3 py-1 uppercase">{issue.priority}</span>
                                    <span>SLA due {new Date(issue.slaDueAt).toLocaleString()}</span>
                                    {isIssueSlaBreached(issue) ? <span className="text-rose-200">SLA risk</span> : null}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="campus-panel rounded-[1.8rem] p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-white">Issue Detail And Timeline</h3>
                            <p className="mt-1 text-sm text-white/60">Track every admin action, note, and evidence update in one place.</p>
                        </div>
                        {selectedIssue ? <StatusBadge status={selectedIssue.status} /> : null}
                    </div>
                    {!selectedIssue ? <div className="mt-5"><EmptyState title="Select an issue from the tracker to inspect its full timeline." /></div> : (
                        <div className="mt-5 space-y-5">
                            <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4 text-sm text-white/75">
                                <div className="text-lg font-semibold text-white">{selectedIssue.title}</div>
                                <div className="mt-2">{selectedIssue.description}</div>
                                <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/55">
                                    <span>{selectedIssue.location.building || 'No building'}</span>
                                    <span>{selectedIssue.location.floor || 'No floor'}</span>
                                    <span>{selectedIssue.location.room || 'No room'}</span>
                                    <span>{selectedIssue.location.latitude && selectedIssue.location.longitude ? `${selectedIssue.location.latitude}, ${selectedIssue.location.longitude}` : 'No GPS pinned'}</span>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                                    <div className="text-sm font-semibold text-white">Submitted Evidence</div>
                                    <div className="mt-3 grid gap-3">
                                        {selectedIssue.evidence.length === 0 ? <EmptyState title="No evidence uploaded." /> : selectedIssue.evidence.map((item) => (
                                            <div key={item.id} className="rounded-[1rem] border border-white/10 bg-slate-950/30 p-3 text-sm text-white/75">
                                                <div className="font-medium text-white">{item.name}</div>
                                                <div className="mt-1 uppercase text-white/50">{item.type}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                                    <div className="text-sm font-semibold text-white">Resolution Tracking</div>
                                    <div className="mt-3 space-y-3 text-sm text-white/75">
                                        <div className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-4 py-3">Department: {selectedIssue.department || getIssueDepartment(selectedIssue.category)}</div>
                                        <div className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-4 py-3">SLA due: {new Date(selectedIssue.slaDueAt).toLocaleString()}</div>
                                        <div className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-4 py-3">Before photos: {selectedIssue.beforeAfter.before.length}</div>
                                        <div className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-4 py-3">After photos: {selectedIssue.beforeAfter.after.length}</div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="text-sm font-semibold text-white">Admin timeline</div>
                                <div className="mt-3 space-y-3">
                                    {selectedIssue.timeline.length === 0 ? <EmptyState title="No updates on this issue yet." /> : selectedIssue.timeline.map((entry) => (
                                        <div key={entry.id} className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div className="font-semibold text-white">{entry.title}</div>
                                                <div className="text-xs text-white/50">{new Date(entry.createdAt).toLocaleString()}</div>
                                            </div>
                                            <div className="mt-2 text-white/65">{entry.notes || 'No notes added.'}</div>
                                            <div className="mt-2 text-xs uppercase tracking-[0.16em] text-white/45">{entry.actorRole} | {entry.actorName}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {(selectedIssue.status === 'resolved' || selectedIssue.status === 'closed') ? (
                                <div className="rounded-[1.2rem] border border-emerald-400/20 bg-emerald-500/10 p-4">
                                    <div className="text-sm font-semibold text-white">Satisfaction Rating</div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {[1, 2, 3, 4, 5].map((value) => (
                                            <button key={value} onClick={() => setRatingDraft((current) => ({ ...current, rating: value }))} className={`rounded-full px-4 py-2 text-sm ${ratingDraft.rating === value ? 'bg-emerald-400 text-slate-950' : 'border border-white/10 bg-white/10 text-white'}`}>
                                                {value}
                                            </button>
                                        ))}
                                    </div>
                                    <textarea value={ratingDraft.comment} onChange={(event) => setRatingDraft((current) => ({ ...current, comment: event.target.value }))} placeholder="Optional feedback for the admin team" className="campus-input mt-4 min-h-28 w-full rounded-[1rem] px-4 py-3" />
                                    <button onClick={() => void handleSatisfactionSubmit()} className="mt-4 rounded-[1rem] border border-white/10 bg-white/10 px-4 py-3 text-sm text-white">
                                        Submit satisfaction feedback
                                    </button>
                                    {selectedIssue.satisfaction.rating ? (
                                        <div className="mt-3 text-sm text-emerald-100">
                                            Latest submitted rating: {selectedIssue.satisfaction.rating}/5
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
