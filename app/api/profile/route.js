import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { isMissingSchemaTableError, withMissingColumnFallback, withMissingSelectColumnsFallback } from '@/lib/supabase/schema-compat.js';

function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalString(value) {
    const normalized = normalizeString(value);
    return normalized || null;
}

function normalizeAge(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const parsed = Number.parseInt(`${value}`, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeSemester(value) {
    const parsed = Number.parseInt(`${value}`, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function readProfileSnapshot(supabase, userId) {
    const profileColumns = [
        'user_id',
        'display_name',
        'full_name',
        'age',
        'email',
        'role',
        'roll_number',
        'course',
        'branch',
        'semester',
    ];
    return await withMissingSelectColumnsFallback((nextColumns) => supabase
        .from('profiles')
        .select(nextColumns.join(', '))
        .eq('user_id', userId)
        .maybeSingle(), profileColumns, ['age', 'role', 'roll_number', 'course', 'branch', 'semester']);
}

export async function PATCH(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const fullName = normalizeString(body?.fullName);
        const age = normalizeAge(body?.age);
        const rollNumber = normalizeOptionalString(body?.rollNumber);
        const course = normalizeOptionalString(body?.course);
        const branch = normalizeOptionalString(body?.branch);
        const semester = normalizeSemester(body?.semester);

        if (!fullName) {
            return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
        }

        const { data: currentProfile, error: profileLookupError } = await readProfileSnapshot(supabase, user.id);

        if (profileLookupError) {
            return NextResponse.json({ error: profileLookupError.message }, { status: 500 });
        }

        const role = currentProfile?.role || (typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : 'student');
        if (role === 'student' && (!rollNumber || !course || !branch || !semester)) {
            return NextResponse.json({ error: 'Roll number, course, branch, and semester are required for student profiles.' }, { status: 400 });
        }

        const displayName = fullName;
        const profileUpdate = {
            display_name: displayName,
            full_name: fullName,
            age,
            roll_number: rollNumber,
            course,
            branch,
            semester,
        };

        const { error: profileUpdateError } = await withMissingColumnFallback((nextProfileUpdate) => supabase
            .from('profiles')
            .update(nextProfileUpdate)
            .eq('user_id', user.id), profileUpdate, ['age', 'roll_number', 'course', 'branch', 'semester']);

        if (profileUpdateError) {
            return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
        }

        let warning = null;
        if (role === 'student') {
            const { error: studentUpsertError } = await supabase
                .from('students')
                .upsert({
                user_id: user.id,
                name: fullName,
                roll_number: rollNumber,
                course,
                branch,
                semester,
            }, { onConflict: 'user_id' });

            if (studentUpsertError) {
                if (isMissingSchemaTableError(studentUpsertError, 'students')) {
                    warning = 'Attendance schema is not installed yet, so the student directory was not synced.';
                }
                else {
                    return NextResponse.json({ error: studentUpsertError.message }, { status: 500 });
                }
            }
        }

        const { error: authUpdateError } = await supabase.auth.updateUser({
            data: {
                ...user.user_metadata,
                name: fullName,
                age,
                rollNumber,
                course,
                branch,
                semester,
            },
        });

        if (authUpdateError) {
            return NextResponse.json({ error: authUpdateError.message }, { status: 500 });
        }

        const { data: persistedProfile, error: persistedProfileError } = await readProfileSnapshot(supabase, user.id);
        if (persistedProfileError) {
            return NextResponse.json({ error: persistedProfileError.message }, { status: 500 });
        }

        const returnedProfile = persistedProfile && typeof persistedProfile === 'object'
            ? persistedProfile
            : {
                ...currentProfile,
                user_id: user.id,
                display_name: displayName,
                full_name: fullName,
                age,
                roll_number: rollNumber,
                course,
                branch,
                semester,
                role,
                email: user.email || null,
            };

        return NextResponse.json({
            success: true,
            profile: returnedProfile,
            warning,
        });
    }
    catch (error) {
        console.error('Profile Update API Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to update profile.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
