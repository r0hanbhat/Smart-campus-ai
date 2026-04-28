'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ISSUE_CATEGORIES, ISSUE_PRIORITY_OPTIONS, ISSUE_STATUS_OPTIONS } from '@/lib/smart-campus/issues.js';

function EmptyState({ title }) {
    return (
        <div className="rounded-[1.2rem] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
            {title}
        </div>
    );
}

function StatusBadge({ status }) {
    const tone = status === 'resolved' || status === 'closed'
        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
        : status === 'awaiting_student'
            ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
            : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100';
    return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${tone}`}>{status.replace(/_/g, ' ')}</span>;
}

function PriorityBadge({ priority }) {
    const tone = priority === 'critical'
        ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
        : priority === 'high'
            ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
            : priority === 'medium'
                ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100'
                : 'border-white/10 bg-white/5 text-white/70';
    return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${tone}`}>{priority}</span>;
}

function formatDateLabel(value) {
    if (!value) {
        return 'Not available';
    }
    return new Date(value).toLocaleString();
}

async function readFilesAsEvidence(fileList) {
    const files = Array.from(fileList || []).slice(0, 5);
    return Promise.all(files.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
            id: `after-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            type: 'image',
            name: file.name,
            mimeType: file.type,
            dataUrl: typeof reader.result === 'string' ? reader.result : '',
        });
        reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
        reader.readAsDataURL(file);
    })));
}

export default function AdminIssueManagementPanel() {
    const [issues, setIssues] = useState([]);
    const [analytics, setAnalytics] = useState({ total: 0, open: 0, critical: 0, breached: 0, averageSatisfaction: 0, byCategory: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        priority: '',
        category: '',
        department: '',
        sortBy: 'priority',
    });
    const [selectedIssueId, setSelectedIssueId] = useState('');
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [actionForm, setActionForm] = useState({
        status: 'triaged',
        department: '',
        note: '',
        resolutionSummary: '',
    });
    const [bulkForm, setBulkForm] = useState({
        status: '',
        department: '',
        note: '',
    });
    const [afterEvidence, setAfterEvidence] = useState([]);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    const fetchIssues = useCallback(async () => {
        setLoading(true);
        setError('');
        const query = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                query.set(key, value);
            }
        });
        const response = await fetch(`/api/admin/issues?${query.toString()}`, {
            method: 'GET',
            credentials: 'same-origin',
        });
        const payload = await response.json().catch(() => ({ error: 'Failed to load issues.' }));
        if (!response.ok) {
            setError(payload.error || 'Failed to load issues.');
            setLoading(false);
            return;
        }
        setIssues(Array.isArray(payload.issues) ? payload.issues : []);
        setAnalytics(payload.analytics || { total: 0, open: 0, critical: 0, breached: 0, averageSatisfaction: 0, byCategory: [] });
        setLoading(false);
    }, [filters]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void fetchIssues();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [fetchIssues]);

    const resolvedSelectedIssueId = selectedIssueId || issues[0]?.id || '';
    const selectedIssue = useMemo(() => issues.find((issue) => issue.id === resolvedSelectedIssueId) || null, [issues, resolvedSelectedIssueId]);
    const departments = useMemo(() => Array.from(new Set(issues.map((issue) => issue.department).filter(Boolean))).sort(), [issues]);
    const highlightedCounts = useMemo(() => ({
        submitted: issues.filter((issue) => issue.status === 'submitted').length,
        inProgress: issues.filter((issue) => ['triaged', 'assigned', 'in_progress'].includes(issue.status)).length,
        resolved: issues.filter((issue) => ['resolved', 'closed'].includes(issue.status)).length,
    }), [issues]);
    const activeActionForm = selectedIssue && selectedIssue.id === selectedIssueId
        ? actionForm
        : {
            status: selectedIssue?.status || 'triaged',
            department: selectedIssue?.department || '',
            note: '',
            resolutionSummary: selectedIssue?.resolutionSummary || '',
        };

    const submitIssueUpdate = async (issueRefs, updates, note) => {
        const response = await fetch('/api/admin/issues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                issueRefs,
                updates,
                note,
            }),
        });
        const payload = await response.json().catch(() => ({ error: 'Failed to update issues.' }));
        if (!response.ok) {
            setError(payload.error || 'Failed to update issues.');
            return false;
        }
        await fetchIssues();
        return true;
    };

    const handleSingleUpdate = async () => {
        if (!selectedIssue) {
            return;
        }
        const didSave = await submitIssueUpdate([{
            userId: selectedIssue.reporter.userId,
            issueId: selectedIssue.id,
        }], {
            status: activeActionForm.status,
            department: activeActionForm.department || selectedIssue.department,
            resolutionSummary: activeActionForm.resolutionSummary,
            afterEvidence,
        }, activeActionForm.note);
        if (didSave) {
            setActionForm((current) => ({ ...current, note: '' }));
            setAfterEvidence([]);
        }
    };

    const handleBulkUpdate = async () => {
        const refs = selectedKeys.map((key) => {
            const [userId, issueId] = key.split('::');
            return { userId, issueId };
        });
        if (refs.length === 0) {
            return;
        }
        const didSave = await submitIssueUpdate(refs, {
            status: bulkForm.status,
            department: bulkForm.department,
        }, bulkForm.note);
        if (didSave) {
            setSelectedKeys([]);
            setBulkForm({ status: '', department: '', note: '' });
        }
    };

    const selectIssue = (issue) => {
        setSelectedIssueId(issue.id);
        setActionForm({
            status: issue.status || 'triaged',
            department: issue.department || '',
            note: '',
            resolutionSummary: issue.resolutionSummary || '',
        });
        setAfterEvidence([]);
    };

    const handleAfterEvidenceUpload = async (event) => {
        try {
            const nextItems = await readFilesAsEvidence(event.target.files);
            setAfterEvidence(nextItems);
        }
        catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload after photos.');
        }
    };

    const clearFilters = () => {
        setFilters({
            search: '',
            status: '',
            priority: '',
            category: '',
            department: '',
            sortBy: 'priority',
        });
    };

    return (
        <div className="space-y-6">
            <div className="campus-panel-strong rounded-[2rem] p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <h3 className="text-2xl font-bold text-white">Issue Management</h3>
                        <p className="mt-2 max-w-3xl text-sm leading-7 text-white/60">
                            Review urgent campus issues, open one record at a time, and move it forward with clear updates.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => setShowAdvancedFilters((current) => !current)} className="rounded-full border border-white/10 bg-white/10 px-5 py-2.5 text-sm text-white">
                            {showAdvancedFilters ? 'Hide filters' : 'Show filters'}
                        </button>
                        <button onClick={() => void fetchIssues()} className="rounded-full border border-white/10 bg-white/10 px-5 py-2.5 text-sm text-white">
                            Refresh queue
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
                <div className="rounded-[1.6rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Total</div>
                    <div className="mt-3 text-3xl font-bold text-white">{analytics.total}</div>
                </div>
                <div className="rounded-[1.6rem] border border-amber-400/20 bg-gradient-to-br from-amber-500/20 to-amber-500/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-amber-200/70">Open</div>
                    <div className="mt-3 text-3xl font-bold text-white">{analytics.open}</div>
                </div>
                <div className="rounded-[1.6rem] border border-rose-400/20 bg-gradient-to-br from-rose-500/20 to-rose-500/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-rose-200/70">Critical</div>
                    <div className="mt-3 text-3xl font-bold text-white">{analytics.critical}</div>
                </div>
                <div className="rounded-[1.6rem] border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-500/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-fuchsia-200/70">SLA Breached</div>
                    <div className="mt-3 text-3xl font-bold text-white">{analytics.breached}</div>
                </div>
                <div className="rounded-[1.6rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">Avg Rating</div>
                    <div className="mt-3 text-3xl font-bold text-white">{analytics.averageSatisfaction || '0.0'}</div>
                </div>
            </div>

            {error ? (
                <div className="rounded-[1.2rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {error}
                </div>
            ) : null}

            <div className="campus-panel rounded-[1.8rem] p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="text-lg font-semibold text-white">Queue Controls</div>
                        <div className="mt-1 text-sm text-white/60">Search first, then open the issue you want to handle.</div>
                    </div>
                    <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search by title, student, category, department, or notes" className="campus-input w-full rounded-[1rem] px-4 py-3 lg:max-w-xl" />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                    <button onClick={() => setFilters((current) => ({ ...current, status: '' }))} className={`rounded-full px-4 py-2 text-sm ${filters.status === '' ? 'bg-white text-slate-950' : 'border border-white/10 bg-white/5 text-white/75'}`}>
                        All ({issues.length})
                    </button>
                    <button onClick={() => setFilters((current) => ({ ...current, status: 'submitted' }))} className={`rounded-full px-4 py-2 text-sm ${filters.status === 'submitted' ? 'bg-white text-slate-950' : 'border border-white/10 bg-white/5 text-white/75'}`}>
                        New ({highlightedCounts.submitted})
                    </button>
                    <button onClick={() => setFilters((current) => ({ ...current, status: 'in_progress' }))} className={`rounded-full px-4 py-2 text-sm ${filters.status === 'in_progress' ? 'bg-white text-slate-950' : 'border border-white/10 bg-white/5 text-white/75'}`}>
                        In Progress ({highlightedCounts.inProgress})
                    </button>
                    <button onClick={() => setFilters((current) => ({ ...current, status: 'resolved' }))} className={`rounded-full px-4 py-2 text-sm ${filters.status === 'resolved' ? 'bg-white text-slate-950' : 'border border-white/10 bg-white/5 text-white/75'}`}>
                        Resolved ({highlightedCounts.resolved})
                    </button>
                    <button onClick={clearFilters} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75">
                        Reset
                    </button>
                </div>
                {showAdvancedFilters ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                            <option value="">All statuses</option>
                            {ISSUE_STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                        <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                            <option value="">All priorities</option>
                            {ISSUE_PRIORITY_OPTIONS.map((priority) => (
                                <option key={priority} value={priority}>{priority}</option>
                            ))}
                        </select>
                        <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                            <option value="">All categories</option>
                            {ISSUE_CATEGORIES.map((category) => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                        <select value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                            <option value="">All departments</option>
                            {departments.map((department) => (
                                <option key={department} value={department}>{department}</option>
                            ))}
                        </select>
                        <select value={filters.sortBy} onChange={(event) => setFilters((current) => ({ ...current, sortBy: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                            <option value="priority">Priority queue</option>
                            <option value="newest">Newest first</option>
                            <option value="oldest">Oldest first</option>
                            <option value="sla">SLA soonest</option>
                        </select>
                    </div>
                ) : null}
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-6">
                    <div className="campus-panel rounded-[1.8rem] p-6">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h4 className="text-xl font-bold text-white">Issue Queue</h4>
                                <div className="mt-1 text-sm text-white/60">Open an issue card to review it in detail.</div>
                            </div>
                            <div className="text-sm text-white/60">{issues.length} visible</div>
                        </div>
                        <div className="mt-5 space-y-3">
                            {loading ? <EmptyState title="Loading issue queue..." /> : issues.length === 0 ? <EmptyState title="No issues matched the current filters." /> : issues.map((issue) => {
                                const issueKey = `${issue.reporter.userId}::${issue.id}`;
                                const isChecked = selectedKeys.includes(issueKey);
                                const isActive = resolvedSelectedIssueId === issue.id;
                                return (
                                    <div key={issueKey} className={`rounded-[1.15rem] border p-4 transition ${isActive ? 'border-cyan-400/30 bg-cyan-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                                        <div className="flex items-start gap-3">
                                            <input type="checkbox" checked={isChecked} onChange={() => setSelectedKeys((current) => isChecked ? current.filter((value) => value !== issueKey) : [...current, issueKey])} className="mt-1" />
                                            <button onClick={() => selectIssue(issue)} className="flex-1 text-left">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <div className="font-semibold text-white">{issue.title}</div>
                                                        <div className="mt-1 text-sm text-white/60">{issue.reporter.name} | {issue.location.building || 'No building'} | {issue.department}</div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <PriorityBadge priority={issue.priority} />
                                                        <StatusBadge status={issue.status} />
                                                    </div>
                                                </div>
                                                <div className="mt-3 text-sm leading-6 text-white/65">
                                                    {issue.description.length > 140 ? `${issue.description.slice(0, 140)}...` : issue.description}
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/50">
                                                    <span>Reported {formatDateLabel(issue.createdAt)}</span>
                                                    <span>SLA {formatDateLabel(issue.slaDueAt)}</span>
                                                    <span>{issue.evidence.length} evidence file{issue.evidence.length === 1 ? '' : 's'}</span>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="campus-panel rounded-[1.8rem] p-6">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="text-lg font-semibold text-white">Bulk Actions</div>
                                <div className="mt-1 text-sm text-white/60">Use this only when several selected issues need the same action.</div>
                            </div>
                            <div className="text-sm text-white/60">{selectedKeys.length} selected</div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <select value={bulkForm.status} onChange={(event) => setBulkForm((current) => ({ ...current, status: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                                <option value="">Bulk status</option>
                                {ISSUE_STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                            <input value={bulkForm.department} onChange={(event) => setBulkForm((current) => ({ ...current, department: event.target.value }))} placeholder="Bulk department" className="campus-input rounded-[1rem] px-4 py-3" />
                            <button onClick={() => void handleBulkUpdate()} className="rounded-[1rem] border border-white/10 bg-white/10 px-4 py-3 text-sm text-white">
                                Apply bulk update
                            </button>
                        </div>
                        <textarea value={bulkForm.note} onChange={(event) => setBulkForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional note for all selected issues" className="campus-input mt-3 min-h-24 rounded-[1rem] px-4 py-3" />
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="campus-panel rounded-[1.8rem] p-6">
                        <h4 className="text-xl font-bold text-white">Issue Workspace</h4>
                        {!selectedIssue ? <div className="mt-5"><EmptyState title="Select an issue from the queue to inspect it and update the workflow." /></div> : (
                            <div className="mt-5 space-y-5">
                                <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="text-lg font-semibold text-white">{selectedIssue.title}</div>
                                            <div className="mt-1 text-sm text-white/60">{selectedIssue.reporter.name} | {selectedIssue.reporter.email || 'No email available'}</div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <PriorityBadge priority={selectedIssue.priority} />
                                            <StatusBadge status={selectedIssue.status} />
                                        </div>
                                    </div>
                                    <div className="mt-4 text-sm leading-7 text-white/75">{selectedIssue.description}</div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                                        <div className="text-sm font-semibold text-white">Student And Location</div>
                                        <div className="mt-3 space-y-3 text-sm text-white/75">
                                            <div className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-4 py-3">Student: {selectedIssue.reporter.name}</div>
                                            <div className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-4 py-3">Building: {selectedIssue.location.building || 'Not set'}</div>
                                            <div className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-4 py-3">Floor / Room: {selectedIssue.location.floor || 'No floor'} | {selectedIssue.location.room || 'No room'}</div>
                                            <div className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-4 py-3">GPS: {selectedIssue.location.latitude && selectedIssue.location.longitude ? `${selectedIssue.location.latitude}, ${selectedIssue.location.longitude}` : 'Not pinned'}</div>
                                        </div>
                                    </div>
                                    <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                                        <div className="text-sm font-semibold text-white">Routing And SLA</div>
                                        <div className="mt-3 space-y-3 text-sm text-white/75">
                                            <div className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-4 py-3">Department: {selectedIssue.department}</div>
                                            <div className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-4 py-3">Reported: {formatDateLabel(selectedIssue.createdAt)}</div>
                                            <div className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-4 py-3">SLA due: {formatDateLabel(selectedIssue.slaDueAt)}</div>
                                            <div className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-4 py-3">After photos: {selectedIssue.beforeAfter.after.length + afterEvidence.length}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                                    <div className="text-sm font-semibold text-white">Evidence</div>
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        {selectedIssue.evidence.length === 0 ? <EmptyState title="No evidence uploaded for this issue." /> : selectedIssue.evidence.map((item) => (
                                            <div key={item.id} className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white/75">
                                                <div className="font-medium text-white">{item.name}</div>
                                                <div className="mt-1 uppercase text-white/50">{item.type}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                                    <div className="text-sm font-semibold text-white">Admin Action</div>
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        <select value={activeActionForm.status} onChange={(event) => setActionForm((current) => ({ ...current, status: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                                            {ISSUE_STATUS_OPTIONS.map((status) => (
                                                <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                                            ))}
                                        </select>
                                        <input value={activeActionForm.department} onChange={(event) => setActionForm((current) => ({ ...current, department: event.target.value }))} placeholder="Assigned department" className="campus-input rounded-[1rem] px-4 py-3" />
                                    </div>
                                    <textarea value={activeActionForm.note} onChange={(event) => setActionForm((current) => ({ ...current, note: event.target.value }))} placeholder="Add a clear admin update for the team or student" className="campus-input mt-3 min-h-24 rounded-[1rem] px-4 py-3" />
                                    <textarea value={activeActionForm.resolutionSummary} onChange={(event) => setActionForm((current) => ({ ...current, resolutionSummary: event.target.value }))} placeholder="Describe the fix or next action in plain language" className="campus-input mt-3 min-h-24 rounded-[1rem] px-4 py-3" />
                                    <div className="mt-3 flex flex-wrap gap-3">
                                        <label className="inline-flex w-fit rounded-[1rem] border border-white/10 bg-white/10 px-4 py-3 text-sm text-white">
                                            Upload after photos
                                            <input type="file" accept="image/*" multiple className="hidden" onChange={handleAfterEvidenceUpload} />
                                        </label>
                                        <button onClick={() => void handleSingleUpdate()} className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950">
                                            Save update
                                        </button>
                                    </div>
                                    {afterEvidence.length > 0 ? (
                                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                                            {afterEvidence.map((item) => (
                                                <div key={item.id} className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white/75">
                                                    {item.name}
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                                    <div className="text-sm font-semibold text-white">Timeline</div>
                                    <div className="mt-3 space-y-3">
                                        {selectedIssue.timeline.length === 0 ? <EmptyState title="No timeline events yet." /> : selectedIssue.timeline.map((entry) => (
                                            <div key={entry.id} className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white/80">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="font-semibold text-white">{entry.title}</div>
                                                    <div className="text-xs text-white/50">{formatDateLabel(entry.createdAt)}</div>
                                                </div>
                                                <div className="mt-2 text-white/65">{entry.notes || 'No notes recorded.'}</div>
                                                <div className="mt-2 text-xs uppercase tracking-[0.16em] text-white/45">{entry.actorRole} | {entry.actorName}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="campus-panel rounded-[1.8rem] p-6">
                        <h4 className="text-xl font-bold text-white">Category Distribution</h4>
                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                            {(analytics.byCategory || []).length === 0 ? <EmptyState title="Issue category analytics will appear here once reports are filed." /> : analytics.byCategory.map((item) => (
                                <div key={item.category} className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                                    <div className="font-semibold text-white">{item.category}</div>
                                    <div className="mt-2 text-2xl font-bold text-white">{item.count}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
