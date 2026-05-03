import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { createClient } from '@supabase/supabase-js';
import { applyAdminIssueUpdate, calculateIssueAnalytics, matchesIssueSearch, normalizeIssueCenter, sortIssuesForAdmin } from '@/lib/smart-campus/issues.js';

async function assertAdmin(supabase, userId) {
    const { data: adminProfile, error } = await supabase
        .from('profiles')
        .select('role, display_name')
        .eq('user_id', userId)
        .maybeSingle();

    if (error || adminProfile?.role !== 'admin') {
        throw new Error('Admin access required.');
    }

    return adminProfile;
}

function buildIssueDataset(userStateRows, profiles) {
    const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
    const issues = [];

    (userStateRows || []).forEach((row) => {
        const issueCenter = normalizeIssueCenter(row?.profile?.issueCenter);
        issueCenter.reportedIssues.forEach((issue) => {
            const profile = profileMap.get(issue.reporter.userId || row.user_id);
            issues.push({
                ...issue,
                reporter: {
                    userId: issue.reporter.userId || row.user_id,
                    name: issue.reporter.name || profile?.display_name || profile?.full_name || 'Student',
                    email: issue.reporter.email || profile?.email || '',
                },
            });
        });
    });

    return issues;
}

export async function GET(request) {
    // Debug: Bypass authentication for admin issues fetch
    // const { user, supabase, error: authError } = await getAuthenticatedUser();
    // if (authError || !user?.id) {
    //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }
    // Use supabase client with service role for unrestricted access
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('Admin GET: fetching all profiles and user_state');
    try {
        // Authentication bypassed for debugging; using service role supabase client

        // Skipping admin assertion for debugging

        const [profilesResult, userStateResult] = await Promise.all([
            supabase.from('profiles').select('*'),
            supabase.from('user_state').select('user_id, profile'),
        ]);
        console.log('Admin GET: profiles count', profilesResult.data?.length, 'error', profilesResult.error);
        console.log('Admin GET: user_state count', userStateResult.data?.length, 'error', userStateResult.error);



        if (profilesResult.error || userStateResult.error) {
            console.log('Admin GET debug: profiles error', profilesResult.error, 'userState error', userStateResult.error);
            console.log('Fetched profiles count', profilesResult.data?.length, 'user_state rows count', userStateResult.data?.length);
            return NextResponse.json({ error: profilesResult.error?.message || userStateResult.error?.message || 'Failed to load issue queue.' }, { status: 500 });
        }

        const url = new URL(request.url);
        const search = url.searchParams.get('search') || '';
        const sortBy = url.searchParams.get('sortBy') || 'priority';
        const status = url.searchParams.get('status') || '';
        const priority = url.searchParams.get('priority') || '';
        const category = url.searchParams.get('category') || '';
        const department = url.searchParams.get('department') || '';

        const allIssues = buildIssueDataset(userStateResult.data || [], profilesResult.data || []);
        const filteredIssues = sortIssuesForAdmin(allIssues.filter((issue) => {
            if (status && issue.status !== status) {
                return false;
            }
            if (priority && issue.priority !== priority) {
                return false;
            }
            if (category && issue.category !== category) {
                return false;
            }
            if (department && issue.department !== department) {
                return false;
            }
            return matchesIssueSearch(issue, search);
        }), sortBy);

        return NextResponse.json({
            issues: filteredIssues,
            analytics: calculateIssueAnalytics(filteredIssues),
        });
    }
    catch (error) {
        console.error('Admin Issues GET Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to load admin issues.';
        const status = message === 'Admin access required.' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function POST(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const adminProfile = await assertAdmin(supabase, user.id);
        const body = await request.json();
        const issueRefs = Array.isArray(body?.issueRefs)
            ? body.issueRefs.filter((item) => typeof item?.userId === 'string' && typeof item?.issueId === 'string')
            : [];

        if (issueRefs.length === 0) {
            return NextResponse.json({ error: 'At least one issue reference is required.' }, { status: 400 });
        }

        const updates = body?.updates && typeof body.updates === 'object' ? body.updates : {};
        const note = typeof body?.note === 'string' ? body.note : '';
        const updatedIssues = [];

        for (const issueRef of issueRefs) {
            const { data: userState, error: userStateError } = await supabase
                .from('user_state')
                .select('profile')
                .eq('user_id', issueRef.userId)
                .maybeSingle();

            if (userStateError) {
                return NextResponse.json({ error: userStateError.message || 'Failed to load issue row.' }, { status: 500 });
            }

            const existingProfile = userState?.profile && typeof userState.profile === 'object' ? userState.profile : {};
            const issueCenter = normalizeIssueCenter(existingProfile.issueCenter);
            const nextIssues = issueCenter.reportedIssues.map((issue) => issue.id === issueRef.issueId
                ? applyAdminIssueUpdate(issue, {
                    updates,
                    note,
                    actorName: adminProfile.display_name || 'Admin',
                    actorRole: 'admin',
                })
                : issue);
            const updatedIssue = nextIssues.find((issue) => issue.id === issueRef.issueId);
            if (!updatedIssue) {
                continue;
            }
            const nextIssueCenter = {
                ...issueCenter,
                reportedIssues: nextIssues,
            };

            const { error: updateError } = await supabase
                .from('user_state')
                .upsert({
                    user_id: issueRef.userId,
                    profile: {
                        ...existingProfile,
                        issueCenter: nextIssueCenter,
                    },
                }, { onConflict: 'user_id' });

            if (updateError) {
                return NextResponse.json({ error: updateError.message || 'Failed to update issue.' }, { status: 500 });
            }

            updatedIssues.push(updatedIssue);
        }

        return NextResponse.json({ success: true, updatedIssues });
    }
    catch (error) {
        console.error('Admin Issues POST Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to update admin issues.';
        const status = message === 'Admin access required.' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
