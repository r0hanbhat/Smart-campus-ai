import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';

export async function POST(request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user?.id) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { memberId, conversationId, memberStatus = 'active', isCreator } = await request.json();
    if (!memberId || !conversationId) {
      return NextResponse.json({ ok: false, message: 'Missing memberId or conversationId' }, { status: 400 });
    }

    const supabase = createSupabaseServiceRoleClient();

    const joinedAt = new Date().toISOString();

    // Build payload using optional values from the request.
    const payload = {
      conversation_id: conversationId,
      user_id: memberId,
      joined_at: joinedAt,
      left_at: null,
    };
    if (typeof isCreator !== 'undefined') {
      payload.is_creator = Boolean(isCreator);
    }
    payload.member_status = memberStatus;

    // Try upsert; fall back to simpler shape handled above if DB lacks columns.
    let result = await supabase.from('conversation_members').upsert(payload, {
      onConflict: 'conversation_id,user_id',
      ignoreDuplicates: false,
    });

    const isMissingSchemaColumnError = (error, columnName) => Boolean(error?.message?.includes(`Could not find the '${columnName}' column`));

    if (result.error && (isMissingSchemaColumnError(result.error, 'is_creator') || isMissingSchemaColumnError(result.error, 'member_status'))) {
      // Try again with only the guaranteed fields
      result = await supabase.from('conversation_members').upsert({
        conversation_id: conversationId,
        user_id: memberId,
        joined_at: joinedAt,
        left_at: null,
      }, {
        onConflict: 'conversation_id,user_id',
        ignoreDuplicates: false,
      });
    }

    if (result.error) {
      return NextResponse.json({ ok: false, message: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: result.data });
  }
  catch (err) {
    return NextResponse.json({ ok: false, message: String(err?.message || err) }, { status: 500 });
  }
}
