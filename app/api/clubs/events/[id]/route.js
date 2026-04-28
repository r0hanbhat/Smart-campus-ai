import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const EDITABLE_STATUSES = ['REJECTED_BY_COORDINATOR', 'REJECTED_BY_ADMIN'];

function getClubSession() {
  const cookieStore = cookies();
  const raw = cookieStore.get('club_session')?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function createAdminClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
}

// PUT /api/clubs/events/[id] — edit a rejected event and re-submit
export async function PUT(request, { params }) {
  try {
    const session = getClubSession();
    if (!session?.club_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const supabase = createAdminClient();

    // Verify ownership and editability
    const { data: existing } = await supabase
      .from('events')
      .select('id, club_id, status, version')
      .eq('id', id)
      .single();

    if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (existing.club_id !== session.club_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      return NextResponse.json({ error: 'Event cannot be edited in its current status' }, { status: 409 });
    }

    const body = await request.json();
    const { title, description, proposed_date, time_start, time_end, venue, expected_participants } = body;

    const { data: updated, error } = await supabase
      .from('events')
      .update({
        title: title?.trim(),
        description: description?.trim() || '',
        proposed_date,
        time_start,
        time_end,
        venue: venue?.trim() || null,
        expected_participants: expected_participants || 0,
        status: 'PENDING_COORDINATOR_APPROVAL',
        rejection_reason: null,
        version: existing.version + 1,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ event: updated });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/clubs/events/[id] — withdraw event
export async function DELETE(request, { params }) {
  try {
    const session = getClubSession();
    if (!session?.club_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from('events')
      .select('id, club_id, status')
      .eq('id', id)
      .single();

    if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (existing.club_id !== session.club_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (existing.status === 'APPROVED') return NextResponse.json({ error: 'Cannot withdraw an approved event' }, { status: 409 });

    const { error } = await supabase
      .from('events')
      .update({ status: 'WITHDRAWN' })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ withdrawn: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
