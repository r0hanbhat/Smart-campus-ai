import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';

const BUCKET = 'issue-evidence';

async function ensureEvidenceBucket(serviceClient) {
  const { data: buckets, error: listError } = await serviceClient.storage.listBuckets();
  if (listError) {
    throw new Error(listError.message || 'Failed to inspect evidence storage.');
  }

  const bucketExists = (buckets || []).some((bucket) => bucket.name === BUCKET);
  if (bucketExists) {
    return;
  }

  const { error: createError } = await serviceClient.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/*', 'video/*'],
  });

  if (createError && !`${createError.message || ''}`.toLowerCase().includes('already exists')) {
    throw new Error(createError.message || 'Failed to create evidence bucket.');
  }
}

function buildEvidenceUrl(storagePath) {
  return `/api/evidence/${storagePath.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;
}

/**
 * POST /api/upload-evidence
 * Accepts: { files: [{ id, name, mimeType, dataUrl }] }
 * Returns: { uploaded: [{ id, name, mimeType, url }] }
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
    await ensureEvidenceBucket(serviceClient);

    const uploaded = await Promise.all(
      files.map(async (file) => {
        const { id, name, mimeType, dataUrl } = file || {};

        if (!dataUrl || !dataUrl.startsWith('data:')) {
          return { id, name, mimeType, url: dataUrl || '' };
        }

        const base64 = dataUrl.split(',')[1];
        if (!base64) {
          return { id, name, mimeType, url: '' };
        }

        const buffer = Buffer.from(base64, 'base64');
        const ext = `${name || ''}`.split('.').pop() || 'bin';
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

        return {
          id,
          name,
          mimeType,
          url: buildEvidenceUrl(storagePath),
        };
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
