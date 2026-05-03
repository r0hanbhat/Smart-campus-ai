-- ============================================================
-- RAG SCHEMA — Smart Campus AI Knowledge Base
-- Run this in Supabase SQL Editor
-- Requires: pgvector extension enabled (Dashboard → Database → Extensions → vector)
-- ============================================================

-- Enable pgvector
create extension if not exists vector;

-- ── Knowledge chunks table ──────────────────────────────────
create table if not exists public.knowledge_chunks (
    id           uuid        primary key default gen_random_uuid(),
    content      text        not null,
    embedding    vector(384),                        -- all-MiniLM-L6-v2 dims
    source       text        not null,               -- e.g. "Attendance Policy 2025"
    category     text        not null default 'general',
    title        text,                               -- human-friendly document name
    chunk_index  int         not null default 0,     -- position within original doc
    metadata     jsonb       not null default '{}',  -- dept, year, effective_date…
    created_at   timestamptz not null default timezone('utc', now())
);

-- Constrain category to known types (add more as needed)
alter table public.knowledge_chunks
    drop constraint if exists knowledge_chunks_category_check;
alter table public.knowledge_chunks
    add constraint knowledge_chunks_category_check
    check (category in (
        'attendance', 'exam', 'hostel', 'fees', 'syllabus',
        'calendar', 'clubs', 'circular', 'help', 'general'
    ));

-- Index for fast cosine similarity search (needs >= 100 rows to be effective)
create index if not exists knowledge_chunks_embedding_idx
    on public.knowledge_chunks
    using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

create index if not exists knowledge_chunks_category_idx
    on public.knowledge_chunks (category);

create index if not exists knowledge_chunks_source_idx
    on public.knowledge_chunks (source);

-- ── Row-Level Security ───────────────────────────────────────
alter table public.knowledge_chunks enable row level security;

-- Any authenticated user can read knowledge chunks
drop policy if exists "authenticated users read knowledge" on public.knowledge_chunks;
create policy "authenticated users read knowledge"
    on public.knowledge_chunks
    for select
    to authenticated
    using (true);

-- Only service-role client (admin API) can write — no policy = deny for anon/authenticated

-- ── Similarity search RPC ────────────────────────────────────
-- Returns chunks ordered by cosine similarity (highest first)
create or replace function match_knowledge_chunks(
    query_embedding vector(384),
    match_threshold float  default 0.45,
    match_count     int    default 5
)
returns table (
    id          uuid,
    content     text,
    source      text,
    category    text,
    title       text,
    chunk_index int,
    metadata    jsonb,
    similarity  float
)
language sql stable
as $$
    select
        kc.id,
        kc.content,
        kc.source,
        kc.category,
        kc.title,
        kc.chunk_index,
        kc.metadata,
        1 - (kc.embedding <=> query_embedding) as similarity
    from public.knowledge_chunks kc
    where kc.embedding is not null
      and 1 - (kc.embedding <=> query_embedding) > match_threshold
    order by kc.embedding <=> query_embedding
    limit match_count;
$$;
