import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';

export async function GET(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const params = new URL(request.url).searchParams;
        const limit = Math.min(Number(params.get('limit') || 30), 100);

        // RLS automatically filters to notices matching the user's role or 'all'
        const { data: notices, error } = await supabase
            .from('notices')
            .select('id, title, message, target_role, created_at')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            if (error.code === '42P01') return NextResponse.json({ notices: [] });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ notices: notices || [] });
    } catch (error) {
        console.error('Notices GET Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load notices.' }, { status: 500 });
    }
}
