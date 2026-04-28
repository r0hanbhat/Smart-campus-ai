import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';

const VALID_POSITIONS = ['President', 'Vice President', 'Secretary', 'Treasurer', 'Member', 'Other'];

// POST /api/admin/jcufa-position
export async function POST(request) {
  try {
    // 1. Verify the caller is an admin (using user's own auth session)
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    // 2. Parse body
    const body = await request.json();
    const { userId, position } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const newPosition = position === 'REMOVE' ? null : position;
    if (newPosition && !VALID_POSITIONS.includes(newPosition)) {
      return NextResponse.json({ error: 'Invalid position value' }, { status: 400 });
    }

    // 3. Use service role to bypass RLS for updating another user's profile
    const serviceClient = createSupabaseServiceRoleClient();
    const { error: updateError } = await serviceClient
      .from('profiles')
      .update({ jcufa_position: newPosition })
      .eq('user_id', userId)
      .eq('role', 'teacher');

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ updated: true, position: newPosition });
  } catch (err) {
    console.error('JCUFA position error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
