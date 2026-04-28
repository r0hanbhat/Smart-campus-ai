import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { retrieveContext } from '@/lib/server/rag';

/**
 * POST /api/chat/rag-test
 * Admin-only: test what chunks would be retrieved for a given query.
 */
export async function POST(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle();

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
        }

        const body = await request.json();
        const query = typeof body?.query === 'string' ? body.query.trim() : '';
        if (!query) return NextResponse.json({ error: 'query is required.' }, { status: 400 });

        const result = await retrieveContext(query, { threshold: 0.35, topK: 8 });

        return NextResponse.json({
            query,
            chunks:     result.chunks,
            sources:    result.sources,
            hasContext: result.hasContext,
        });
    } catch (error) {
        console.error('RAG test error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Test failed.' },
            { status: 500 },
        );
    }
}
