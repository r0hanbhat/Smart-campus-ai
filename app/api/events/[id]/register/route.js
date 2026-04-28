import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';

// POST /api/events/[id]/register
export async function POST(request, { params }) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;

    const { data: event } = await supabase
      .from('events')
      .select('id, is_published, proposed_date')
      .eq('id', id)
      .maybeSingle();

    if (!event || !event.is_published) {
      return NextResponse.json({ error: 'Event not found or not available for registration' }, { status: 404 });
    }
    if (new Date(event.proposed_date) < new Date(new Date().toDateString())) {
      return NextResponse.json({ error: 'Registration closed — event has already passed' }, { status: 410 });
    }

    const { error } = await supabase
      .from('event_registrations')
      .insert({ event_id: id, student_id: user.id });

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Already registered' }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ registered: true }, { status: 201 });
  } catch (err) {
    console.error('Event registration error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
