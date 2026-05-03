import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { isMissingSchemaTableError, withMissingColumnFallback } from '@/lib/supabase/schema-compat.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeInteger(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number.parseInt(`${value}`, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeOptionalString(body?.email) || user.email || null;
    const fallbackUsername = normalizeString(body?.fallbackUsername) || `${(user.email || 'student').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') || 'student'}-${user.id.slice(0, 4)}`;
    const displayName = normalizeString(body?.displayName) || normalizeString(body?.fullName) || user.email?.split('@')[0] || fallbackUsername;
    const role = normalizeString(body?.role) || (typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : 'student');
    let verificationStatus = normalizeString(body?.verificationStatus) || (typeof user.user_metadata?.verification_status === 'string' ? user.user_metadata.verification_status : 'approved');

    const { data: existingProfile } = await supabase.from('profiles').select('verification_status').eq('user_id', user.id).maybeSingle();
    if (existingProfile?.verification_status === 'approved') {
      verificationStatus = 'approved';
    }

    const profilePayload = {
      user_id: user.id,
      username: fallbackUsername,
      display_name: displayName,
      full_name: normalizeOptionalString(body?.fullName),
      age: normalizeInteger(body?.age),
      email,
      role,
      verification_status: verificationStatus,
      phone_number: normalizeOptionalString(body?.phoneNumber),
      phone_verified: Boolean(body?.phoneVerified),
      employee_id: normalizeOptionalString(body?.employeeId),
      roll_number: normalizeOptionalString(body?.rollNumber),
      course: normalizeOptionalString(body?.course),
      branch: normalizeOptionalString(body?.branch),
      semester: normalizeInteger(body?.semester),
      admin_id: normalizeOptionalString(body?.adminId),
      is_online: Boolean(body?.isOnline),
      last_seen: body?.lastSeen || new Date().toISOString(),
    };

    const { error: upsertError } = await withMissingColumnFallback(
      (nextPayload) => supabase.from('profiles').upsert(nextPayload, { onConflict: 'user_id' }),
      profilePayload,
      ['age', 'role', 'verification_status', 'phone_number', 'phone_verified', 'employee_id', 'roll_number', 'course', 'branch', 'semester', 'admin_id', 'is_online', 'last_seen']
    );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    if (
      role === 'student' &&
      profilePayload.roll_number &&
      profilePayload.course &&
      profilePayload.branch &&
      profilePayload.semester
    ) {
      const { error: studentUpsertError } = await supabase.from('students').upsert(
        {
          user_id: user.id,
          name: displayName,
          roll_number: profilePayload.roll_number,
          course: profilePayload.course,
          branch: profilePayload.branch,
          semester: profilePayload.semester,
        },
        { onConflict: 'user_id' }
      );

      if (studentUpsertError && !isMissingSchemaTableError(studentUpsertError, 'students')) {
        return NextResponse.json({ error: studentUpsertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, profile: profilePayload });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to provision profile.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
