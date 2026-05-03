'use client';

import { useCallback, useEffect, useState } from 'react';

const CATEGORIES = [
    { value: 'attendance', label: '📋 Attendance' },
    { value: 'exam',       label: '📝 Exam' },
    { value: 'hostel',     label: '🏠 Hostel' },
    { value: 'fees',       label: '💳 Fees' },
    { value: 'syllabus',   label: '📚 Syllabus' },
    { value: 'calendar',   label: '📅 Calendar' },
    { value: 'clubs',      label: '🎭 Clubs' },
    { value: 'circular',   label: '📣 Circular' },
    { value: 'help',       label: '🆘 Help / Info' },
    { value: 'general',    label: '🗂️ General' },
];

const CATEGORY_COLORS = {
    attendance: 'text-cyan-300 bg-cyan-500/10 border-cyan-400/20',
    exam:       'text-violet-300 bg-violet-500/10 border-violet-400/20',
    hostel:     'text-amber-300 bg-amber-500/10 border-amber-400/20',
    fees:       'text-emerald-300 bg-emerald-500/10 border-emerald-400/20',
    syllabus:   'text-blue-300 bg-blue-500/10 border-blue-400/20',
    calendar:   'text-pink-300 bg-pink-500/10 border-pink-400/20',
    clubs:      'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-400/20',
    circular:   'text-orange-300 bg-orange-500/10 border-orange-400/20',
    help:       'text-teal-300 bg-teal-500/10 border-teal-400/20',
    general:    'text-slate-300 bg-slate-500/10 border-slate-400/20',
};

function CategoryPill({ category }) {
    const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.general;
    const label  = CATEGORIES.find(c => c.value === category)?.label || category;
    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${colors}`}>
            {label}
        </span>
    );
}

// ── Tab: Add Knowledge ────────────────────────────────────────────────────────
function AddKnowledgeTab() {
    const [form, setForm] = useState({
        title: '',
        source: '',
        category: 'general',
        content: '',
        metadata: '',
    });
    const [ingesting, setIngesting] = useState(false);
    const [result, setResult]       = useState(null);
    const [error, setError]         = useState('');
    const [chunkSize, setChunkSize] = useState(500);

    const handleIngest = async () => {
        if (!form.title.trim() || !form.content.trim()) {
            setError('Title and content are required.');
            return;
        }
        setIngesting(true);
        setError('');
        setResult(null);

        let metadata = {};
        if (form.metadata.trim()) {
            try { metadata = JSON.parse(form.metadata); }
            catch { metadata = {}; } // silently ignore invalid JSON
        }

        const res = await fetch(`/api/admin/knowledge?bulk=1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                title:     form.title.trim(),
                source:    form.source.trim() || form.title.trim(),
                category:  form.category,
                content:   form.content.trim(),
                metadata,
                chunkSize,
                overlap:   Math.round(chunkSize * 0.16),
            }),
        });

        const payload = await res.json().catch(() => ({ error: 'Request failed.' }));
        setIngesting(false);

        if (!res.ok) { setError(payload.error || 'Ingest failed.'); return; }

        setResult(payload);
        setForm({ title: '', source: '', category: 'general', content: '', metadata: '' });
    };

    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
                <div>
                    <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/45">Document Title *</div>
                    <input
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="e.g. Attendance Policy 2025"
                        className="campus-input w-full rounded-[1rem] px-4 py-3"
                    />
                </div>
                <div>
                    <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/45">Source / Author</div>
                    <input
                        value={form.source}
                        onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                        placeholder="e.g. Academic Section, HOD Notice"
                        className="campus-input w-full rounded-[1rem] px-4 py-3"
                    />
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <div>
                    <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/45">Category *</div>
                    <select
                        value={form.category}
                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                        className="campus-input w-full rounded-[1rem] px-4 py-3"
                    >
                        {CATEGORIES.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/45">Chunk Size (chars)</div>
                    <select
                        value={chunkSize}
                        onChange={e => setChunkSize(Number(e.target.value))}
                        className="campus-input w-full rounded-[1rem] px-4 py-3"
                    >
                        <option value={300}>300 — Short notices</option>
                        <option value={500}>500 — Policy docs (recommended)</option>
                        <option value={700}>700 — Syllabus / Calendar</option>
                    </select>
                </div>
            </div>

            <div>
                <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/45">Document Content * (paste the full text)</div>
                <textarea
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    placeholder="Paste the full document text here. It will be automatically split into chunks and embedded."
                    className="campus-input min-h-[14rem] w-full rounded-[1rem] px-4 py-3 font-mono text-sm"
                />
                <div className="mt-1 text-right text-xs text-white/35">
                    {form.content.length} chars · ≈ {Math.ceil(form.content.length / chunkSize)} chunk(s)
                </div>
            </div>

            <div>
                <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/45">Metadata (optional JSON)</div>
                <input
                    value={form.metadata}
                    onChange={e => setForm(f => ({ ...f, metadata: e.target.value }))}
                    placeholder='{"department":"CSE","effective_date":"2025-01"}'
                    className="campus-input w-full rounded-[1rem] px-4 py-3 font-mono text-xs"
                />
            </div>

            <button
                onClick={handleIngest}
                disabled={ingesting || !form.title.trim() || !form.content.trim()}
                className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
                {ingesting ? '⏳ Ingesting & Embedding…' : '🧠 Ingest into Knowledge Base'}
            </button>

            {error && (
                <div className="rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
            )}
            {result && (
                <div className="rounded-[1rem] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                    ✅ Ingested {result.inserted} chunk(s) successfully.
                    {result.failed > 0 && <span className="ml-2 text-amber-300">{result.failed} failed.</span>}
                </div>
            )}
        </div>
    );
}

