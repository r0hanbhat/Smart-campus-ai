import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';
import { generateEmbedding } from '@/lib/server/embeddings';
import { chunkDocument } from '@/lib/server/rag';

// ── Auth guard helper ─────────────────────────────────────────────────────────
async function requireAdmin() {
    const { user, supabase, error } = await getAuthenticatedUser();
    if (error || !user?.id) return { adminError: 'Unauthorized', status: 401 };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

    if (profile?.role !== 'admin') return { adminError: 'Admin access required.', status: 403 };
    return { user };
}

// ── POST /api/admin/knowledge ─ ingest a single pre-chunked piece ─────────────
// ── POST /api/admin/knowledge?bulk=1 ─ ingest full document (auto-chunk) ─────
export async function POST(request) {
    try {
        const { adminError, status } = await requireAdmin();
        if (adminError) return NextResponse.json({ error: adminError }, { status });

        const url = new URL(request.url);
        const isBulk = url.searchParams.get('bulk') === '1';
        const body   = await request.json();

        const source   = typeof body.source   === 'string' ? body.source.trim()   : '';
        const category = typeof body.category === 'string' ? body.category.trim() : 'general';
        const title    = typeof body.title    === 'string' ? body.title.trim()     : source;
        const metadata = typeof body.metadata === 'object' ? body.metadata : {};

        if (!source) return NextResponse.json({ error: 'source is required.' }, { status: 400 });

        const serviceClient = createSupabaseServiceRoleClient();

        // ── Bulk mode: split the document text into chunks, embed each ──────────
        if (isBulk) {
            const rawText = typeof body.content === 'string' ? body.content.trim() : '';
            if (!rawText) return NextResponse.json({ error: 'content is required for bulk ingest.' }, { status: 400 });

            const chunkSize = Number(body.chunkSize) || 500;
            const overlap   = Number(body.overlap)   || 80;
            const textChunks = chunkDocument(rawText, chunkSize, overlap);

            const results = { inserted: 0, failed: 0, errors: [] };

            for (let i = 0; i < textChunks.length; i++) {
                const chunk = textChunks[i];
                const embedding = await generateEmbedding(chunk);

                if (!embedding) {
                    results.failed++;
                    results.errors.push(`Chunk ${i}: embedding failed`);
                    continue;
                }

                const { error: insertError } = await serviceClient
                    .from('knowledge_chunks')
                    .insert({
                        content: chunk,
                        embedding,
                        source,
                        category,
                        title,
                        chunk_index: i,
                        metadata,
                    });

                if (insertError) {
                    results.failed++;
                    results.errors.push(`Chunk ${i}: ${insertError.message}`);
                } else {
                    results.inserted++;
                }
            }

            return NextResponse.json({
                success: true,
                totalChunks: textChunks.length,
                ...results,
            });
        }

        // ── Single chunk mode ─────────────────────────────────────────────────
        const content     = typeof body.content     === 'string' ? body.content.trim()     : '';
        const chunkIndex  = typeof body.chunkIndex  === 'number' ? body.chunkIndex          : 0;

        if (!content) return NextResponse.json({ error: 'content is required.' }, { status: 400 });

        const embedding = await generateEmbedding(content);
        if (!embedding) {
            return NextResponse.json(
                { error: 'Failed to generate embedding. Check HUGGINGFACE_API_KEY.' },
                { status: 502 },
            );
        }

        const { data, error: insertError } = await serviceClient
            .from('knowledge_chunks')
            .insert({ content, embedding, source, category, title, chunk_index: chunkIndex, metadata })
            .select('id, source, category, title, chunk_index, created_at')
            .single();

        if (insertError) {
            if (insertError.code === '42P01') {
                return NextResponse.json(
                    { error: 'knowledge_chunks table not found. Run rag_schema.sql in Supabase first.' },
                    { status: 503 },
                );
            }
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, chunk: data });
    } catch (error) {
        console.error('Knowledge ingest error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Ingest failed.' }, { status: 500 });
    }
}

// ── GET /api/admin/knowledge ─ list chunks ────────────────────────────────────
export async function GET(request) {
    try {
        const { adminError, status } = await requireAdmin();
        if (adminError) return NextResponse.json({ error: adminError }, { status });

        const serviceClient = createSupabaseServiceRoleClient();
        const url    = new URL(request.url);
        const page   = Math.max(1, Number(url.searchParams.get('page')  || 1));
        const limit  = Math.min(50, Number(url.searchParams.get('limit') || 20));
        const cat    = url.searchParams.get('category') || '';
        const from   = (page - 1) * limit;

        let query = serviceClient
            .from('knowledge_chunks')
            .select('id, source, category, title, chunk_index, metadata, created_at, content', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, from + limit - 1);

        if (cat) query = query.eq('category', cat);

        const { data: chunks, error, count } = await query;

        if (error) {
            if (error.code === '42P01') return NextResponse.json({ chunks: [], total: 0 });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ chunks: chunks || [], total: count || 0, page, limit });
    } catch (error) {
        console.error('Knowledge GET error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed.' }, { status: 500 });
    }
}

// ── DELETE /api/admin/knowledge ─ remove a chunk by id ───────────────────────
export async function DELETE(request) {
    try {
        const { adminError, status } = await requireAdmin();
        if (adminError) return NextResponse.json({ error: adminError }, { status });

        const { id } = await request.json();
        if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

        const serviceClient = createSupabaseServiceRoleClient();
        const { error } = await serviceClient.from('knowledge_chunks').delete().eq('id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Knowledge DELETE error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed.' }, { status: 500 });
    }
}
