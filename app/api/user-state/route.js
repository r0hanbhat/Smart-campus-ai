import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { withMissingColumnFallback } from '@/lib/supabase/schema-compat.js';

export async function POST(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { data: existingState, error: existingStateError } = await supabase
            .from('user_state')
            .select('profile')
            .eq('user_id', user.id)
            .maybeSingle();

        if (existingStateError && existingStateError.code !== 'PGRST116') {
            return NextResponse.json({ error: existingStateError.message, hint: existingStateError.hint || null }, { status: 500 });
        }

        const existingProfile = existingState?.profile && typeof existingState.profile === 'object' ? existingState.profile : {};
        const savePayload = {
            user_id: user.id,
            events: Array.isArray(body?.events) ? body.events : [],
            clubs: Array.isArray(body?.clubs) ? body.clubs : [],
            reminders: Array.isArray(body?.reminders) ? body.reminders : [],
            deadlines: Array.isArray(body?.deadlines) ? body.deadlines : [],
            planner_entries: Array.isArray(body?.plannerEntries) ? body.plannerEntries : [],
            teacher_workspace: body?.teacherWorkspace && typeof body.teacherWorkspace === 'object' ? body.teacherWorkspace : null,
            profile: {
                ...(body?.profile && typeof body.profile === 'object' ? body.profile : {}),
                ...(existingProfile.issueCenter ? { issueCenter: existingProfile.issueCenter } : {}),
            },
            messages: Array.isArray(body?.messages) ? body.messages : [],
        };

        const { error } = await withMissingColumnFallback((nextPayload) => supabase
            .from('user_state')
            .upsert(nextPayload, { onConflict: 'user_id' }), savePayload, ['events', 'clubs', 'reminders', 'deadlines', 'planner_entries', 'teacher_workspace', 'profile', 'messages']);

        if (error) {
            return NextResponse.json({ error: error.message, hint: error.hint || null }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('User State API Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to save user state.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
