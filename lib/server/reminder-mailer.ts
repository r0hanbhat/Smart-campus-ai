import nodemailer from 'nodemailer';
import {
  buildReminderEmailContent,
  getReminderEmailTransportConfig,
  type SendReminderEmailPayload,
} from './reminder-email';

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

export async function sendReminderEmail({
  to,
  itemName,
  itemType,
  date,
  time,
  offsetHours,
  deliveryReason,
}: SendReminderEmailPayload) {
  const { subject, html } = buildReminderEmailContent({
    itemName,
    itemType,
    date,
    time,
    offsetHours,
    deliveryReason,
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
