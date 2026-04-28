import { NextResponse } from 'next/server';
import { buildInsights, buildInsightsPayload, } from '@/lib/server/dashboard-insights';
import { createSupabaseServerClient } from '@/lib/server/supabase';
async function getUserState() {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        return { user: null, state: null };
    }
    const { data, error } = await supabase
        .from('user_state')
        .select('events, clubs, reminders, deadlines')
        .eq('user_id', user.id)
        .maybeSingle();
    if (error) {
        throw error;
    }
    return {
        user,
        state: (data ?? null),
    };
}
export async function GET() {
    try {
        const { state } = await getUserState();
        const insights = buildInsights(buildInsightsPayload(null, state));
        return NextResponse.json({ insights });
    }
    catch (error) {
        console.error('Dashboard Insights GET Error:', error);
        return NextResponse.json({ error: 'Failed to load dashboard insights', insights: [] }, { status: 500 });
    }
}
export async function POST(req) {
    try {
        const body = (await req.json());
        const { state } = await getUserState();
        const insights = buildInsights(buildInsightsPayload(body, state));
        return NextResponse.json({ insights });
    }
    catch (error) {
        console.error('Dashboard Insights POST Error:', error);
        return NextResponse.json({ error: 'Failed to build dashboard insights', insights: [] }, { status: 500 });
    }
}
