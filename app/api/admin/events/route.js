import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';

// GET /api/admin/events
export async function GET(request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';

    // Use service role to bypass RLS on events table
    const serviceClient = createSupabaseServiceRoleClient();

    let query = serviceClient
      .from('events')
      .select(`
        *,
        club:clubs!events_club_id_fkey(id, club_name, coordinator_id),
        registrations:event_registrations(count),
        approvals:event_approvals(actor_role, action, reason, acted_at)
      `)
      .order('created_at', { ascending: false });

    if (!all) {
      query = query.eq('status', 'APPROVED_BY_COORDINATOR');
    }

    const { data: events, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: events || [] });
  } catch (err) {
    console.error('Admin events error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
