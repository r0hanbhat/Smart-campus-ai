import nodemailer from 'nodemailer';
import { buildReminderEmailContent, getReminderEmailTransportConfig, } from './reminder-email.js';
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
export async function sendReminderEmail({ to, itemName, itemType, date, time, offsetHours, deliveryReason, extra, }) {
    const { subject, html } = buildReminderEmailContent({
        itemName,
        itemType,
        date,
        time,
        offsetHours,
        deliveryReason,
        extra,
    });
    const { gmailUser } = getReminderEmailTransportConfig();
    const transporter = getTransporter();
    await transporter.sendMail({
        from: `Smart Campus AI <${gmailUser}>`,
        to,
        subject,
        html,
    });
}