// ── Tab: Browse Chunks ────────────────────────────────────────────────────────
function BrowseChunksTab() {
    const [chunks, setChunks]     = useState([]);
    const [total, setTotal]       = useState(0);
    const [page, setPage]         = useState(1);
    const [loading, setLoading]   = useState(false);
    const [category, setCategory] = useState('');
    const [deleting, setDeleting] = useState(null);
    const LIMIT = 10;

    const load = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page, limit: LIMIT });
        if (category) params.set('category', category);
        const res = await fetch(`/api/admin/knowledge?${params}`, { credentials: 'same-origin' });
        const payload = await res.json().catch(() => ({}));
        setChunks(payload.chunks || []);
        setTotal(payload.total || 0);
        setLoading(false);
    }, [page, category]);

    useEffect(() => {
        const t = setTimeout(() => void load(), 0);
        return () => clearTimeout(t);
    }, [load]);

    const handleDelete = async (id) => {
        setDeleting(id);
        await fetch('/api/admin/knowledge', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ id }),
        });
        setDeleting(null);
        void load();
    };

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={category}
                    onChange={e => { setCategory(e.target.value); setPage(1); }}
                    className="campus-input rounded-[1rem] px-4 py-2 text-sm"
                >
                    <option value="">All categories</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <span className="text-sm text-white/45">{total} chunk(s) total</span>
                <button onClick={() => void load()} className="ml-auto rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15">
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-[1rem] bg-white/5" />)}</div>
            ) : chunks.length === 0 ? (
                <div className="rounded-[1rem] border border-dashed border-white/10 py-12 text-center text-sm text-white/45">
                    No knowledge chunks yet. Use the &quot;Add Knowledge&quot; tab to ingest documents.
                </div>
            ) : (
                <div className="space-y-2">
                    {chunks.map(chunk => (
                        <div key={chunk.id} className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <CategoryPill category={chunk.category} />
                                    <span className="text-sm font-semibold text-white">{chunk.title || chunk.source}</span>
                                    <span className="text-xs text-white/40">chunk #{chunk.chunk_index}</span>
                                </div>
                                <button
                                    onClick={() => handleDelete(chunk.id)}
                                    disabled={deleting === chunk.id}
                                    className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                                >
                                    {deleting === chunk.id ? 'Removing…' : 'Remove'}
                                </button>
                            </div>
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/55">{chunk.content}</p>
                        </div>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-40">← Prev</button>
                    <span className="text-sm text-white/55">Page {page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-40">Next →</button>
                </div>
            )}
        </div>
    );
}

// ── Tab: Test Retrieval ───────────────────────────────────────────────────────
function TestRetrievalTab() {
    const [query, setQuery]     = useState('');
    const [results, setResults] = useState(null);
    const [testing, setTesting] = useState(false);
    const [error, setError]     = useState('');

    const handleTest = async () => {
        if (!query.trim()) return;
        setTesting(true);
        setError('');
        setResults(null);
        const res = await fetch('/api/chat/rag-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ query: query.trim() }),
        });
        const payload = await res.json().catch(() => ({ error: 'Request failed.' }));
        setTesting(false);
        if (!res.ok) { setError(payload.error || 'Test failed.'); return; }
        setResults(payload.chunks || []);
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-3">
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleTest()}
                    placeholder="e.g. What is the minimum attendance required?"
                    className="campus-input flex-1 rounded-[1rem] px-4 py-3"
                />
                <button
                    onClick={handleTest}
                    disabled={testing || !query.trim()}
                    className="rounded-[1rem] bg-gradient-to-r from-violet-500 to-cyan-400 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {testing ? 'Searching…' : 'Test'}
                </button>
            </div>

            {error && <div className="rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

            {results !== null && (
                results.length === 0 ? (
                    <div className="rounded-[1rem] border border-dashed border-white/10 py-8 text-center text-sm text-white/45">
                        No matching chunks found. Try a lower similarity threshold or ingest relevant content.
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="text-xs text-white/45">{results.length} chunk(s) matched</div>
                        {results.map((c, i) => (
                            <div key={c.id} className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className="text-xs font-bold text-cyan-400">#{i + 1}</span>
                                    <CategoryPill category={c.category} />
                                    <span className="text-sm font-semibold text-white">{c.title || c.source}</span>
                                    <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                                        {Math.round(c.similarity * 100)}% match
                                    </span>
                                </div>
                                <p className="text-xs leading-5 text-white/65 whitespace-pre-wrap">{c.content}</p>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
const TABS = [
    { id: 'add',    label: '➕ Add Knowledge' },
    { id: 'browse', label: '📂 Browse Chunks' },
    { id: 'test',   label: '🔍 Test Retrieval' },
];

export default function AdminKnowledgePanel() {
    const [activeTab, setActiveTab] = useState('add');

    return (
        <div className="campus-panel rounded-[2rem] p-6 space-y-5">
            <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    🧠 Campus Knowledge Base
                    <span className="rounded-full bg-violet-500/15 border border-violet-400/20 px-2.5 py-0.5 text-xs font-medium text-violet-300">RAG</span>
                </h3>
                <p className="mt-1 text-sm text-white/55">
                    Ingest official documents so the AI chatbot answers campus questions accurately — no hallucination.
                </p>
            </div>

            {/* Tab nav */}
            <div className="flex gap-2 rounded-[1.2rem] border border-white/10 bg-white/5 p-1.5">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`flex-1 rounded-[0.9rem] py-2 text-sm font-medium transition ${
                            activeTab === t.id
                                ? 'bg-white/15 text-white'
                                : 'text-white/55 hover:text-white'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'add'    && <AddKnowledgeTab />}
            {activeTab === 'browse' && <BrowseChunksTab />}
            {activeTab === 'test'   && <TestRetrievalTab />}
        </div>
    );
}
