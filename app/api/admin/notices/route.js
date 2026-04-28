import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient, getAuthenticatedUser } from '@/lib/server/supabase';
import nodemailer from 'nodemailer';

function getTransporter() {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_PASS;
    if (!gmailUser || !gmailPass) throw new Error('Missing GMAIL_USER or GMAIL_PASS in environment.');
    return nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
}

function buildNoticeEmail({ title, message, targetRole, gmailUser }) {
    const audienceLabel = targetRole === 'all' ? 'All Users' : targetRole === 'teacher' ? 'All Teachers' : 'All Students';
    return {
        from: `Smart Campus AI <${gmailUser}>`,
        subject: `📢 Notice from Admin: ${title}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 16px;">
            <h1 style="color: #67e8f9; margin: 0 0 8px;">📢 Campus Notice</h1>
            <p style="color: #94a3b8; margin: 0; font-size: 13px;">For: ${audienceLabel}</p>
          </div>
          <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #0f172a; margin: 0 0 16px;">${title}</h2>
            <p style="color: #334155; line-height: 1.7; white-space: pre-wrap;">${message}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">Smart Campus AI — J.C. Bose University</p>
          </div>
        </div>
        `,
    };
}

export async function POST(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
        if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

        const body = await request.json();
        const title = typeof body?.title === 'string' ? body.title.trim() : '';
        const message = typeof body?.message === 'string' ? body.message.trim() : '';
        const targetRole = ['student', 'teacher', 'all'].includes(body?.targetRole) ? body.targetRole : null;

        if (!title || !message || !targetRole) {
            return NextResponse.json({ error: 'title, message, and targetRole are required.' }, { status: 400 });
        }

        const serviceClient = createSupabaseServiceRoleClient();

        // Save notice to DB
        const { data: notice, error: insertError } = await serviceClient
            .from('notices')
            .insert({ title, message, target_role: targetRole, created_by: user.id })
            .select()
            .single();

        if (insertError) {
            if (insertError.code === '42P01') {
                return NextResponse.json({ error: 'notices table not found. Run notices_schema.sql in Supabase SQL Editor first.' }, { status: 503 });
            }
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        // ── Collect matching user_ids from profiles by role ──
        let profileQuery = serviceClient.from('profiles').select('user_id');
        if (targetRole !== 'all') {
            profileQuery = profileQuery.eq('role', targetRole);
        }
        const { data: matchedProfiles } = await profileQuery;
        const matchedUserIds = new Set((matchedProfiles || []).map(p => p.user_id));

        // ── Get real emails from auth.users via admin API ──
        // auth.users holds the canonical email; profiles.email is often null
        const emails = [];
        let page = 1;
        const perPage = 1000;
        while (true) {
            const { data: authData } = await serviceClient.auth.admin.listUsers({ page, perPage });
            const users = authData?.users || [];
            if (users.length === 0) break;
            for (const authUser of users) {
                if (targetRole === 'all' || matchedUserIds.has(authUser.id)) {
                    if (authUser.email) emails.push(authUser.email);
                }
            }
            if (users.length < perPage) break;
            page++;
        }

        // ── Send emails in batches ──
        const gmailUser = process.env.GMAIL_USER;
        const gmailPass = process.env.GMAIL_PASS;
        let emailsSent = 0;
        let emailError = null;

        if (gmailUser && gmailPass && emails.length > 0) {
            try {
                const transporter = getTransporter();
                const emailContent = buildNoticeEmail({ title, message, targetRole, gmailUser });
                const BATCH = 10;
                for (let i = 0; i < emails.length; i += BATCH) {
                    const batch = emails.slice(i, i + BATCH);
                    await Promise.allSettled(
                        batch.map(to => transporter.sendMail({ ...emailContent, to }))
                    );
                    emailsSent += batch.length;
                }
            } catch (err) {
                emailError = err instanceof Error ? err.message : 'Email sending failed';
                console.error('Notice email error:', emailError);
            }
        }

        return NextResponse.json({
            success: true,
            notice,
            recipientCount: emails.length,
            emailsSent,
            emailError: emailError || undefined,
            // Returned so the admin UI can trigger a browser push notification
            pushNotification: {
                title: `📢 New Notice: ${title}`,
                body: message.length > 100 ? `${message.slice(0, 100)}…` : message,
            },
        });
    } catch (error) {
        console.error('Admin Notices POST Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to post notice.' }, { status: 500 });
    }
}

export async function GET(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
        if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

        const serviceClient = createSupabaseServiceRoleClient();
        const params = new URL(request.url).searchParams;
        const limit = Math.min(Number(params.get('limit') || 50), 100);

        const { data: notices, error } = await serviceClient
            .from('notices')
            .select('id, title, message, target_role, created_at, created_by')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            if (error.code === '42P01') return NextResponse.json({ notices: [] });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ notices: notices || [] });
    } catch (error) {
        console.error('Admin Notices GET Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load notices.' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { user, supabase, error: authError } = await getAuthenticatedUser();
        if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
        if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

        const { id } = await request.json();
        if (!id) return NextResponse.json({ error: 'Notice id is required.' }, { status: 400 });

        const serviceClient = createSupabaseServiceRoleClient();
        const { error } = await serviceClient.from('notices').delete().eq('id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Admin Notices DELETE Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete notice.' }, { status: 500 });
    }
}
