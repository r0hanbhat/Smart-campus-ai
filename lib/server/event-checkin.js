import { NextResponse } from 'next/server';
import { isMissingSchemaTableError } from '@/lib/supabase/schema-compat.js';
import { getCampusDate, isValidEventCheckInId } from '@/lib/smart-campus/event-checkin.js';

export { getCampusDate, isValidEventCheckInId };

export function eventCheckInErrorResponse(error, label) {
    if (isMissingSchemaTableError(error, 'event_check_in_tickets')) {
        return NextResponse.json({
            error: 'Event check-in is not installed. Apply supabase/event_checkin_schema.sql in Supabase first.',
        }, { status: 503 });
    }

    console.error(`${label}:`, error);
    return NextResponse.json({ error: 'Event check-in request failed.' }, { status: 500 });
}
