import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { createSystemMessage } from '@/app/components/campus-chat/shared.js';

export async function POST(request) {
  try {
    const { memberId, conversationId, promotedBy } = await request.json();
    if (!memberId || !conversationId || !promotedBy) {
      return NextResponse.json({ ok: false, message: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createSupabaseServiceRoleClient();
    const joinedAt = new Date().toISOString();

    // Insert/upsert real membership
    const { data, error } = await supabase.from('conversation_members').upsert({
      conversation_id: conversationId,
      user_id: memberId,
      is_creator: false,
      member_status: 'active',
      joined_at: joinedAt,
    }, { onConflict: 'conversation_id,user_id', ignoreDuplicates: false });

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }

    // Create a notification for the added user
    try {
      await supabase.from('notifications').insert({
        user_id: memberId,
        type: 'group_invite',
        title: 'Added to a group chat',
        body: `You were added to a group.`,
        payload: { conversation_id: conversationId, added_by: promotedBy },
      });
    }
    catch (nErr) {
      // non-fatal
      console.error('Failed to create notification for promote:', nErr?.message || nErr);
    }

    // Post a system message to the conversation announcing the join
    try {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: promotedBy,
        content: createSystemMessage('User joined the group.', ''),
        is_system: true,
      });
    }
    catch (mErr) {
      console.error('Failed to post system message for promote:', mErr?.message || mErr);
    }

    return NextResponse.json({ ok: true, data });
  }
  catch (err) {
    return NextResponse.json({ ok: false, message: String(err?.message || err) }, { status: 500 });
  }
}
