import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { retrieveContext } from '@/lib/server/rag';

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

    const { data, count, error } = await serviceClient.from('knowledge_chunks')
      .select('content', { count: 'exact' }).order('created_at', { ascending: false }).limit(1);
    step('Stored chunks', !error, error?.message || String(count));
    if (data?.length) {
      const result = await retrieveContext(data[0].content);
      step('Full-text retrieval', result.hasContext, `${result.chunks.length} matching passages`);
    }
    report.recommendation = error ? 'Check knowledge table access.' : count ? '' : 'Ingest a document first.';
    return NextResponse.json(report);
  } catch (err) {
    console.error('RAG debug error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
