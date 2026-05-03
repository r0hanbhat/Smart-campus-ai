import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';

// GET /api/events/published
export async function GET() {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: events, error } = await supabase
      .from('events')
      .select(`
        id, title, description, proposed_date, time_start, time_end, venue, expected_participants, created_at,
        club:clubs!events_club_id_fkey(club_name),
        registrations:event_registrations(count)
      `)
      .eq('is_published', true)
      .order('proposed_date', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Check current user's registrations
    const eventIds = (events || []).map(e => e.id);
    let userRegistrations = new Set();
    if (eventIds.length > 0) {
      const { data: regs } = await supabase
        .from('event_registrations')
        .select('event_id')
        .eq('student_id', user.id)
        .in('event_id', eventIds);
      userRegistrations = new Set((regs || []).map(r => r.event_id));
    }

    const todayMs = new Date(new Date().toDateString()).getTime();
    const threeDaysOutMs = todayMs + 3 * 24 * 60 * 60 * 1000;

    const enriched = (events || []).map(e => {
      const eventMs = new Date(e.proposed_date + 'T00:00:00').getTime();
      const isToday = eventMs === todayMs;
      const isPast = eventMs < todayMs;
      const isWithin3Days = eventMs <= threeDaysOutMs && !isPast && !isToday;
      return {
        ...e,
        registration_count: e.registrations?.[0]?.count ?? 0,
        user_registered: userRegistrations.has(e.id),
        is_today: isToday,
        is_past: isPast,
        is_upcoming_live: isToday || isWithin3Days,
        is_open_registration: !isPast,
      };
    });

    return NextResponse.json({
      events: enriched,
      open_registration: enriched.filter(e => e.is_open_registration),
      upcoming_live: enriched.filter(e => e.is_upcoming_live),
    });
  } catch (err) {
    console.error('Published events error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
