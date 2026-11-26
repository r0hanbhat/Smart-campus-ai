import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';
import { hostelErrorResponse, readWardenSession } from '@/lib/server/hostel-auth';
import {
    isValidMessDate,
    summarizeMessRatings,
} from '@/lib/smart-campus/mess.js';

function getDateOffset(value, days) {
    const date = new Date(`${value}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

async function getHosteller(supabase, request) {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user?.id) {
        return { response: NextResponse.json({ error: 'Hosteller login required.' }, { status: 401 }) };
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
    if (profileError) {
        throw profileError;
    }
    if (profile?.role !== 'student') {
        return { response: NextResponse.json({ error: 'Hosteller portal access required.' }, { status: 403 }) };
    }

    const { data: resident, error: residentError } = await supabase
        .from('hostel_residents')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
    if (residentError) {
        throw residentError;
    }
    if (!resident) {
        return { response: NextResponse.json({ error: 'A hostel room assignment is required.' }, { status: 403 }) };
    }
    return { user };
}

export async function GET(request) {
    try {
        const supabase = createSupabaseServiceRoleClient();
        const warden = await readWardenSession(supabase);
        const hosteller = warden ? null : await getHosteller(supabase, request);
        if (hosteller?.response) {
            return hosteller.response;
        }

        const dateParam = new URL(request.url).searchParams.get('date');
        const mealDate = dateParam || new Date().toISOString().slice(0, 10);
        if (!isValidMessDate(mealDate)) {
            return NextResponse.json({ error: 'A valid meal date is required.' }, { status: 400 });
        }

        const [menuResult, announcementsResult, ratingsResult] = await Promise.all([
            supabase
                .from('hostel_mess_menu')
                .select('day_of_week, meal_type, menu_text')
                .order('day_of_week', { ascending: true }),
            supabase
                .from('hostel_mess_announcements')
                .select('id, title, message, created_at')
                .order('created_at', { ascending: false })
                .limit(10),
            supabase
                .from('hostel_meal_ratings')
                .select('hosteller_user_id, meal_type, rating')
                .eq('meal_date', mealDate),
        ]);
        if (menuResult.error) {
            throw menuResult.error;
        }
        if (announcementsResult.error) {
            throw announcementsResult.error;
        }
        if (ratingsResult.error) {
            throw ratingsResult.error;
        }

        const ratings = ratingsResult.data || [];
        const myRatings = {};
        if (hosteller?.user?.id) {
            for (const rating of ratings) {
                if (rating.hosteller_user_id === hosteller.user.id) {
                    myRatings[rating.meal_type] = rating.rating;
                }
            }
        }

        return NextResponse.json({
            role: warden ? 'warden' : 'hosteller',
            mealDate,
            menu: (menuResult.data || []).map((item) => ({
                dayOfWeek: item.day_of_week,
                mealType: item.meal_type,
                menuText: item.menu_text,
            })),
            announcements: announcementsResult.data || [],
            ratings: summarizeMessRatings(ratings),
            myRatings,
        });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel mess data error');
    }
}

export async function POST(request) {
    try {
        const supabase = createSupabaseServiceRoleClient();
        const { user, response } = await getHosteller(supabase, request);
        if (response) {
            return response;
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
        }
        const mealDate = body?.mealDate;
        const mealType = body?.mealType;
        const rating = Number(body?.rating);
        const validMealTypes = new Set(['breakfast', 'lunch', 'snacks', 'dinner']);
        const today = new Date().toISOString().slice(0, 10);
        const earliestAllowedDate = getDateOffset(today, -7);
        const latestAllowedDate = getDateOffset(today, 1);
        if (
            !isValidMessDate(mealDate)
            || mealDate < earliestAllowedDate
            || mealDate > latestAllowedDate
            || !validMealTypes.has(mealType)
            || !Number.isInteger(rating)
            || rating < 1
            || rating > 5
        ) {
            return NextResponse.json({ error: 'Choose a meal from the last seven days and a rating from 1 to 5.' }, { status: 400 });
        }

        const { data: ratingId, error } = await supabase.rpc('submit_hostel_meal_rating', {
            target_hosteller_user_id: user.id,
            target_meal_date: mealDate,
            target_meal_type: mealType,
            target_rating: rating,
        });
        if (error) {
            if (error.code === '42501') {
                return NextResponse.json({ error: 'A hostel room assignment is required to rate meals.' }, { status: 403 });
            }
            throw error;
        }
        return NextResponse.json({ success: true, ratingId });
    } catch (error) {
        return hostelErrorResponse(error, 'Hostel meal rating error');
    }
}
