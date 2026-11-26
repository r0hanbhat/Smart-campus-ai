import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';
import { readClubSession } from '@/lib/server/club-auth.js';
import { eventCheckInErrorResponse, getCampusDate, isValidEventCheckInId } from '@/lib/server/event-checkin.js';

export async function POST(request) {
    try {
        if (request.headers.get('origin') !== new URL(request.url).origin) {
            return NextResponse.json({ error: 'Check-in requests must come from this app.' }, { status: 403 });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
        }

        const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
        const ticketToken = typeof body?.ticketToken === 'string' ? body.ticketToken.trim() : '';
        if (!isValidEventCheckInId(eventId) || !isValidEventCheckInId(ticketToken)) {
            return NextResponse.json({ error: 'Choose a valid event ticket.' }, { status: 400 });
        }

        const { user, supabase } = await getAuthenticatedUser(request);
        let actor = null;
        if (user?.id) {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('user_id', user.id)
                .maybeSingle();
            if (profileError) {
                throw profileError;
            }
            if (profile?.role === 'admin') {
                actor = { role: 'admin', id: user.id };
            }
        }

        if (!actor) {
            const clubSession = await readClubSession(await cookies());
            if (clubSession) {
                actor = { role: 'club', id: clubSession.club_id };
            }
        }
        if (!actor) {
            return NextResponse.json({ error: 'Admin or event club access is required.' }, { status: 403 });
        }

        const serviceClient = createSupabaseServiceRoleClient();
        const { data: event, error: eventError } = await serviceClient
            .from('events')
            .select('id, club_id, proposed_date, event_end_date, is_published')
            .eq('id', eventId)
            .maybeSingle();
        if (eventError) {
            throw eventError;
        }
        if (!event || !event.is_published) {
            return NextResponse.json({ error: 'This event is not available for check-in.' }, { status: 404 });
        }
        if (actor.role === 'club' && event.club_id !== actor.id) {
            return NextResponse.json({ error: 'You can only check in attendees for your own club events.' }, { status: 403 });
        }
        const lastEventDate = event.event_end_date || event.proposed_date;
        const campusDate = getCampusDate();
        if (campusDate < event.proposed_date || campusDate > lastEventDate) {
            return NextResponse.json({ error: 'Check-in is available only on the event date.' }, { status: 409 });
        }

        const { data: ticket, error: ticketError } = await serviceClient
            .from('event_check_in_tickets')
            .select('registration_id, checked_in_at')
            .eq('ticket_token', ticketToken)
            .maybeSingle();
        if (ticketError) {
            throw ticketError;
        }
        if (!ticket) {
            return NextResponse.json({ error: 'This event ticket is invalid.' }, { status: 404 });
        }

        const { data: registration, error: registrationError } = await serviceClient
            .from('event_registrations')
            .select('id, event_id, student_id')
            .eq('id', ticket.registration_id)
            .eq('event_id', eventId)
            .maybeSingle();
        if (registrationError) {
            throw registrationError;
        }
        if (!registration) {
            return NextResponse.json({ error: 'This ticket is not registered for the selected event.' }, { status: 404 });
        }

        const { data: profile, error: profileError } = await serviceClient
            .from('profiles')
            .select('full_name, display_name, roll_number')
            .eq('user_id', registration.student_id)
            .maybeSingle();
        if (profileError) {
            throw profileError;
        }
        const attendee = {
            name: profile?.display_name || profile?.full_name || 'Student',
            rollNumber: profile?.roll_number || null,
        };
        if (ticket.checked_in_at) {
            return NextResponse.json({
                alreadyCheckedIn: true,
                checkedInAt: ticket.checked_in_at,
                attendee,
            }, { status: 409 });
        }

        const checkedInAt = new Date().toISOString();
        const { data: updatedTicket, error: updateError } = await serviceClient
            .from('event_check_in_tickets')
            .update({
                checked_in_at: checkedInAt,
                checked_in_by_role: actor.role,
                checked_in_by_id: actor.id,
            })
            .eq('ticket_token', ticketToken)
            .is('checked_in_at', null)
            .select('checked_in_at')
            .maybeSingle();
        if (updateError) {
            throw updateError;
        }
        if (!updatedTicket) {
            const { data: currentTicket, error: currentTicketError } = await serviceClient
                .from('event_check_in_tickets')
                .select('checked_in_at')
                .eq('ticket_token', ticketToken)
                .maybeSingle();
            if (currentTicketError) {
                throw currentTicketError;
            }
            return NextResponse.json({
                alreadyCheckedIn: true,
                checkedInAt: currentTicket?.checked_in_at || null,
                attendee,
            }, { status: 409 });
        }

        return NextResponse.json({
            checkedIn: true,
            checkedInAt: updatedTicket.checked_in_at,
            attendee,
        });
    } catch (error) {
        return eventCheckInErrorResponse(error, 'Event check-in error');
    }
}
