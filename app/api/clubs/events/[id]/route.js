import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const EDITABLE_STATUSES = ['REJECTED_BY_COORDINATOR', 'REJECTED_BY_ADMIN'];

async function getSessionAndClient() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('club_session')?.value;
  if (!raw) return { session: null, supabase: null };
  let session;
  try { session = JSON.parse(raw); } catch { return { session: null, supabase: null }; }
  if (!session?.club_id) return { session: null, supabase: null };

  const supabase = createServerClient(
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
  return { session, supabase };
}

// PUT /api/clubs/events/[id] — edit a rejected event and re-submit
export async function PUT(request, { params }) {
  try {
    const { session, supabase } = await getSessionAndClient();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;

    const { data: existing } = await supabase
      .from('events')
      .select('id, club_id, status, version')
      .eq('id', id)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (existing.club_id !== session.club_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      return NextResponse.json({ error: 'Event cannot be edited in its current status' }, { status: 409 });
    }

    const body = await request.json();
    const { title, description, proposed_date, time_start, time_end, venue, expected_participants, registration_starts, event_end_date } = body;

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
        registration_starts: registration_starts || null,
        event_end_date: event_end_date || proposed_date,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ event: updated });
  } catch (err) {
    console.error('Club event PUT error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/clubs/events/[id] — withdraw event
export async function DELETE(request, { params }) {
  try {
    const { session, supabase } = await getSessionAndClient();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;

    const { data: existing } = await supabase
      .from('events')
      .select('id, club_id, status')
      .eq('id', id)
      .maybeSingle();

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
    console.error('Club event DELETE error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
