import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { eventCheckInErrorResponse, isValidEventCheckInId } from '@/lib/server/event-checkin.js';

export async function GET(request, { params }) {
    try {
        const { user, error: authError } = await getAuthenticatedUser(request);
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
        }

        const { id: eventId } = await params;
        if (!isValidEventCheckInId(eventId)) {
            return NextResponse.json({ error: 'Choose a valid event.' }, { status: 400 });
        }

        const serviceClient = createSupabaseServiceRoleClient();
        const { data: registration, error: registrationError } = await serviceClient
            .from('event_registrations')
            .select('id')
            .eq('event_id', eventId)
            .eq('student_id', user.id)
            .maybeSingle();
        if (registrationError) {
            throw registrationError;
        }
        if (!registration) {
            return NextResponse.json({ error: 'You are not registered for this event.' }, { status: 404 });
        }

        const { data: existingTicket, error: ticketError } = await serviceClient
            .from('event_check_in_tickets')
            .select('ticket_token, checked_in_at')
            .eq('registration_id', registration.id)
            .maybeSingle();
        if (ticketError) {
            throw ticketError;
        }
        let ticket = existingTicket;
        if (!ticket) {
            const { data: createdTicket, error: createError } = await serviceClient
                .from('event_check_in_tickets')
                .insert({ registration_id: registration.id })
                .select('ticket_token, checked_in_at')
                .maybeSingle();
            if (createError && createError.code !== '23505') {
                throw createError;
            }
            ticket = createdTicket;
            if (!ticket) {
                const { data: concurrentTicket, error: reloadError } = await serviceClient
                    .from('event_check_in_tickets')
                    .select('ticket_token, checked_in_at')
                    .eq('registration_id', registration.id)
                    .maybeSingle();
                if (reloadError) {
                    throw reloadError;
                }
                ticket = concurrentTicket;
            }
        }
        if (!ticket) {
            return NextResponse.json({
                error: 'A ticket could not be created for this registration. Please refresh and try again.',
            }, { status: 503 });
        }

        return NextResponse.json({
            ticketToken: ticket.ticket_token,
            checkedInAt: ticket.checked_in_at,
        }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
        return eventCheckInErrorResponse(error, 'Event ticket retrieval error');
    }
}
