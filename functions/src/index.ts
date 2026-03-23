import * as functions from 'firebase-functions';
import * as nodemailer from 'nodemailer';

// Configure email transporter (using Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ritikbhat000@gmail.com', // REPLACE with your Gmail
    pass: 'cfvelxktpghanuvo', // REPLACE with your Gmail App Password
  },
});

export const sendReminderEmail = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  const { email, eventName, date, time } = req.body;

  const mailOptions = {
    from: 'Smart Campus AI <ritikbhat000@gmail.com>', // REPLACE with your Gmail
    to: email,
    subject: `🔔 Reminder: ${eventName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px;">
        <div style="background: white; padding: 30px; border-radius: 10px;">
          <h1 style="color: #667eea; margin-bottom: 20px;">🎓 Smart Campus AI</h1>
          <h2 style="color: #333; margin-bottom: 15px;">Event Reminder</h2>
          <div style="background: #f7f7f7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 18px; color: #333; margin: 10px 0;">
              <strong>📅 Event:</strong> ${eventName}
            </p>
            <p style="font-size: 16px; color: #666; margin: 10px 0;">
              <strong>📆 Date:</strong> ${date}
            </p>
            <p style="font-size: 16px; color: #666; margin: 10px 0;">
              <strong>🕐 Time:</strong> ${time}
            </p>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            This is a reminder for your upcoming event at J.C. Bose University.
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
            Smart Campus AI - J.C. Bose University
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('Email send error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});