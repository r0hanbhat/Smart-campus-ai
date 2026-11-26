import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { getPublishedEventState } from '@/lib/smart-campus/published-events.js';

// GET /api/events/published
export async function GET(request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: events, error } = await supabase
      .from('events')
      .select(`
        id, title, description, proposed_date, event_end_date, time_start, time_end, venue,
        expected_participants, created_at, updated_at, registration_starts,
        club:clubs!events_club_id_fkey(club_name),
        registrations:event_registrations(count)
      `)
      .eq('is_published', true)
      .order('proposed_date', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Check current user's registrations across ALL published events
    const eventIds = (events || []).map(e => e.id);
    const userRegistrations = new Map();
    if (eventIds.length > 0) {
      const { data: regs, error: registrationsError } = await supabase
        .from('event_registrations')
        .select('event_id, registered_at')
        .eq('student_id', user.id)
        .in('event_id', eventIds);
      if (registrationsError) {
        return NextResponse.json({ error: registrationsError.message }, { status: 500 });
      }
      for (const registration of regs || []) {
        userRegistrations.set(registration.event_id, registration.registered_at);
      }
    }

    const now = new Date();

    const enriched = (events || []).map(e => {
      const eventState = getPublishedEventState(e, now);
      const registeredAt = userRegistrations.get(e.id) || null;
      const userRegistered = Boolean(registeredAt);

      return {
        ...e,
        ...eventState,
        registration_count: e.registrations?.[0]?.count ?? 0,
        user_registered: userRegistered,
        registered_at: registeredAt,
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
