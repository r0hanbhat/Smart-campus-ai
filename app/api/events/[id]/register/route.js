import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { sendReminderEmail } from '@/lib/server/reminder-mailer';

// POST /api/events/[id]/register
export async function POST(request, { params }) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const { data: event } = await supabase
      .from('events')
      .select(`
        id, title, proposed_date, event_end_date, time_start, time_end, venue, is_published,
        club:clubs!events_club_id_fkey(club_name)
      `)
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

    // Send confirmation email (best-effort, non-blocking)
    if (user.email) {
      sendReminderEmail({
        to: user.email,
        itemName: event.title,
        itemType: 'event_registration',
        date: event.proposed_date,
        time: event.time_start,
        offsetHours: null,
        deliveryReason: 'registered',
        extra: {
          venue: event.venue,
          timeEnd: event.time_end,
          endDate: event.event_end_date,
          clubName: event.club?.club_name,
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      registered: true,
      event: {
        id: event.id,
        title: event.title,
        proposed_date: event.proposed_date,
        event_end_date: event.event_end_date,
        time_start: event.time_start,
        time_end: event.time_end,
        venue: event.venue,
        club_name: event.club?.club_name,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('Event registration error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
