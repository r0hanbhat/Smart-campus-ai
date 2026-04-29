import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';

// POST /api/coordinator/events/[id]/review
export async function POST(request, { params }) {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { action, reason } = await request.json();

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }
    if (action === 'reject' && !reason?.trim()) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    // Use service role to bypass RLS
    const serviceClient = createSupabaseServiceRoleClient();

    const { data: event } = await serviceClient
      .from('events')
      .select('id, status, club_id')
      .eq('id', id)
      .maybeSingle();

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.status !== 'PENDING_COORDINATOR_APPROVAL') {
      return NextResponse.json({ error: 'Event is not pending coordinator approval' }, { status: 409 });
    }

    const newStatus = action === 'approve' ? 'APPROVED_BY_COORDINATOR' : 'REJECTED_BY_COORDINATOR';

    const { error: updateError } = await serviceClient
      .from('events')
      .update({
        status: newStatus,
        rejection_reason: action === 'reject' ? reason.trim() : null,
      })
      .eq('id', id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await serviceClient.from('event_approvals').insert({
      event_id: id,
      actor_id: user.id,
      actor_role: 'coordinator',
      action: action === 'approve' ? 'APPROVED' : 'REJECTED',
      reason: reason?.trim() || null,
    });

    return NextResponse.json({ status: newStatus });
  } catch (err) {
    console.error('Coordinator review error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
