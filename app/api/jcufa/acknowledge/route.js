import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';

// POST /api/jcufa/acknowledge
export async function POST(request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message_id } = await request.json();
    if (!message_id) return NextResponse.json({ error: 'message_id is required' }, { status: 400 });

    // Verify message belongs to an announcement group
    const { data: message } = await supabase
      .from('jcufa_messages')
      .select('id, group_id, jcufa_chat_groups!inner(type)')
      .eq('id', message_id)
      .maybeSingle();

    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    if (message.jcufa_chat_groups?.type !== 'announcement') {
      return NextResponse.json({ error: 'Acknowledgments are only for announcement messages' }, { status: 400 });
    }

    const { error } = await supabase
      .from('jcufa_acknowledgments')
      .upsert({ message_id, user_id: user.id }, { onConflict: 'message_id,user_id' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ acknowledged: true });
  } catch (err) {
    console.error('JCUFA acknowledge error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
