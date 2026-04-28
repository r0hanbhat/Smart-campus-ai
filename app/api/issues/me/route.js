import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { applyIssueSatisfaction, createIssueRecord, normalizeIssueCenter } from '@/lib/smart-campus/issues.js';

async function readIssueCenter(supabase, userId) {
    const { data, error } = await supabase
        .from('user_state')
        .select('profile')
        .eq('user_id', userId)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') {
        throw new Error(error.message || 'Failed to load issue data.');
    }

    return normalizeIssueCenter(data?.profile?.issueCenter);
}

async function writeIssueCenter(supabase, userId, issueCenter, existingProfile = null) {
    const nextProfile = {
        ...(existingProfile && typeof existingProfile === 'object' ? existingProfile : {}),
        issueCenter,
    };

    const { error } = await supabase
        .from('user_state')
        .upsert({
            user_id: userId,
            profile: nextProfile,
        }, { onConflict: 'user_id' });

    if (error) {
        throw new Error(error.message || 'Failed to save issue data.');
    }
}

export async function GET() {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const issueCenter = await readIssueCenter(supabase, user.id);
        return NextResponse.json(issueCenter);
    }
    catch (error) {
        console.error('Issue Center GET Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to load issue center.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const action = typeof body?.action === 'string' ? body.action : '';
        const { data: userState, error: stateError } = await supabase
            .from('user_state')
            .select('profile')
            .eq('user_id', user.id)
            .maybeSingle();

        if (stateError && stateError.code !== 'PGRST116') {
            return NextResponse.json({ error: stateError.message || 'Failed to load issue state.' }, { status: 500 });
        }

        const existingProfile = userState?.profile && typeof userState.profile === 'object' ? userState.profile : {};
        const issueCenter = normalizeIssueCenter(existingProfile.issueCenter);

        if (action === 'create') {
            const title = typeof body?.title === 'string' ? body.title.trim() : '';
            const description = typeof body?.description === 'string' ? body.description.trim() : '';
            if (!title || !description) {
                return NextResponse.json({ error: 'Title and description are required.' }, { status: 400 });
            }

            const nextIssue = createIssueRecord({
                title,
                description,
                category: typeof body?.category === 'string' ? body.category : 'Other',
                priority: typeof body?.priority === 'string' ? body.priority : 'medium',
                location: body?.location,
                evidence: Array.isArray(body?.evidence) ? body.evidence : [],
                reporter: {
                    userId: user.id,
                    name: typeof body?.reporterName === 'string' ? body.reporterName : (user.email?.split('@')[0] || 'Student'),
                    email: user.email || '',
                },
                notificationPreferences: issueCenter.notificationPreferences,
            });

            const nextIssueCenter = {
                ...issueCenter,
                reportedIssues: [nextIssue, ...issueCenter.reportedIssues],
            };

            await writeIssueCenter(supabase, user.id, nextIssueCenter, existingProfile);
            return NextResponse.json(nextIssueCenter);
        }

        if (action === 'updatePreferences') {
            const nextIssueCenter = {
                ...issueCenter,
                notificationPreferences: {
                    ...issueCenter.notificationPreferences,
                    ...(body?.notificationPreferences && typeof body.notificationPreferences === 'object' ? body.notificationPreferences : {}),
                },
            };
            await writeIssueCenter(supabase, user.id, nextIssueCenter, existingProfile);
            return NextResponse.json(nextIssueCenter);
        }

        if (action === 'rateSatisfaction') {
            const issueId = typeof body?.issueId === 'string' ? body.issueId : '';
            const rating = Number(body?.rating);
            if (!issueId || !Number.isFinite(rating)) {
                return NextResponse.json({ error: 'Issue ID and rating are required.' }, { status: 400 });
            }

            const nextIssues = issueCenter.reportedIssues.map((issue) => issue.id === issueId
                ? applyIssueSatisfaction(issue, rating, typeof body?.comment === 'string' ? body.comment : '')
                : issue);

            const nextIssueCenter = {
                ...issueCenter,
                reportedIssues: nextIssues,
            };

            await writeIssueCenter(supabase, user.id, nextIssueCenter, existingProfile);
            return NextResponse.json(nextIssueCenter);
        }

        return NextResponse.json({ error: 'Unsupported issue action.' }, { status: 400 });
    }
    catch (error) {
        console.error('Issue Center POST Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to save issue center.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
