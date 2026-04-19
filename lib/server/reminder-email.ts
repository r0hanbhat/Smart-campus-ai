type ReminderEmailPayload = {
  itemName: string;
  itemType: 'reminder' | 'deadline';
  date: string;
  time: string;
  offsetHours?: number;
  deliveryReason?: 'created' | 'scheduled';
};

export function buildReminderEmailContent({
  itemName,
  itemType,
  date,
  time,
  offsetHours,
  deliveryReason,
}: ReminderEmailPayload) {
  const itemLabel = itemType === 'deadline' ? 'Deadline' : 'Reminder';
  const validOffsetHours = offsetHours === 6 || offsetHours === 2 || offsetHours === 0 ? offsetHours : null;
  const resolvedDeliveryReason = deliveryReason === 'created' ? 'created' : 'scheduled';
  const leadText = resolvedDeliveryReason === 'created'
    ? `Your ${itemLabel.toLowerCase()} has been created successfully in Smart Campus AI.`
    : validOffsetHours !== null
      ? validOffsetHours === 0
        ? `This ${itemLabel.toLowerCase()} email was sent at the scheduled time.`
        : `This ${itemLabel.toLowerCase()} email was sent ${validOffsetHours} hours before the scheduled time.`
      : `This is a scheduled ${itemLabel.toLowerCase()} email from Smart Campus AI.`;

  return {
    itemLabel,
    subject: `Smart Campus AI ${itemLabel}: ${itemName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px;">
        <div style="background: white; padding: 30px; border-radius: 10px;">
          <h1 style="color: #667eea; margin-bottom: 20px;">Smart Campus AI</h1>
          <h2 style="color: #333; margin-bottom: 15px;">${itemLabel} Email</h2>
          <div style="background: #f7f7f7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 18px; color: #333; margin: 10px 0;">
              <strong>${itemLabel}:</strong> ${itemName}
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
}

export type SendReminderEmailPayload = ReminderEmailPayload & {
  to: string;
};

export function getReminderEmailTransportConfig() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_PASS;

  if (!gmailUser || !gmailPass) {
    throw new Error('Missing GMAIL_USER or GMAIL_PASS in environment.');
  }

  return {
    gmailUser,
    gmailPass,
  };
}
