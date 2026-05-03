import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function createAdminClient(cookieStore) {
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
    const cookieStore = await cookies();
    const raw = cookieStore.get('club_session')?.value;
    if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    let session;
    try { session = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
    if (!session?.club_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createAdminClient(cookieStore);
    const { data: events, error } = await supabase
      .from('events')
      .select(`
        *,
        approvals:event_approvals(actor_role, action, reason, acted_at),
        registrations:event_registrations(
          student_id,
          registered_at,
          profile:profiles(full_name, display_name, roll_number, branch, course)
        )
      `)
      .eq('club_id', session.club_id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: events || [] });
  } catch (err) {
    console.error('Club events GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/clubs/events — submit new event proposal
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get('club_session')?.value;
    if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    let session;
    try { session = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
    if (!session?.club_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { title, description, proposed_date, time_start, time_end, venue, expected_participants } = body;

    if (!title?.trim() || !proposed_date || !time_start || !time_end) {
      return NextResponse.json({ error: 'title, proposed_date, time_start, time_end are required' }, { status: 400 });
    }

    const supabase = createAdminClient(cookieStore);
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
    console.error('Club events POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
