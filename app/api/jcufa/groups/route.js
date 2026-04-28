import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';

// GET /api/jcufa/groups
export async function GET() {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: groups, error } = await supabase
      .from('jcufa_chat_groups')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ groups: groups || [] });
  } catch (err) {
    console.error('JCUFA groups error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
