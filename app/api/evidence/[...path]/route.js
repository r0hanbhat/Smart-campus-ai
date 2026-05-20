import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';

const BUCKET = 'issue-evidence';

async function isAdmin(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to verify evidence access.');
  }

  return data?.role === 'admin';
}

export async function GET(_request, context) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { path } = await context.params;
    const storagePath = Array.isArray(path)
      ? path.map((segment) => decodeURIComponent(segment)).join('/')
      : '';

    if (!storagePath) {
      return NextResponse.json({ error: 'Evidence path is required.' }, { status: 400 });
    }

    const ownerId = storagePath.split('/')[0] || '';
    const canAccess = ownerId === user.id || await isAdmin(supabase, user.id);
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const serviceClient = createSupabaseServiceRoleClient();
    const { data, error } = await serviceClient.storage.from(BUCKET).download(storagePath);
    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Evidence file not found.' }, { status: 404 });
    }

    return new NextResponse(data, {
      headers: {
        'Content-Type': data.type || 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Evidence GET Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load evidence.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
