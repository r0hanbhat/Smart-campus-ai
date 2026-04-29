import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

// GET /api/clubs/login — returns current club session info
export async function GET() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get('club_session')?.value;
    if (!raw) return NextResponse.json({ club: null }, { status: 401 });

    const session = JSON.parse(raw);
    if (!session?.club_id) return NextResponse.json({ club: null }, { status: 401 });

    return NextResponse.json({ club: session });
  } catch {
    return NextResponse.json({ club: null }, { status: 401 });
  }
}

// POST /api/clubs/login
export async function POST(request) {
  try {
    const { login_id, password } = await request.json();
    if (!login_id || !password) {
      return NextResponse.json({ error: 'login_id and password are required' }, { status: 400 });
    }

    const cookieStore = await cookies();
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

    const { password_hash: _omit, ...safeClub } = club;
    const response = NextResponse.json({ club: safeClub });

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

// DELETE /api/clubs/login — logout
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('club_session', '', { maxAge: 0, path: '/' });
  return response;
}
