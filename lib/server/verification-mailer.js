import nodemailer from 'nodemailer';
import { getReminderEmailTransportConfig } from './reminder-email.js';

function getTransporter() {
    const { gmailUser, gmailPass } = getReminderEmailTransportConfig();
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: gmailUser,
            pass: gmailPass,
        },
    });
}

export async function sendTeacherVerificationDecisionEmail({ to, fullName, status, reviewNotes }) {
    const { gmailUser } = getReminderEmailTransportConfig();
    const transporter = getTransporter();
    const normalizedStatus = status === 'approved' ? 'approved' : 'rejected';
    const subject = normalizedStatus === 'approved'
        ? 'Your Smart Campus teacher account has been approved'
        : 'Your Smart Campus teacher account review update';
    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
            <h2>Teacher verification ${normalizedStatus}</h2>
            <p>Hello ${fullName || 'Teacher'},</p>
            <p>Your Smart Campus AI teacher verification request has been <strong>${normalizedStatus}</strong>.</p>
            ${reviewNotes ? `<p><strong>Admin note:</strong> ${reviewNotes}</p>` : ''}
            <p>${normalizedStatus === 'approved'
            ? 'You can now sign in and use the Teacher Panel for course management, assignments, lesson plans, and student communication.'
            : 'Please review the note above and submit an updated request if needed.'}</p>
        </div>
    `;
    await transporter.sendMail({
        from: `Smart Campus AI <${gmailUser}>`,
        to,
        subject,
        html,
    });
}
