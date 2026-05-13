import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';

// GET /api/coordinator/events
// ?all=true  → return all events this coordinator has reviewed (for action history)
// default   → only PENDING_COORDINATOR_APPROVAL (for pending queue)
export async function GET(request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';

    const serviceClient = createSupabaseServiceRoleClient();

    // Find the club(s) this user coordinates
    const { data: coordClubs } = await serviceClient
      .from('clubs')
      .select('id')
      .eq('coordinator_id', user.id);

    const clubIds = (coordClubs || []).map(c => c.id);

    let query = serviceClient
      .from('events')
      .select(`
        *,
        club:clubs!events_club_id_fkey(id, club_name),
        approvals:event_approvals(actor_role, action, reason, acted_at)
      `)
      .order('created_at', { ascending: false });

    if (clubIds.length > 0) {
      query = query.in('club_id', clubIds);
    }

    if (!all) {
      query = query.eq('status', 'PENDING_COORDINATOR_APPROVAL');
    } else {
      // History = everything that has been reviewed (not pending)
      query = query.neq('status', 'PENDING_COORDINATOR_APPROVAL');
    }

    const { data: events, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: events || [] });
  } catch (err) {
    console.error('Coordinator events error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
