import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';

// GET /api/events/published
export async function GET(request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: events, error } = await supabase
      .from('events')
      .select(`
        id, title, description, proposed_date, event_end_date, time_start, time_end, venue,
        expected_participants, created_at, registration_starts,
        club:clubs!events_club_id_fkey(club_name),
        registrations:event_registrations(count)
      `)
      .eq('is_published', true)
      .order('proposed_date', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Check current user's registrations across ALL published events
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

    const nowMs = Date.now();
    const todayMs = new Date(new Date().toDateString()).getTime();

    const enriched = (events || []).map(e => {
      const startMs = new Date(e.proposed_date + 'T00:00:00').getTime();
      const endDate = e.event_end_date || e.proposed_date;
      const endMs = new Date(endDate + 'T23:59:59').getTime();
      const isPast = nowMs > endMs;
      const isToday = startMs === todayMs;
      // Event has already started (at or past start date)
      const hasStarted = todayMs >= startMs;
      const regStartsMs = e.registration_starts ? new Date(e.registration_starts).getTime() : null;
      // Registration is open if: event hasn't started AND not past AND (no reg_starts set OR now >= reg_starts)
      const registrationOpen = !hasStarted && !isPast && (regStartsMs === null || nowMs >= regStartsMs);
      // Upcoming = approved but registration hasn't opened yet (and event hasn't started)
      const isUpcoming = !hasStarted && !isPast && regStartsMs !== null && nowMs < regStartsMs;
      const userRegistered = userRegistrations.has(e.id);

      return {
        ...e,
        registration_count: e.registrations?.[0]?.count ?? 0,
        user_registered: userRegistered,
        is_today: isToday,
        is_past: isPast,
        has_started: hasStarted,
        registration_open: registrationOpen,
        is_upcoming: isUpcoming,
        registration_starts_formatted: e.registration_starts
          ? new Date(e.registration_starts).toLocaleString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })
          : null,
      };
    });

    return NextResponse.json({
      events: enriched,
      // Open Registration: ALL events with open reg window — UI shows "Registered" badge for already-enrolled ones
      open_registration: enriched.filter(e => e.registration_open),
      // Upcoming: approved, but reg window not yet open (future reg_starts)
      upcoming: enriched.filter(e => e.is_upcoming),
      // My Enrollments: ALL events the student has registered for (past, present, future)
      enrolled: enriched.filter(e => e.user_registered),
    });
  } catch (err) {
    console.error('Published events error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
