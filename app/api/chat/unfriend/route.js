import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';

export async function POST(request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user?.id) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { friendUserId } = await request.json();
    if (!friendUserId || typeof friendUserId !== 'string') {
      return NextResponse.json({ ok: false, message: 'Missing friendUserId' }, { status: 400 });
    }

    const supabase = createSupabaseServiceRoleClient();

    const friendshipDelete = await supabase
      .from('friendships')
      .delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_id.eq.${user.id})`);

    if (friendshipDelete.error) {
      return NextResponse.json({ ok: false, message: friendshipDelete.error.message }, { status: 400 });
    }

    const requestDelete = await supabase
      .from('friend_requests')
      .delete()
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendUserId}),and(sender_id.eq.${friendUserId},receiver_id.eq.${user.id})`);

    if (requestDelete.error) {
      return NextResponse.json({ ok: false, message: requestDelete.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: String(err?.message || err) },
      { status: 500 }
    );
  }
}
