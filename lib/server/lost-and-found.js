import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';
import { resolveAccountRole } from '@/lib/smart-campus/roles.js';
import {
    isMissingSchemaColumnError,
    isMissingSchemaTableError,
} from '@/lib/supabase/schema-compat.js';

const LOST_FOUND_TABLES = ['lost_found_items', 'lost_found_claims'];
const LOST_FOUND_FUNCTIONS = [
    'submit_lost_found_claim',
    'respond_to_lost_found_claim',
    'mark_lost_found_item_returned',
];

export async function requireLostAndFoundStudent(request) {
    const { user, supabase, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user?.id) {
        throw Object.assign(new Error('Sign in with a student account to use Lost & Found.'), { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
    if (profileError) {
        throw profileError;
    }
    if (resolveAccountRole(profile, user) !== 'student') {
        throw Object.assign(new Error('Lost & Found is available to student accounts.'), { status: 403 });
    }

    return { user, serviceClient: createSupabaseServiceRoleClient() };
}

export function lostAndFoundErrorResponse(error, label) {
    const missingFunction = error?.code === 'PGRST202'
        && LOST_FOUND_FUNCTIONS.some((functionName) => error?.message?.includes(functionName));
    if (isMissingSchemaColumnError(error, 'item_type')) {
        return NextResponse.json({
            error: 'Lost & Found schema needs updating. Re-run supabase/lost_and_found_schema.sql in Supabase.',
        }, { status: 503 });
    }
    if (missingFunction || LOST_FOUND_TABLES.some((tableName) => isMissingSchemaTableError(error, tableName))) {
        return NextResponse.json({
            error: 'Lost & Found is not installed. Apply supabase/lost_and_found_schema.sql in Supabase first.',
        }, { status: 503 });
    }

    const status = Number.isInteger(error?.status)
        ? error.status
        : error?.code === '42501'
            ? 403
            : error?.code === '22023'
                ? 400
            : error?.code === 'P0002'
                ? 404
                : ['P0001', '23505', '55000'].includes(error?.code)
                    ? 409
                    : 500;
    if (status >= 500) {
        console.error(`${label}:`, error);
    }
    return NextResponse.json({
        error: status < 500 && typeof error?.message === 'string'
            ? error.message
            : 'Lost & Found request failed.',
    }, { status });
}
