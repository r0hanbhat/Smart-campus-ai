'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ISSUE_CATEGORIES, ISSUE_PRIORITY_OPTIONS, ISSUE_STATUS_OPTIONS } from '@/lib/smart-campus/issues.js';

const WORKSPACE_TABS = [
    { id: 'details', label: 'Details' },
    { id: 'action', label: 'Action' },
    { id: 'timeline', label: 'Timeline' },
];

const PIPELINE_STEPS = [
    { id: 'submitted', label: 'Submitted' },
    { id: 'triaged', label: 'Triaged' },
    { id: 'assigned', label: 'Assigned' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'awaiting_student', label: 'Awaiting Student' },
    { id: 'resolved', label: 'Resolved / Closed' },
];

const PRIORITY_ACCENTS = {
    critical: {
        stripe: 'border-l-4 border-l-rose-400',
        dot: 'bg-rose-300',
        soft: 'bg-rose-500/12 text-rose-100',
    },
    high: {
        stripe: 'border-l-4 border-l-amber-400',
        dot: 'bg-amber-300',
        soft: 'bg-amber-500/12 text-amber-700',
    },
    medium: {
        stripe: 'border-l-4 border-l-sky-400',
        dot: 'bg-sky-300',
        soft: 'bg-sky-500/12 text-sky-700',
    },
    low: {
        stripe: 'border-l-4 border-l-slate-400',
        dot: 'bg-slate-300',
        soft: 'bg-slate-500/12 text-slate-500',
    },
};

function EmptyState({ title }) {
    return (
        <div className="rounded-[1.2rem] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
            {title}
        </div>
    );
}

function EvidencePreview({ item }) {
    const src = item?.url || item?.dataUrl || '';
    return (
        <div className="overflow-hidden rounded-[1rem] border border-slate-200 bg-slate-100">
            {src ? (
                item.type === 'video' ? (
                    <video src={src} controls className="h-44 w-full bg-slate-950 object-cover" />
                ) : (
                    <img src={src} alt={item.name || 'Issue evidence'} className="h-44 w-full object-cover" />
                )
            ) : (
                <div className="flex h-44 items-center justify-center text-sm text-slate-400">Preview unavailable</div>
            )}
            <div className="p-3 text-sm text-slate-600">
                <div className="font-medium text-slate-900">{item.name}</div>
                <div className="mt-1 uppercase text-slate-400">{item.type}</div>
            </div>
        </div>
    );
}

