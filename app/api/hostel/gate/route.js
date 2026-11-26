import { currentGuard } from '@/lib/server/hostel-guard';
import { getHosteller, readWardenSession } from '@/lib/server/hostel-auth';
import { createSupabaseServiceRoleClient } from '@/lib/server/supabase';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error, status) => Response.json({ error }, { status });

function databaseError(error) {
    if (error.code === 'P0001') return fail(error.message, 409);
    console.error('Hostel gate database error', error.code);
    return fail('Gate service unavailable. Check that hostel_gate_passes.sql has been applied.', 503);
}

export async function GET(request) {
    const db = createSupabaseServiceRoleClient();
    const warden = await readWardenSession(db);
    let outstanding = false;
    let history = [];
    if (!warden) {
        const { user, response } = await getHosteller(db, request);
        if (response) return response;
        const { data, error } = await db.from('hostel_daily_passes').select('exited_at,entered_at')
            .eq('resident_id', user.id).maybeSingle();
        if (error) return databaseError(error);
        const scans = await db.from('hostel_daily_scan_history').select('pass_day,exited_at,entered_at')
            .eq('resident_id', user.id).order('pass_day', { ascending: false }).limit(100);
        if (scans.error) return fail('Daily scan records unavailable. Check hostel_guard_schema.sql.', 503);
        history = scans.data;
        outstanding = Boolean(data?.exited_at && !data.entered_at);
    }
    const { data, error } = await db.from('hostel_gate_settings').select('daily_enabled').eq('singleton', true).single();
    return error ? databaseError(error) : Response.json({ enabled: data.daily_enabled, outstanding, history });
}

export async function POST(request) {
    const body = await request.json().catch(() => null);
    if (!body) return fail('Invalid request.', 400);
    const db = createSupabaseServiceRoleClient();
    if (body.action === 'issue') {
        const { user, response } = await getHosteller(db, request);
        if (response) return response;
        if (body.leaveId != null && !uuid.test(body.leaveId)) return fail('Invalid leave request.', 400);
        const { data, error } = await db.rpc('issue_hostel_gate_pass', { resident: user.id, leave_id: body.leaveId ?? null });
        return error ? databaseError(error) : Response.json({ token: data });
    }
    if (body.action === 'toggle' && typeof body.enabled === 'boolean') {
        if (!await readWardenSession(db)) return fail('Warden login required.', 403);
        const { error } = await db.from('hostel_gate_settings').update({ daily_enabled: body.enabled }).eq('singleton', true).select('singleton').single();
        return error ? databaseError(error) : Response.json({ enabled: body.enabled });
    }
    if (body.action === 'scan' && uuid.test(body.token) && ['entry','exit'].includes(body.direction)) {
        if (!await currentGuard(db)) return fail('Guard login required.', 403);
        const { data, error } = await db.rpc('scan_hostel_gate_pass', { pass_token: body.token, direction: body.direction });
        return error ? databaseError(error) : Response.json({ checkedInAt: data });
    }
    return fail('Invalid gate action or QR code.', 400);
}
