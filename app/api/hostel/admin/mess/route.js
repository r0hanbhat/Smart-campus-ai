import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { hostelErrorResponse, requireHostelAdmin } from '@/lib/server/hostel-auth';
import { normalizeMessMenuItems, summarizeMessRatings } from '@/lib/smart-campus/mess.js';

function getThirtyDaysAgo() {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 30);
    return date.toISOString().slice(0, 10);
}

export async function GET(request) {
    try {
        const supabase = await requireHostelAdmin(request);
        const { data: menu, error: menuError } = await supabase
            .from('hostel_mess_menu')
            .select('day_of_week, meal_type, menu_text, updated_at')
            .order('day_of_week', { ascending: true });
        if (menuError) {
            throw menuError;
        }

        const [announcementsResult, ratingsResult] = await Promise.all([
            supabase
                .from('hostel_mess_announcements')
                .select('id, title, message, created_at')
                .order('created_at', { ascending: false })
                .limit(20),
            supabase
                .from('hostel_meal_ratings')
                .select('meal_date, meal_type, rating')
                .gte('meal_date', getThirtyDaysAgo()),
        ]);
        if (announcementsResult.error) {
            throw announcementsResult.error;
        }
        if (ratingsResult.error) {
            throw ratingsResult.error;
        }

        return NextResponse.json({
            menu: (menu || []).map((item) => ({
                dayOfWeek: item.day_of_week,
                mealType: item.meal_type,
                menuText: item.menu_text,
                updatedAt: item.updated_at,
            })),
            announcements: announcementsResult.data || [],
            ratings: summarizeMessRatings(ratingsResult.data, true),
        });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel mess administration error');
    }
}

export async function PUT(request) {
    try {
        const supabase = await requireHostelAdmin(request);
        const { user, error: authError } = await getAuthenticatedUser(request);
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
        }
        const items = normalizeMessMenuItems(body?.items);
        if (!items) {
            return NextResponse.json({ error: 'Menu must contain valid weekday, meal, and menu text entries.' }, { status: 400 });
        }

        const { data: savedCount, error } = await supabase.rpc('replace_hostel_mess_menu', {
            target_admin_user_id: user.id,
            menu_items: items.map((item) => ({
                day_of_week: item.dayOfWeek,
                meal_type: item.mealType,
                menu_text: item.menuText,
            })),
        });
        if (error) {
            throw error;
        }
        return NextResponse.json({ success: true, savedCount });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel mess menu save error');
    }
}

export async function POST(request) {
    try {
        const supabase = await requireHostelAdmin(request);
        const { user, error: authError } = await getAuthenticatedUser(request);
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
        }
        const title = typeof body?.title === 'string' ? body.title.trim() : '';
        const message = typeof body?.message === 'string' ? body.message.trim() : '';
        if (!title || !message || title.length > 120 || message.length > 2000) {
            return NextResponse.json({ error: 'Enter a title up to 120 characters and a message up to 2,000 characters.' }, { status: 400 });
        }

        const { data: announcement, error } = await supabase
            .from('hostel_mess_announcements')
            .insert({ title, message, created_by: user.id })
            .select('id, title, message, created_at')
            .single();
        if (error) {
            throw error;
        }
        return NextResponse.json({ success: true, announcement }, { status: 201 });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel mess announcement error');
    }
}
