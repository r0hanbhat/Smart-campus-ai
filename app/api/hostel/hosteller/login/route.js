import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { hostelErrorResponse } from '@/lib/server/hostel-auth';

export async function POST(request) {
    try {
        const body = await request.json();
        const rollNumber = typeof body?.rollNumber === 'string' ? body.rollNumber.trim() : '';
        const password = typeof body?.password === 'string' ? body.password : '';
        if (!rollNumber || !password) {
            return NextResponse.json({ error: 'Roll number and password are required.' }, { status: 400 });
        }

        const serviceSupabase = createSupabaseServiceRoleClient();
        const { data: profile, error: profileError } = await serviceSupabase
            .from('profiles')
            .select('user_id, email, role, roll_number')
            .eq('roll_number', rollNumber)
            .eq('role', 'student')
            .maybeSingle();

        if (profileError) {
            throw profileError;
        }
        if (!profile) {
            return NextResponse.json({ error: 'Invalid roll number or password.' }, { status: 401 });
        }
        let email = profile.email;
        const { data: authUserData, error: authUserError } = await serviceSupabase.auth.admin.getUserById(profile.user_id);
        if (authUserError) {
            throw authUserError;
        }
        if (!authUserData.user?.email_confirmed_at) {
            return NextResponse.json({ error: 'Verify your campus email before signing in.' }, { status: 403 });
        }
        email = email || authUserData.user?.email;
        if (!email) {
            return NextResponse.json({ error: 'This student account does not have a login email. Contact the administrator.' }, { status: 409 });
        }

        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                        });
                    },
                },
            }
        );

        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError || data.user?.id !== profile.user_id) {
            return NextResponse.json({ error: 'Invalid roll number or password.' }, { status: 401 });
        }

        return NextResponse.json({
            success: true,
            rollNumber: profile.roll_number,
        });
    } catch (error) {
        return hostelErrorResponse(error, 'Hosteller login error');
    }
}
