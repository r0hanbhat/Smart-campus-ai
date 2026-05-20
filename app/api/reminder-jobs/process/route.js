import { NextResponse } from 'next/server';
import { sendReminderEmail } from '@/lib/server/reminder-mailer';
import { createSupabaseServiceRoleClient } from '@/lib/server/supabase';

function isAuthorized(request) {
    const secret = process.env.CRON_SECRET || process.env.REMINDER_JOB_SECRET;
    if (!secret) {
        throw new Error('Missing CRON_SECRET or REMINDER_JOB_SECRET in environment.');
    }
    const bearerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const headerToken = request.headers.get('x-reminder-job-secret');
    const queryToken = request.nextUrl.searchParams.get('secret');
    const providedSecret = bearerToken || headerToken || queryToken;
    return providedSecret === secret;
}

async function handleProcessRequest(request) {
    try {
        if (!isAuthorized(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const supabase = createSupabaseServiceRoleClient();
        const limitParam = request.nextUrl.searchParams.get('limit');
        const limit = Math.max(1, Math.min(100, Number.parseInt(limitParam ?? '25', 10) || 25));
        const { data: dueJobs, error: fetchError } = await supabase
            .from('reminder_jobs')
            .select('id, recipient_email, item_name, item_type, date, time, offset_hours, delivery_reason, attempts')
            .eq('status', 'pending')
            .lte('scheduled_for', new Date().toISOString())
            .order('scheduled_for', { ascending: true })
            .limit(limit);
        if (fetchError) {
            throw fetchError;
        }
        let processed = 0;
        let failed = 0;
        for (const job of (dueJobs ?? [])) {
            try {
                await sendReminderEmail({
                    to: job.recipient_email,
                    itemName: job.item_name,
                    itemType: job.item_type,
                    date: job.date,
                    time: job.time,
                    offsetHours: job.offset_hours,
                    deliveryReason: job.delivery_reason,
                });
                const { error: updateError } = await supabase
                    .from('reminder_jobs')
                    .update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    attempts: job.attempts + 1,
                    last_error: null,
                })
                    .eq('id', job.id);
                if (updateError) {
                    throw updateError;
                }
                processed += 1;
            }
            catch (error) {
                failed += 1;
                const message = error instanceof Error ? error.message : 'Unexpected reminder job failure';
                await supabase
                    .from('reminder_jobs')
                    .update({
                    status: 'failed',
                    attempts: job.attempts + 1,
                    last_error: message,
                })
                    .eq('id', job.id);
            }
        }
        return NextResponse.json({
            success: true,
            processed,
            failed,
            scanned: (dueJobs ?? []).length,
        });
    }
    catch (error) {
        console.error('Reminder Job Processor Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to process reminder jobs';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function GET(request) {
    return handleProcessRequest(request);
}

export async function POST(request) {
    return handleProcessRequest(request);
}
