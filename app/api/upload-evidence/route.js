import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { getAuthenticatedUser } from '@/lib/server/supabase';

/**
 * POST /api/upload-evidence
 * Accepts: { files: [{ id, name, mimeType, dataUrl }] }
 * Returns: { uploaded: [{ id, name, mimeType, url }] }
 *
 * Uploads base64 evidence files to Supabase Storage (bucket: "issue-evidence")
 * and returns the public URLs. This avoids storing large base64 blobs in the DB.
 */
export async function POST(request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const files = Array.isArray(body?.files) ? body.files : [];

    if (files.length === 0) {
      return NextResponse.json({ uploaded: [] });
    }

    const serviceClient = createSupabaseServiceRoleClient();
    const BUCKET = 'issue-evidence';

    const uploaded = await Promise.all(
      files.map(async (file) => {
        const { id, name, mimeType, dataUrl } = file;

        if (!dataUrl || !dataUrl.startsWith('data:')) {
          // Already a URL or empty — return as-is
          return { id, name, mimeType, url: dataUrl || '' };
        }

        // Decode base64 → Buffer
        const base64 = dataUrl.split(',')[1];
        if (!base64) return { id, name, mimeType, url: '' };

        const buffer = Buffer.from(base64, 'base64');
        const ext = name.split('.').pop() || 'bin';
        const storagePath = `${user.id}/${id}.${ext}`;

        const { error: uploadError } = await serviceClient.storage
          .from(BUCKET)
          .upload(storagePath, buffer, {
            contentType: mimeType || 'application/octet-stream',
            upsert: true,
          });

        if (uploadError) {
          console.error('[Upload Evidence] Storage upload failed:', uploadError.message);
          return { id, name, mimeType, url: '' };
        }

        const { data: urlData } = serviceClient.storage
          .from(BUCKET)
          .getPublicUrl(storagePath);

        return { id, name, mimeType, url: urlData?.publicUrl || '' };
      })
    );

    return NextResponse.json({ uploaded });
  } catch (err) {
    console.error('[Upload Evidence] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
