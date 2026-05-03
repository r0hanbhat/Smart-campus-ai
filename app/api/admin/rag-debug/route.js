import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { generateEmbedding } from '@/lib/server/embeddings';

/**
 * GET /api/admin/rag-debug
 * Runs a full diagnostic of the RAG pipeline and returns a detailed report.
 * Admin only.
 */
export async function GET() {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const serviceClient = createSupabaseServiceRoleClient();
    const report = { steps: [], passed: 0, failed: 0, recommendation: '' };

    const step = (name, ok, detail, extra = {}) => {
      report.steps.push({ name, ok, detail, ...extra });
      if (ok) {
        report.passed++;
      } else {
        report.failed++;
      }
    };

    // ── Step 1: pgvector extension ────────────────────────────────────────────
    const { data: extData, error: extErr } = await serviceClient
      .from('pg_extension')
      .select('extname')
      .eq('extname', 'vector')
      .maybeSingle()
      .catch(() => ({ data: null, error: { message: 'pg_extension query not allowed' } }));

    step('pgvector extension', !extErr || extErr.message.includes('not allowed'),
      extErr ? `Cannot verify directly — ${extErr.message}` : (extData ? 'Installed ✓' : 'NOT installed'));

    // ── Step 2: knowledge_chunks table ────────────────────────────────────────
    const { error: tableErr } = await serviceClient
      .from('knowledge_chunks')
      .select('id', { count: 'exact', head: true });

    if (tableErr?.code === '42P01') {
      step('knowledge_chunks table', false, 'Table does NOT exist — run rag_schema.sql in Supabase');
      report.recommendation = 'Run rag_schema.sql in the Supabase SQL Editor. The knowledge_chunks table is missing.';
      return NextResponse.json(report);
    }

    const { count: chunkCount, error: countErr } = await serviceClient
      .from('knowledge_chunks')
      .select('*', { count: 'exact', head: true });

    step('knowledge_chunks table', !countErr, countErr ? countErr.message : `Exists ✓ — ${chunkCount ?? 0} chunks stored`, { chunkCount: chunkCount ?? 0 });

    if (!chunkCount || chunkCount === 0) {
      report.recommendation = 'Table exists but is EMPTY. Upload knowledge documents from the Admin → Knowledge Base panel first.';
    }

    // ── Step 3: HuggingFace embedding ─────────────────────────────────────────
    const testQuery = 'attendance rules campus policy';
    let embedding = null;
    try {
      embedding = await generateEmbedding(testQuery);
      step('HuggingFace embedding', !!embedding,
        embedding ? `Generated 384-dim vector ✓ (sample: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}, …])` : 'Returned null — check HUGGINGFACE_API_KEY',
        { dims: embedding?.length ?? 0 });
    } catch (e) {
      step('HuggingFace embedding', false, `Exception: ${e.message}`);
    }

    if (!embedding) {
      report.recommendation = 'Embedding generation failed. Verify HUGGINGFACE_API_KEY in .env.local is valid.';
      return NextResponse.json(report);
    }

    // ── Step 4: match_knowledge_chunks RPC exists ─────────────────────────────
    const { data: rpcData, error: rpcErr } = await serviceClient.rpc('match_knowledge_chunks', {
      query_embedding: embedding,
      match_threshold: 0.0, // use 0 to return ANY results regardless of similarity
      match_count: 3,
    });

    if (rpcErr?.code === '42883') {
      step('match_knowledge_chunks RPC', false, 'Function does NOT exist — run rag_schema.sql');
      report.recommendation = 'The match_knowledge_chunks PostgreSQL function is missing. Run rag_schema.sql in Supabase SQL Editor.';
      return NextResponse.json(report);
    }

    step('match_knowledge_chunks RPC (threshold=0.0)', !rpcErr,
      rpcErr ? rpcErr.message : `Returned ${rpcData?.length ?? 0} chunks at threshold=0.0`,
      { resultsAtZeroThreshold: rpcData?.length ?? 0, topSimilarities: (rpcData || []).slice(0, 3).map(c => ({ title: c.title, similarity: c.similarity })) });

    // ── Step 5: Try with production threshold (0.45) ──────────────────────────
    const { data: rpcProd, error: rpcProdErr } = await serviceClient.rpc('match_knowledge_chunks', {
      query_embedding: embedding,
      match_threshold: 0.45,
      match_count: 5,
    });

    step('match_knowledge_chunks RPC (threshold=0.45)', !rpcProdErr && (rpcProd?.length ?? 0) > 0,
      rpcProdErr ? rpcProdErr.message : `Returned ${rpcProd?.length ?? 0} chunks — ${(rpcProd?.length ?? 0) === 0 ? '⚠️ 0 results means threshold is too high for your data' : 'OK ✓'}`,
      { resultsAtProductionThreshold: rpcProd?.length ?? 0 });

    // ── Step 6: Sample chunks in DB ───────────────────────────────────────────
    const { data: samples } = await serviceClient
      .from('knowledge_chunks')
      .select('id, source, category, title, chunk_index, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    step('Sample knowledge chunks', true, `Showing ${samples?.length ?? 0} most recent`, { samples: samples || [] });

    // ── Final recommendation ──────────────────────────────────────────────────
    if (!report.recommendation) {
      const zeroThresholdCount = rpcData?.length ?? 0;
      const prodThresholdCount = rpcProd?.length ?? 0;
      if (zeroThresholdCount > 0 && prodThresholdCount === 0) {
        report.recommendation = `Similarity threshold (0.45) is too high for your data. The top similarity score is ~${rpcData?.[0]?.similarity?.toFixed(3) ?? '?'}. Lowering the threshold to 0.25 should fix retrieval.`;
      } else if (zeroThresholdCount === 0) {
        report.recommendation = 'No chunks returned even at threshold=0. The table may be empty or embeddings are malformed.';
      } else {
        report.recommendation = 'RAG pipeline appears healthy. If the chatbot still ignores context, the LLM may be overriding it — check the system prompt grounding rules.';
      }
    }

    return NextResponse.json(report);
  } catch (err) {
    console.error('RAG debug error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
