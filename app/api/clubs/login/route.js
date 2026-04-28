import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

// POST /api/clubs/login
export async function POST(request) {
  try {
    const { login_id, password } = await request.json();
    if (!login_id || !password) {
      return NextResponse.json({ error: 'login_id and password are required' }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
            } catch {}
          },
        },
      }
    );

    // Fetch club by login_id (using service role to bypass RLS)
    const { data: club, error } = await supabase
      .from('clubs')
      .select('id, club_name, login_id, password_hash, coordinator_id')
      .eq('login_id', login_id.trim())
      .single();

    if (error || !club) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, club.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Return club session data (stored in client localStorage/cookie by the portal)
    const { password_hash: _omit, ...safeClub } = club;
    const response = NextResponse.json({ club: safeClub });

    // Set a simple HTTP-only session cookie
    response.cookies.set('club_session', JSON.stringify({ club_id: club.id, club_name: club.club_name }), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
