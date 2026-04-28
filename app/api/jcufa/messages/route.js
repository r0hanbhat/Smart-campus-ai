import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';

const POSITION_HOLDERS = ['President', 'Vice President', 'Secretary', 'Treasurer'];

// GET /api/jcufa/messages?group_id=xxx&limit=50&offset=0
export async function GET(request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!groupId) return NextResponse.json({ error: 'group_id is required' }, { status: 400 });

    const { data: messages, error } = await supabase
      .from('jcufa_messages')
      .select(`
        *,
        sender:profiles!jcufa_messages_sender_id_fkey(user_id, full_name, display_name, jcufa_position),
        ack_count:jcufa_acknowledgments(count)
      `)
      .eq('group_id', groupId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const messageIds = (messages || []).map(m => m.id);
    let userAcks = new Set();
    if (messageIds.length > 0) {
      const { data: acks } = await supabase
        .from('jcufa_acknowledgments')
        .select('message_id')
        .eq('user_id', user.id)
        .in('message_id', messageIds);
      userAcks = new Set((acks || []).map(a => a.message_id));
    }

    const enriched = (messages || []).map(m => ({
      ...m,
      ack_count: m.ack_count?.[0]?.count ?? 0,
      user_acknowledged: userAcks.has(m.id),
    }));

    return NextResponse.json({ messages: enriched });
  } catch (err) {
    console.error('JCUFA messages GET error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}

// POST /api/jcufa/messages
export async function POST(request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { group_id, content } = body;

    if (!group_id || !content?.trim()) {
      return NextResponse.json({ error: 'group_id and content are required' }, { status: 400 });
    }

    const { data: group } = await supabase
      .from('jcufa_chat_groups')
      .select('type')
      .eq('id', group_id)
      .maybeSingle();

    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    if (group.type === 'announcement') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('jcufa_position')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile || !POSITION_HOLDERS.includes(profile.jcufa_position)) {
        return NextResponse.json({ error: 'Only JCUFA position holders can post in the Announcements group.' }, { status: 403 });
      }
    }

    const { data: message, error } = await supabase
      .from('jcufa_messages')
      .insert({ group_id, sender_id: user.id, content: content.trim() })
      .select(`*, sender:profiles!jcufa_messages_sender_id_fkey(user_id, full_name, display_name, jcufa_position)`)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: { ...message, ack_count: 0, user_acknowledged: false } }, { status: 201 });
  } catch (err) {
    console.error('JCUFA messages POST error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
