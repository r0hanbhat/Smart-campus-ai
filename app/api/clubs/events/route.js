import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

// GET /api/clubs/events — list own club's events
export async function GET() {
  try {
    const session = getClubSession();
    if (!session?.club_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createAdminClient();
    const { data: events, error } = await supabase
      .from('events')
      .select(`*, approvals:event_approvals(actor_role, action, reason, acted_at)`)
      .eq('club_id', session.club_id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: events || [] });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/clubs/events — submit new event proposal
export async function POST(request) {
  try {
    const session = getClubSession();
    if (!session?.club_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { title, description, proposed_date, time_start, time_end, venue, expected_participants } = body;

    if (!title?.trim() || !proposed_date || !time_start || !time_end) {
      return NextResponse.json({ error: 'title, proposed_date, time_start, time_end are required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        club_id: session.club_id,
        title: title.trim(),
        description: description?.trim() || '',
        proposed_date,
        time_start,
        time_end,
        venue: venue?.trim() || null,
        expected_participants: expected_participants || 0,
        status: 'PENDING_COORDINATOR_APPROVAL',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'An active event with this title and date already exists.' }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
