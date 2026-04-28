import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { buildReminderEmailJobs } from '@/lib/server/reminder-jobs';
function isMissingReminderJobsTableError(error) {
    const message = error?.message?.toLowerCase() ?? '';
    return (error?.code === 'PGRST205' ||
        error?.code === '42P01' ||
        message.includes('reminder_jobs') ||
        message.includes('could not find the table'));
}
export async function POST(req) {
    try {
        const body = (await req.json());
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id || !user.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const reminders = Array.isArray(body.reminders) ? body.reminders : [];
        const deadlines = Array.isArray(body.deadlines) ? body.deadlines : [];
        const desiredJobs = buildReminderEmailJobs({
            userId: user.id,
            recipientEmail: user.email,
            reminders,
            deadlines,
        });
        const desiredJobKeys = desiredJobs.map((job) => job.job_key);
        const { data: existingJobs, error: fetchError } = await supabase
            .from('reminder_jobs')
            .select('id, job_key, status')
            .eq('user_id', user.id);
        if (fetchError) {
            if (isMissingReminderJobsTableError(fetchError)) {
                return NextResponse.json({
                    success: false,
                    disabled: true,
                    reason: 'reminder_jobs table is not available yet',
                });
            }
            throw fetchError;
        }
        const existingJobsByKey = new Map((existingJobs ?? []).map((job) => [job.job_key, job.status]));
        const jobsToUpsert = desiredJobs.filter((job) => existingJobsByKey.get(job.job_key) !== 'sent');
        if (jobsToUpsert.length > 0) {
            const { error: upsertError } = await supabase
                .from('reminder_jobs')
                .upsert(jobsToUpsert, { onConflict: 'user_id,job_key' });
            if (upsertError) {
                if (isMissingReminderJobsTableError(upsertError)) {
                    return NextResponse.json({
                        success: false,
                        disabled: true,
                        reason: 'reminder_jobs table is not available yet',
                    });
                }
                throw upsertError;
            }
        }
        const staleJobIds = (existingJobs ?? [])
            .filter((job) => (job.status === 'pending' || job.status === 'failed') && !desiredJobKeys.includes(job.job_key))
            .map((job) => job.id);
        if (staleJobIds.length > 0) {
            const { error: cancelError } = await supabase
                .from('reminder_jobs')
                .update({
                status: 'cancelled',
                last_error: null,
            })
                .in('id', staleJobIds);
            if (cancelError) {
                if (isMissingReminderJobsTableError(cancelError)) {
                    return NextResponse.json({
                        success: false,
                        disabled: true,
                        reason: 'reminder_jobs table is not available yet',
                    });
                }
                throw cancelError;
            }
        }
        return NextResponse.json({
            success: true,
            queuedJobs: desiredJobs.length,
            cancelledJobs: staleJobIds.length,
        });
    }
    catch (error) {
        console.error('Reminder Job Sync Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to sync reminder jobs';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
