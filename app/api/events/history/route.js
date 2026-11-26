import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';
import { eventCheckInErrorResponse } from '@/lib/server/event-checkin.js';

export async function GET(request) {
    try {
        const { user, error: authError } = await getAuthenticatedUser(request);
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
        }

        const serviceClient = createSupabaseServiceRoleClient();
        const { data: registrations, error: registrationsError } = await serviceClient
            .from('event_registrations')
            .select('id, event_id, registered_at')
            .eq('student_id', user.id)
            .order('registered_at', { ascending: false });
        if (registrationsError) {
            throw registrationsError;
        }
        if (!registrations?.length) {
            return NextResponse.json({ events: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
        }

        const registrationIds = registrations.map((registration) => registration.id);
        const eventIds = [...new Set(registrations.map((registration) => registration.event_id))];
        const [eventsResult, ticketsResult] = await Promise.all([
            serviceClient
                .from('events')
                .select('id, title, proposed_date, event_end_date, time_start, time_end, venue, is_published, club:clubs!events_club_id_fkey(club_name)')
                .in('id', eventIds),
            serviceClient
                .from('event_check_in_tickets')
                .select('registration_id, checked_in_at')
                .in('registration_id', registrationIds),
        ]);
        if (eventsResult.error) {
            throw eventsResult.error;
        }
        if (ticketsResult.error) {
            throw ticketsResult.error;
        }

        const eventsById = new Map((eventsResult.data || []).map((event) => [event.id, event]));
        const ticketsByRegistration = new Map((ticketsResult.data || []).map((ticket) => [ticket.registration_id, ticket]));
        return NextResponse.json({
            events: registrations.flatMap((registration) => {
                const event = eventsById.get(registration.event_id);
                if (!event) {
                    return [];
                }
                const ticket = ticketsByRegistration.get(registration.id);
                return [{
                    ...event,
                    registration_id: registration.id,
                    registered_at: registration.registered_at,
                    checked_in_at: ticket?.checked_in_at || null,
                }];
            }),
        }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
        return eventCheckInErrorResponse(error, 'Event activity history error');
    }
}
