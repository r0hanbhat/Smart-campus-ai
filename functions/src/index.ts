import * as functions from 'firebase-functions';
import * as nodemailer from 'nodemailer';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';

type RuntimeConfig = {
  gmail?: {
    user?: string;
    pass?: string;
  };
};

const getRuntimeConfig = (): RuntimeConfig | undefined => {
  const configCarrier = functions as unknown as { config?: () => RuntimeConfig | undefined };
  return configCarrier.config?.();
};

const getMailTransporter = () => {
  const cfg = getRuntimeConfig();
  const gmailUser = process.env.GMAIL_USER || cfg?.gmail?.user;
  const gmailPass = process.env.GMAIL_PASS || cfg?.gmail?.pass;

  if (!gmailUser || !gmailPass) {
    throw new Error('Missing GMAIL_USER / GMAIL_PASS environment variables.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });
};

export const sendReminderEmail = functions.https.onRequest(async (req: ExpressRequest, res: ExpressResponse) => {
  res.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const body = typeof req.body === 'string'
    ? (() => {
        try {
          return JSON.parse(req.body);
        } catch {
          return {};
        }
      })()
    : req.body;

  const { email, eventName, itemName, itemType, date, time, offsetHours, deliveryReason } = body || {};
  const resolvedItemName = itemName || eventName;
  const resolvedItemType = itemType === 'deadline' ? 'deadline' : 'reminder';
  const validOffsetHours = offsetHours === 6 || offsetHours === 2 || offsetHours === 0 ? offsetHours : null;
  const resolvedDeliveryReason = deliveryReason === 'created' ? 'created' : 'scheduled';

  if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
    res.status(400).json({ success: false, error: 'Invalid email' });
    return;
  }

  if (!resolvedItemName || typeof resolvedItemName !== 'string') {
    res.status(400).json({ success: false, error: 'Invalid itemName' });
    return;
  }

  if (!date || typeof date !== 'string') {
    res.status(400).json({ success: false, error: 'Invalid date' });
    return;
  }

  if (!time || typeof time !== 'string') {
    res.status(400).json({ success: false, error: 'Invalid time' });
    return;
  }

  const cfg = getRuntimeConfig();
  const gmailUser = process.env.GMAIL_USER || cfg?.gmail?.user;
  const heading = resolvedItemType === 'deadline' ? 'Deadline Reminder' : 'Reminder';
  const itemLabel = resolvedItemType === 'deadline' ? 'Deadline' : 'Reminder';
  const leadText = resolvedDeliveryReason === 'created'
    ? `Your ${itemLabel.toLowerCase()} has been created successfully in Smart Campus AI.`
    : validOffsetHours !== null
      ? validOffsetHours === 0
        ? `This ${itemLabel.toLowerCase()} email was sent at the scheduled time.`
        : `This ${itemLabel.toLowerCase()} email was sent ${validOffsetHours} hours before the scheduled time.`
      : `This is a scheduled ${itemLabel.toLowerCase()} email from Smart Campus AI.`;

  const mailOptions = {
    from: `Smart Campus AI <${gmailUser}>`,
    to: email,
    subject: `Smart Campus AI ${itemLabel}: ${resolvedItemName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px;">
        <div style="background: white; padding: 30px; border-radius: 10px;">
          <h1 style="color: #667eea; margin-bottom: 20px;">Smart Campus AI</h1>
          <h2 style="color: #333; margin-bottom: 15px;">${heading}</h2>
          <div style="background: #f7f7f7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 18px; color: #333; margin: 10px 0;">
              <strong>${itemLabel}:</strong> ${resolvedItemName}
            </p>
            <p style="font-size: 16px; color: #666; margin: 10px 0;">
              <strong>Date:</strong> ${date}
            </p>
            <p style="font-size: 16px; color: #666; margin: 10px 0;">
              <strong>Time:</strong> ${time}
            </p>
            ${resolvedDeliveryReason === 'created'
              ? `<p style="font-size: 16px; color: #666; margin: 10px 0;"><strong>Status:</strong> Created successfully</p>`
              : validOffsetHours !== null
                ? `<p style="font-size: 16px; color: #666; margin: 10px 0;"><strong>Heads up:</strong> ${validOffsetHours === 0 ? 'Right now' : `${validOffsetHours} hours remaining`}</p>`
                : ''}
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            ${leadText}
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
            Smart Campus AI - J.C. Bose University
          </p>
        </div>
      </div>
    `,
  };

  try {
    const transporter = getMailTransporter();
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: 'Email sent successfully' });
  } catch (error: unknown) {
    console.error('Email send error:', error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});