function StatusBadge({ status }) {
    const tone = status === 'resolved' || status === 'closed'
        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-700'
        : status === 'awaiting_student'
            ? 'border-amber-400/30 bg-amber-500/10 text-amber-700'
            : 'border-sky-400/30 bg-sky-500/10 text-sky-700';
    return <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${tone}`}>{status.replace(/_/g, ' ')}</span>;
}

function CategoryBadge({ category }) {
    return (
        <span className="inline-flex rounded-full border border-slate-200 bg-white/[0.08] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-700">
            {category}
        </span>
    );
}

function formatDateLabel(value) {
    if (!value) {
        return 'Not available';
    }
    return new Date(value).toLocaleString();
}

function formatRelativeSla(value) {
    if (!value) {
        return { breached: false, label: 'SLA pending' };
    }

    const dueAt = new Date(value).getTime();
    const diffMs = dueAt - Date.now();
    if (diffMs <= 0) {
        return { breached: true, label: 'SLA Breached' };
    }

    const totalMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
    if (totalMinutes < 60) {
        return { breached: false, label: `${totalMinutes}m left` };
    }

    const totalHours = Math.floor(totalMinutes / 60);
    const remMinutes = totalMinutes % 60;
    return {
        breached: false,
        label: `${totalHours}h${remMinutes ? ` ${remMinutes}m` : ''} left`,
    };
}

function getEvidenceIcon(type) {
    if (type === 'video') {
        return 'VID';
    }
    if (type === 'image') {
        return 'IMG';
    }
    return 'FILE';
}

function getPriorityAccent(priority) {
    return PRIORITY_ACCENTS[priority] || PRIORITY_ACCENTS.low;
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
    const [workspaceTab, setWorkspaceTab] = useState('details');
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
        const nextIssues = Array.isArray(payload.issues) ? payload.issues : [];
        setIssues(nextIssues);
        setAnalytics(payload.analytics || { total: 0, open: 0, critical: 0, breached: 0, averageSatisfaction: 0, byCategory: [] });
        if (!selectedIssueId && nextIssues.length > 0) {
            const first = nextIssues[0];
            setActionForm({
                status: first.status || 'triaged',
                department: first.department || '',
                note: '',
                resolutionSummary: first.resolutionSummary || '',
            });
        }
        setLoading(false);
    }, [filters, selectedIssueId]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void fetchIssues();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [fetchIssues]);

    const issueKeys = useMemo(() => issues.map((issue) => `${issue.reporter.userId}::${issue.id}`), [issues]);
    const resolvedSelectedIssueId = selectedIssueId || issues[0]?.id || '';
    const selectedIssue = useMemo(() => issues.find((issue) => issue.id === resolvedSelectedIssueId) || null, [issues, resolvedSelectedIssueId]);
    const departments = useMemo(() => Array.from(new Set(issues.map((issue) => issue.department).filter(Boolean))).sort(), [issues]);
    const highlightedCounts = useMemo(() => ({
        submitted: issues.filter((issue) => issue.status === 'submitted').length,
        inProgress: issues.filter((issue) => ['triaged', 'assigned', 'in_progress'].includes(issue.status)).length,
        resolved: issues.filter((issue) => ['resolved', 'closed'].includes(issue.status)).length,
    }), [issues]);
    // Use resolvedSelectedIssueId so auto-selected first issue also gets live actionForm
    // after the useEffect syncs it on load.
    const activeActionForm = selectedIssue && selectedIssue.id === resolvedSelectedIssueId
        ? actionForm
        : {
            status: selectedIssue?.status || 'submitted',
            department: selectedIssue?.department || '',
            note: '',
            resolutionSummary: selectedIssue?.resolutionSummary || '',
        };
    const allVisibleSelected = issueKeys.length > 0 && issueKeys.every((key) => selectedKeys.includes(key));
    const selectedCount = selectedKeys.length;
    const maxCategoryCount = Math.max(...(analytics.byCategory || []).map((item) => item.count), 0);

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
            return null;
        }

        const updated = Array.isArray(payload.updatedIssues) ? payload.updatedIssues : [];
        const movedOutsideStatusFilter = filters.status
            && updated.length > 0
            && updated.every((issue) => issue?.status !== filters.status);

        if (movedOutsideStatusFilter) {
            setFilters((current) => ({ ...current, status: '' }));
        }
        else {
            await fetchIssues();
        }

        return payload;
    };

    const handleSingleUpdate = async () => {
        if (!selectedIssue) {
            return;
        }

        // Upload after-evidence to Supabase Storage first, then save URLs (not base64)
        let afterEvidenceWithUrls = afterEvidence.map(({ id, type, name, mimeType }) => ({ id, type, name, mimeType, url: '' }));
        if (afterEvidence.length > 0) {
            try {
                const uploadRes = await fetch('/api/upload-evidence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        files: afterEvidence.map(({ id, name, mimeType, dataUrl }) => ({ id, name, mimeType, dataUrl })),
                    }),
                });
                if (uploadRes.ok) {
                    const { uploaded } = await uploadRes.json();
                    afterEvidenceWithUrls = (uploaded || []).map(({ id, name, mimeType, url }) => ({
                        id, type: 'image', name, mimeType, url, dataUrl: '',
                    }));
                    if (afterEvidenceWithUrls.some((item) => !item.url)) {
                        setError('One or more after photos could not be uploaded. Please try again.');
                        return;
                    }
                }
                else {
                    setError('After-photo upload failed. Please try again.');
                    return;
                }
            } catch {
                setError('After-photo upload failed. Please try again.');
                return;
            }
        }

        const payload = await submitIssueUpdate([{
            userId: selectedIssue.reporter.userId,
            issueId: selectedIssue.id,
        }], {
            status: activeActionForm.status,
            department: activeActionForm.department || selectedIssue.department,
            resolutionSummary: activeActionForm.resolutionSummary,
            afterEvidence: afterEvidenceWithUrls,
        }, activeActionForm.note);
        if (payload) {
            setActionForm((current) => ({ ...current, note: '' }));
            setAfterEvidence([]);
            const updatedIssue = Array.isArray(payload.updatedIssues) ? payload.updatedIssues[0] : null;
            if (updatedIssue?.id) {
                setSelectedIssueId(updatedIssue.id);
            }
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
        const payload = await submitIssueUpdate(refs, {
            status: bulkForm.status,
            department: bulkForm.department,
        }, bulkForm.note);
        if (payload) {
            setSelectedKeys([]);
            setBulkForm({ status: '', department: '', note: '' });
        }
    };

    const selectIssue = (issue, tab = workspaceTab) => {
        setSelectedIssueId(issue.id);
        setWorkspaceTab(tab);
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

    const toggleSelectAllVisible = () => {
        setSelectedKeys((current) => {
            if (allVisibleSelected) {
                return current.filter((key) => !issueKeys.includes(key));
            }
            const next = new Set(current);
            issueKeys.forEach((key) => next.add(key));
            return Array.from(next);
        });
    };

    const setPipelineStatus = (stepId) => {
        if (!selectedIssue) {
            return;
        }
        const nextStatus = stepId === 'resolved'
            ? (selectedIssue.status === 'closed' ? 'closed' : 'resolved')
            : stepId;
        // Lock in selectedIssueId so activeActionForm reads from actionForm
        // (not the fallback). Without this, pipeline clicks have no visual effect
        // and Save submits the old status.
        setSelectedIssueId(selectedIssue.id);
        setActionForm((current) => ({ ...current, status: nextStatus }));
        setWorkspaceTab('action');
    };

    return (
        <div className="space-y-6 pb-28">
            <div className="campus-panel-strong rounded-[2rem] p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <div className="campus-kicker">Ops Console</div>
                        <h3 className="mt-3 text-2xl font-bold text-slate-900">Issue Management</h3>
                        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
                            Review urgent campus issues, move them through the workflow, and keep evidence, notes, and timelines in one workspace.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => setShowAdvancedFilters((current) => !current)} className="rounded-full border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm text-slate-900">
                            {showAdvancedFilters ? 'Hide filters' : 'Show filters'}
                        </button>
                        <button onClick={() => void fetchIssues()} className="rounded-full border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm text-slate-900">
                            Refresh queue
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-[1.6rem] border border-sky-400/20 bg-gradient-to-br from-sky-500/20 to-sky-500/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-sky-700/70">Total</div>
                    <div className="mt-3 text-3xl font-bold text-slate-900">{analytics.total}</div>
                </div>
                <div className="rounded-[1.6rem] border border-amber-400/20 bg-gradient-to-br from-amber-500/20 to-amber-500/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-amber-700/70">Open</div>
                    <div className="mt-3 text-3xl font-bold text-slate-900">{analytics.open}</div>
                </div>
                <div className="rounded-[1.6rem] border border-rose-400/20 bg-gradient-to-br from-rose-500/20 to-rose-500/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-rose-200/70">Critical</div>
                    <div className="mt-3 text-3xl font-bold text-slate-900">{analytics.critical}</div>
                </div>
                <div className="rounded-[1.6rem] border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-500/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-fuchsia-700/70">SLA Breached</div>
                    <div className="mt-3 text-3xl font-bold text-slate-900">{analytics.breached}</div>
                </div>
                <div className="rounded-[1.6rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-emerald-700/70">Avg Rating</div>
                    <div className="mt-3 text-3xl font-bold text-slate-900">{analytics.averageSatisfaction || '0.0'}</div>
                </div>
            </div>

            {error ? (
                <div className="rounded-[1.2rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                    {error}
                </div>
            ) : null}

            <div className="campus-panel rounded-[1.8rem] p-5 sm:p-6">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                            <div className="text-lg font-semibold text-slate-900">Search + Filter Bar</div>
                            <div className="mt-1 text-sm text-slate-500">Find the issue quickly, then open it in the workspace.</div>
                        </div>
                        <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search by title, reporter, category, department, location, or notes" className="campus-input w-full rounded-[1rem] px-4 py-3 xl:max-w-xl" />
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => setFilters((current) => ({ ...current, status: '' }))} className={`rounded-full px-4 py-2 text-sm ${filters.status === '' ? 'bg-white text-slate-950' : 'border border-slate-200 bg-slate-50 text-slate-600'}`}>
                            All ({issues.length})
                        </button>
                        <button onClick={() => setFilters((current) => ({ ...current, status: 'submitted' }))} className={`rounded-full px-4 py-2 text-sm ${filters.status === 'submitted' ? 'bg-white text-slate-950' : 'border border-slate-200 bg-slate-50 text-slate-600'}`}>
                            New ({highlightedCounts.submitted})
                        </button>
                        <button onClick={() => setFilters((current) => ({ ...current, status: 'triaged' }))} className={`rounded-full px-4 py-2 text-sm ${['triaged', 'assigned', 'in_progress'].includes(filters.status) ? 'bg-white text-slate-950' : 'border border-slate-200 bg-slate-50 text-slate-600'}`}>
                            In Progress ({highlightedCounts.inProgress})
                        </button>
                        <button onClick={() => setFilters((current) => ({ ...current, status: 'resolved' }))} className={`rounded-full px-4 py-2 text-sm ${filters.status === 'resolved' ? 'bg-white text-slate-950' : 'border border-slate-200 bg-slate-50 text-slate-600'}`}>
                            Resolved ({highlightedCounts.resolved})
                        </button>
                        <button onClick={clearFilters} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                            Reset
                        </button>
                    </div>

                    {showAdvancedFilters ? (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
                <div className="campus-panel rounded-[1.8rem] p-5 sm:p-6 xl:col-span-1">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h4 className="text-xl font-bold text-slate-900">Issue Queue</h4>
                            <div className="mt-1 text-sm text-slate-500">Scrollable queue with compact triage cards.</div>
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm text-slate-500">
                            <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                            Select all visible
                        </label>
                    </div>

                    <div className="mt-4 text-sm text-slate-500">{issues.length} visible</div>

                    <div className="campus-scroll mt-5 max-h-[44rem] space-y-3 overflow-y-auto pr-1">
                        {loading ? <EmptyState title="Loading issue queue..." /> : issues.length === 0 ? <EmptyState title="No issues matched the current filters." /> : issues.map((issue) => {
                            const issueKey = `${issue.reporter.userId}::${issue.id}`;
                            const isChecked = selectedKeys.includes(issueKey);
                            const isActive = resolvedSelectedIssueId === issue.id;
                            const sla = formatRelativeSla(issue.slaDueAt);
                            const accent = getPriorityAccent(issue.priority);

                            return (
                                <div
                                    key={issueKey}
                                    className={`rounded-[1.25rem] border ${accent.stripe} transition ${isActive ? 'border-sky-300/60 bg-sky-500/10 shadow-[0_0_0_1px_rgba(103,232,249,0.35),0_0_28px_rgba(34,211,238,0.15)]' : isChecked ? 'border-slate-200 bg-slate-100' : 'border-slate-200 bg-slate-50 hover:bg-white/[0.08]'}`}
                                >
                                    <div className="flex items-start gap-3 p-4">
                                        <input type="checkbox" checked={isChecked} onChange={() => setSelectedKeys((current) => isChecked ? current.filter((value) => value !== issueKey) : [...current, issueKey])} className="mt-1" />
                                        <button onClick={() => selectIssue(issue)} className="min-w-0 flex-1 text-left">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="truncate font-semibold text-slate-900">{issue.title}</div>
                                                <div className={`h-2.5 w-2.5 rounded-full ${accent.dot}`} />
                                                <CategoryBadge category={issue.category} />
                                                <StatusBadge status={issue.status} />
                                            </div>

                                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-500">
                                                <span className="font-medium text-slate-700">{issue.reporter.name}</span>
                                                <span>{issue.location.building || 'No building'}</span>
                                                <span>{issue.department || 'Unassigned department'}</span>
                                            </div>

                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${sla.breached ? 'bg-rose-500/18 text-rose-100 ring-1 ring-inset ring-rose-400/35' : 'bg-amber-500/16 text-amber-700 ring-1 ring-inset ring-amber-400/30'}`}>
                                                    {sla.label}
                                                </span>
                                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${accent.soft}`}>
                                                    {issue.priority}
                                                </span>
                                                <span className="text-xs text-slate-400">Reported {formatDateLabel(issue.createdAt)}</span>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-6 xl:col-span-2">
                    <div className="campus-panel rounded-[1.8rem] p-5 sm:p-6">
                        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <h4 className="text-xl font-bold text-slate-900">Issue Workspace</h4>
                                <div className="mt-1 text-sm text-slate-500">Tabbed master-detail workspace for one selected issue.</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {WORKSPACE_TABS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setWorkspaceTab(tab.id)}
                                        className={`rounded-full px-4 py-2 text-sm transition ${workspaceTab === tab.id ? 'bg-white text-slate-950' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {!selectedIssue ? (
                            <div className="mt-5">
                                <EmptyState title="Select an issue from the queue to inspect it and update the workflow." />
                            </div>
                        ) : (
                            <div className="mt-5 space-y-5">
                                <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h5 className="text-lg font-semibold text-slate-900">{selectedIssue.title}</h5>
                                                <CategoryBadge category={selectedIssue.category} />
                                                <StatusBadge status={selectedIssue.status} />
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                                                <span>{selectedIssue.reporter.name}</span>
                                                <span>{selectedIssue.reporter.email || 'No email available'}</span>
                                                <span>{selectedIssue.department}</span>
                                            </div>
                                        </div>
                                        <div className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${formatRelativeSla(selectedIssue.slaDueAt).breached ? 'bg-rose-500/18 text-rose-100 ring-1 ring-inset ring-rose-400/35' : 'bg-amber-500/16 text-amber-700 ring-1 ring-inset ring-amber-400/30'}`}>
                                            {formatRelativeSla(selectedIssue.slaDueAt).label}
                                        </div>
                                    </div>
                                    <div className="mt-4 text-sm leading-7 text-slate-600">{selectedIssue.description}</div>
                                </div>

                                {workspaceTab === 'details' ? (
                                    <div className="grid gap-4 xl:grid-cols-2">
                                        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                                            <div className="text-sm font-semibold text-slate-900">Reporter Info</div>
                                            <div className="mt-3 space-y-3 text-sm text-slate-600">
                                                <div className="rounded-[1rem] border border-slate-200 bg-slate-100 px-4 py-3">Reporter: {selectedIssue.reporter.name}</div>
                                                <div className="rounded-[1rem] border border-slate-200 bg-slate-100 px-4 py-3">Email: {selectedIssue.reporter.email || 'Not available'}</div>
                                                <div className="rounded-[1rem] border border-slate-200 bg-slate-100 px-4 py-3">Department: {selectedIssue.department || 'Not assigned'}</div>
                                                <div className="rounded-[1rem] border border-slate-200 bg-slate-100 px-4 py-3">Category: {selectedIssue.category}</div>
                                            </div>
                                        </div>

                                        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                                            <div className="text-sm font-semibold text-slate-900">Location + SLA</div>
                                            <div className="mt-3 space-y-3 text-sm text-slate-600">
                                                <div className="rounded-[1rem] border border-slate-200 bg-slate-100 px-4 py-3">Building: {selectedIssue.location.building || 'Not set'}</div>
                                                <div className="rounded-[1rem] border border-slate-200 bg-slate-100 px-4 py-3">Floor / Room: {selectedIssue.location.floor || 'No floor'} / {selectedIssue.location.room || 'No room'}</div>
                                                <div className="rounded-[1rem] border border-slate-200 bg-slate-100 px-4 py-3">GPS: {selectedIssue.location.latitude && selectedIssue.location.longitude ? `${selectedIssue.location.latitude}, ${selectedIssue.location.longitude}` : 'Not pinned'}</div>
                                                <div className="rounded-[1rem] border border-slate-200 bg-slate-100 px-4 py-3">Reported: {formatDateLabel(selectedIssue.createdAt)}</div>
                                                <div className="rounded-[1rem] border border-slate-200 bg-slate-100 px-4 py-3">SLA Due: {formatDateLabel(selectedIssue.slaDueAt)}</div>
                                            </div>
                                        </div>

                                        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 xl:col-span-2">
                                            <div className="text-sm font-semibold text-slate-900">Evidence Files</div>
                                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                                {selectedIssue.evidence.length === 0 ? <EmptyState title="No evidence uploaded for this issue." /> : selectedIssue.evidence.map((item) => (
                                                    <EvidencePreview key={item.id} item={item} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {workspaceTab === 'action' ? (
                                    <div className="space-y-5">
                                        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-5">
                                            <div className="text-sm font-semibold text-slate-900">Status Pipeline</div>
                                            <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                                                {PIPELINE_STEPS.map((step, index) => {
                                                    const terminalStatuses = ['resolved', 'closed'];
                                                    const currentStepIndex = terminalStatuses.includes(activeActionForm.status)
                                                        ? PIPELINE_STEPS.length - 1
                                                        : PIPELINE_STEPS.findIndex((item) => item.id === activeActionForm.status);
                                                    const isComplete = index <= currentStepIndex;
                                                    const isCurrent = (step.id === 'resolved' && terminalStatuses.includes(activeActionForm.status)) || activeActionForm.status === step.id;

                                                    return (
                                                        <button
                                                            key={step.id}
                                                            onClick={() => setPipelineStatus(step.id)}
                                                            className={`rounded-[1.1rem] border px-4 py-4 text-left transition ${isCurrent ? 'border-sky-300/60 bg-sky-500/12 shadow-[0_0_24px_rgba(34,211,238,0.15)]' : 'border-slate-200 bg-slate-800/25 hover:bg-white/[0.07]'}`}
                                                        >
                                                            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{index < PIPELINE_STEPS.length - 1 ? 'Step' : 'Finish'}</div>
                                                            <div className="mt-2 font-semibold text-slate-900">{step.label}</div>
                                                            <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
                                                                <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${isComplete ? 'border-sky-300/60 bg-sky-400 text-slate-950' : 'border-slate-200 text-slate-500'}`}>
                                                                    {isComplete ? '●' : '○'}
                                                                </span>
                                                                <span>{isCurrent ? 'Active' : 'Set status'}</span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-5">
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <select value={activeActionForm.status} onChange={(event) => setActionForm((current) => ({ ...current, status: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3">
                                                    {ISSUE_STATUS_OPTIONS.map((status) => (
                                                        <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                                                    ))}
                                                </select>
                                                <input value={activeActionForm.department} onChange={(event) => setActionForm((current) => ({ ...current, department: event.target.value }))} placeholder="Assigned department" className="campus-input rounded-[1rem] px-4 py-3" />
                                            </div>
                                            <textarea value={activeActionForm.note} onChange={(event) => setActionForm((current) => ({ ...current, note: event.target.value }))} placeholder="Add an admin note for the team or reporter" className="campus-input mt-3 min-h-28 rounded-[1rem] px-4 py-3" />
                                            <textarea value={activeActionForm.resolutionSummary} onChange={(event) => setActionForm((current) => ({ ...current, resolutionSummary: event.target.value }))} placeholder="Resolution summary or next action" className="campus-input mt-3 min-h-28 rounded-[1rem] px-4 py-3" />
                                            <div className="mt-3 flex flex-wrap gap-3">
                                                <label className="inline-flex w-fit rounded-[1rem] border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900">
                                                    Upload after photos
                                                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleAfterEvidenceUpload} />
                                                </label>
                                                <button onClick={() => void handleSingleUpdate()} className="rounded-[1rem] bg-gradient-to-r from-sky-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950">
                                                    Save
                                                </button>
                                            </div>
                                            {afterEvidence.length > 0 ? (
                                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                                    {afterEvidence.map((item) => (
                                                        <EvidencePreview key={item.id} item={item} />
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}

                                {workspaceTab === 'timeline' ? (
                                    <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-5">
                                        <div className="text-sm font-semibold text-slate-900">Issue Timeline</div>
                                        <div className="mt-5">
                                            {selectedIssue.timeline.length === 0 ? <EmptyState title="No timeline events yet." /> : (
                                                <div className="space-y-4">
                                                    {selectedIssue.timeline.map((entry) => (
                                                        <div key={entry.id} className="grid grid-cols-[auto_1fr] gap-4">
                                                            <div className="flex flex-col items-center">
                                                                <span className="mt-1 h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_16px_rgba(34,211,238,0.5)]" />
                                                                <span className="mt-2 h-full w-px bg-white/12" />
                                                            </div>
                                                            <div className="rounded-[1rem] border border-slate-200 bg-slate-100 px-4 py-4 text-sm text-slate-700">
                                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                                    <div>
                                                                        <div className="font-semibold text-slate-900">{entry.title}</div>
                                                                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{entry.actorName} / {entry.actorRole}</div>
                                                                    </div>
                                                                    <div className="text-xs text-slate-400">{formatDateLabel(entry.createdAt)}</div>
                                                                </div>
                                                                <div className="mt-3 text-slate-500">{entry.notes || 'No notes recorded.'}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>

                    <div className="campus-panel rounded-[1.8rem] p-5 sm:p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h4 className="text-xl font-bold text-slate-900">Category Distribution</h4>
                                <div className="mt-1 text-sm text-slate-500">Horizontal bar chart based on current filtered results.</div>
                            </div>
                            <div className="text-sm text-slate-400">Full width view</div>
                        </div>

                        <div className="mt-5 space-y-4">
                            {(analytics.byCategory || []).length === 0 ? <EmptyState title="Issue category analytics will appear here once reports are filed." /> : analytics.byCategory.map((item) => {
                                const width = maxCategoryCount > 0 ? `${(item.count / maxCategoryCount) * 100}%` : '0%';
                                return (
                                    <div key={item.category} className="space-y-2">
                                        <div className="flex items-center justify-between gap-4 text-sm">
                                            <span className="font-semibold text-slate-900">{item.category}</span>
                                            <span className="text-slate-500">{item.count}</span>
                                        </div>
                                        <div className="h-3 overflow-hidden rounded-full bg-white/[0.08] ring-1 ring-inset ring-white/[0.08]">
                                            <div className="h-full rounded-full bg-gradient-to-r from-sky-400 via-sky-400 to-emerald-300" style={{ width }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {selectedCount > 0 ? (
                <div className="fixed bottom-5 left-1/2 z-40 w-[min(92vw,74rem)] -translate-x-1/2 rounded-[1.4rem] border border-sky-300/20 bg-slate-800/85 p-4 shadow-[0_20px_50px_rgba(5,1,15,0.45)] backdrop-blur-xl">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="text-sm font-medium text-slate-900">{selectedCount} selected</div>
                        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
                            <select value={bulkForm.status} onChange={(event) => setBulkForm((current) => ({ ...current, status: event.target.value }))} className="campus-input rounded-[1rem] px-4 py-3 lg:max-w-52">
                                <option value="">Change status</option>
                                {ISSUE_STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                            <input value={bulkForm.department} onChange={(event) => setBulkForm((current) => ({ ...current, department: event.target.value }))} placeholder="Department" className="campus-input rounded-[1rem] px-4 py-3 lg:max-w-60" />
                            <button onClick={() => void handleBulkUpdate()} className="rounded-[1rem] bg-gradient-to-r from-sky-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950">
                                Apply
                            </button>
                            <button onClick={() => { setSelectedKeys([]); setBulkForm({ status: '', department: '', note: '' }); }} className="rounded-[1rem] border border-white/12 bg-slate-50 px-5 py-3 text-sm text-slate-700">
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
