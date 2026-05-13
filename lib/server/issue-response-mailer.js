import nodemailer from 'nodemailer';

function readMailConfig() {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_PASS;

    if (!gmailUser || !gmailPass) {
        throw new Error('Missing GMAIL_USER or GMAIL_PASS in environment.');
    }

    return { gmailUser, gmailPass };
}

function getTransporter() {
    const { gmailUser, gmailPass } = readMailConfig();
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: gmailUser,
            pass: gmailPass,
        },
    });
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ── What-happens-next copy for each status ──────────────────────────────────
const STATUS_NEXT_ACTION = {
    submitted:        'Your report is in the admin queue. It will be reviewed and triaged shortly.',
    triaged:          'Your issue has been reviewed and categorised. It is now being assigned to the relevant department.',
    assigned:         'A team from the department has been assigned to your issue. They will assess and begin working on it.',
    in_progress:      'The assigned team is actively working on resolving your issue. You will receive an update when it is resolved.',
    awaiting_student: 'The team needs more information from you. Please check the admin notes in your issue tracker and respond.',
    resolved:         'Your issue has been resolved! Please log in to confirm or rate your satisfaction with the resolution.',
    closed:           'This issue has been closed. Thank you for helping us improve the campus experience.',
};

// ── Confirmation email — sent immediately after student submits ─────────────
function buildIssueConfirmationEmail({ studentName, issueTitle, issueId, category, priority, department, slaDueAt }) {
    const slaDate = slaDueAt ? new Date(slaDueAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const priorityColor = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }[priority] || '#64748b';

    return {
        subject: `Issue Received: "${issueTitle}" — Smart Campus`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px; border-radius: 18px 18px 0 0;">
            <h1 style="margin: 0; color: #34d399; font-size: 22px;">✅ Issue Received</h1>
            <p style="margin: 10px 0 0; color: #cbd5e1; font-size: 14px;">Hi ${escapeHtml(studentName || 'Student')}, we have received your campus issue report.</p>
          </div>
          <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 18px 18px; background: #f8fafc; padding: 28px;">
            <div style="margin-bottom: 20px; padding: 16px; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b;">Issue Title</div>
              <div style="margin-top: 6px; font-size: 20px; font-weight: 700; color: #0f172a;">${escapeHtml(issueTitle)}</div>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
              <tr>
                <td style="padding: 8px 0; font-weight: 600; width: 40%;">Reference ID</td>
                <td style="padding: 8px 0; font-family: monospace; font-size: 12px; color: #64748b;">${escapeHtml(issueId)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Category</td>
                <td style="padding: 8px 0;">${escapeHtml(category)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Assigned To</td>
                <td style="padding: 8px 0;">${escapeHtml(department)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Priority</td>
                <td style="padding: 8px 0;"><span style="display: inline-block; padding: 2px 10px; border-radius: 9999px; background: ${priorityColor}22; color: ${priorityColor}; font-weight: 700; text-transform: capitalize;">${escapeHtml(priority)}</span></td>
              </tr>
              ${slaDate ? `<tr><td style="padding: 8px 0; font-weight: 600;">Resolution Target</td><td style="padding: 8px 0;">${escapeHtml(slaDate)}</td></tr>` : ''}
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Current Status</td>
                <td style="padding: 8px 0;"><span style="font-weight: 700; color: #0ea5e9;">Submitted</span></td>
              </tr>
            </table>
            <div style="margin-top: 20px; padding: 14px 16px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0; color: #1e40af; font-size: 14px; line-height: 1.7;">
              <strong>What happens next?</strong><br />${STATUS_NEXT_ACTION.submitted}
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="margin: 0; color: #64748b; font-size: 13px;">You will receive email updates each time the admin team takes action on your issue. You can also track live progress in your <strong>Student Portal → Issues</strong> tab.</p>
          </div>
        </div>
        `,
    };
}

// ── Admin update email — sent whenever the admin changes status / adds a note ─
function buildIssueResponseEmail({ studentName, issueTitle, issueStatus, department, resolutionSummary, note }) {
    const statusLabel = issueStatus.replace(/_/g, ' ');
    const summary = resolutionSummary?.trim() || note?.trim() || 'The admin team has updated your issue.';

    return {
        subject: `Update on your campus issue: ${issueTitle}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px; border-radius: 18px 18px 0 0;">
            <h1 style="margin: 0; color: #67e8f9; font-size: 24px;">Issue Update</h1>
            <p style="margin: 10px 0 0; color: #cbd5e1; font-size: 14px;">Hello ${escapeHtml(studentName || 'Student')}, the admin team has responded to your query.</p>
          </div>
          <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 18px 18px; background: #f8fafc; padding: 28px;">
            <div style="margin-bottom: 18px;">
              <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b;">Issue</div>
              <div style="margin-top: 6px; font-size: 20px; font-weight: 700; color: #0f172a;">${escapeHtml(issueTitle)}</div>
            </div>
            <div style="margin-bottom: 12px; color: #334155; line-height: 1.7;"><strong>New Status:</strong> <span style="font-weight: 700; text-transform: capitalize; color: #0f172a;">${escapeHtml(statusLabel)}</span></div>
            <div style="margin-bottom: 12px; color: #334155; line-height: 1.7;"><strong>Department:</strong> ${escapeHtml(department || 'General Administration')}</div>
            <div style="margin-bottom: 12px; color: #334155; line-height: 1.7;"><strong>Admin response:</strong><br />${escapeHtml(summary)}</div>
            ${note?.trim() && resolutionSummary?.trim() && note.trim() !== resolutionSummary.trim() ? `<div style="margin-bottom: 12px; color: #334155; line-height: 1.7;"><strong>Additional note:</strong><br />${escapeHtml(note)}</div>` : ''}
            <div style="margin-top: 20px; padding: 14px 16px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0; color: #1e40af; font-size: 14px; line-height: 1.7;">
              <strong>What happens next?</strong><br />${STATUS_NEXT_ACTION[issueStatus] || 'The admin team will continue working on your issue.'}
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="margin: 0; color: #64748b; font-size: 13px;">Track live progress in your <strong>Student Portal → Issues</strong> tab.</p>
          </div>
        </div>
        `,
    };
}

export async function sendIssueResponseEmail({ to, studentName, issueTitle, issueStatus, department, resolutionSummary, note }) {
    const { gmailUser } = readMailConfig();
    const transporter = getTransporter();
    const content = buildIssueResponseEmail({
        studentName,
        issueTitle,
        issueStatus,
        department,
        resolutionSummary,
        note,
    });

    await transporter.sendMail({
        from: `Smart Campus AI <${gmailUser}>`,
        to,
        subject: content.subject,
        html: content.html,
    });
}

export async function sendIssueConfirmationEmail({ to, studentName, issueTitle, issueId, category, priority, department, slaDueAt }) {
    const { gmailUser } = readMailConfig();
    const transporter = getTransporter();
    const content = buildIssueConfirmationEmail({
        studentName,
        issueTitle,
        issueId,
        category,
        priority,
        department,
        slaDueAt,
    });

    await transporter.sendMail({
        from: `Smart Campus AI <${gmailUser}>`,
        to,
        subject: content.subject,
        html: content.html,
    });
}
