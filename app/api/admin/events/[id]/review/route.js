import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';

// POST /api/admin/events/[id]/review
export async function POST(request, { params }) {
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
      .select('id, status')
      .eq('id', id)
      .maybeSingle();

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.status !== 'APPROVED_BY_COORDINATOR') {
      return NextResponse.json({ error: 'Event must be coordinator-approved first' }, { status: 409 });
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED_BY_ADMIN';
    const isPublished = action === 'approve';

    const { error: updateError } = await serviceClient
      .from('events')
      .update({
        status: newStatus,
        is_published: isPublished,
        rejection_reason: action === 'reject' ? reason.trim() : null,
      })
      .eq('id', id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await serviceClient.from('event_approvals').insert({
      event_id: id,
      actor_id: user.id,
      actor_role: 'admin',
      action: action === 'approve' ? 'APPROVED' : 'REJECTED',
      reason: reason?.trim() || null,
    });

    return NextResponse.json({ status: newStatus, is_published: isPublished });
  } catch (err) {
    console.error('Admin event review error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
