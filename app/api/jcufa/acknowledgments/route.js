import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';

const POSITION_HOLDERS = ['President', 'Vice President', 'Secretary', 'Treasurer'];

// GET /api/jcufa/acknowledgments?message_id=xxx
export async function GET(request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('message_id');
    if (!messageId) return NextResponse.json({ error: 'message_id is required' }, { status: 400 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('jcufa_position')
      .eq('user_id', user.id)
      .maybeSingle();

    const isPositionHolder = profile && POSITION_HOLDERS.includes(profile.jcufa_position);

    const { count: totalMembers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .not('jcufa_position', 'is', null)
      .eq('role', 'teacher');

    if (isPositionHolder) {
      const { data: acks } = await supabase
        .from('jcufa_acknowledgments')
        .select('user_id, acknowledged_at, user:profiles!jcufa_acknowledgments_user_id_fkey(full_name, display_name)')
        .eq('message_id', messageId);

      const ackedUserIds = new Set((acks || []).map(a => a.user_id));

      const { data: allMembers } = await supabase
        .from('profiles')
        .select('user_id, full_name, display_name')
        .not('jcufa_position', 'is', null)
        .eq('role', 'teacher');

      const pending = (allMembers || []).filter(m => !ackedUserIds.has(m.user_id));

      return NextResponse.json({
        acknowledged: acks || [],
        pending,
        ack_count: (acks || []).length,
        total_members: totalMembers || 0,
      });
    }

    const { count: ackCount } = await supabase
      .from('jcufa_acknowledgments')
      .select('*', { count: 'exact', head: true })
      .eq('message_id', messageId);

    return NextResponse.json({ ack_count: ackCount || 0, total_members: totalMembers || 0 });
  } catch (err) {
    console.error('JCUFA acknowledgments error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
