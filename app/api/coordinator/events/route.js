import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';

// GET /api/coordinator/events — pending events for coordinator review
export async function GET() {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Use service role to bypass RLS on events table
    const serviceClient = createSupabaseServiceRoleClient();

    const { data: events, error } = await serviceClient
      .from('events')
      .select(`
        *,
        club:clubs!events_club_id_fkey(id, club_name),
        approvals:event_approvals(actor_role, action, reason, acted_at)
      `)
      .eq('status', 'PENDING_COORDINATOR_APPROVAL')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: events || [] });
  } catch (err) {
    console.error('Coordinator events error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
