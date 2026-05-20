export function buildReminderEmailContent({ itemName, itemType, date, time, offsetHours, deliveryReason, extra = {} }) {
    if (itemType === 'event_registration' || deliveryReason === 'registered') {
        const { venue, timeEnd, endDate, clubName } = extra;
        const dateRange = endDate && endDate !== date ? `${date} - ${endDate}` : date;
        const timeRange = timeEnd ? `${time} - ${timeEnd}` : time;
        return {
            itemLabel: 'Event Registration',
            subject: `Registered: ${itemName} - Smart Campus AI`,
            html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px;">
        <div style="background: white; padding: 30px; border-radius: 10px;">
          <h1 style="color: #667eea; margin-bottom: 8px;">Smart Campus AI</h1>
          <p style="color: #999; font-size: 13px; margin-bottom: 24px;">Event Registration Confirmation</p>

          <div style="background: linear-gradient(135deg, #f0f4ff 0%, #fdf0ff 100%); border: 2px solid #667eea33; padding: 22px; border-radius: 12px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0 0 16px 0; font-size: 20px;">You're registered!</h2>
            <p style="font-size: 22px; color: #333; font-weight: bold; margin: 0 0 12px 0;">${itemName}</p>
            ${clubName ? `<p style="font-size: 14px; color: #667eea; margin: 0 0 16px 0;">Organized by ${clubName}</p>` : ''}
            <table style="width:100%; font-size: 15px; color: #555; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; width: 110px;"><strong>Date:</strong></td><td>${dateRange}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Time:</strong></td><td>${timeRange}</td></tr>
              ${venue ? `<tr><td style="padding: 6px 0;"><strong>Venue:</strong></td><td>${venue}</td></tr>` : ''}
            </table>
          </div>

          <div style="background: #fffbeb; border: 1px solid #f59e0b33; padding: 16px; border-radius: 10px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
              <strong>Reminder set!</strong> You'll receive an email reminder 6 hours before the event.
            </p>
          </div>

          <p style="color: #999; font-size: 12px; margin-top: 20px; text-align: center;">
            Smart Campus AI - J.C. Bose University of Science and Technology
          </p>
        </div>
      </div>
    `,
        };
    }

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
