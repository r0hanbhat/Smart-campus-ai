import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieStoreWithMutators = Awaited<ReturnType<typeof cookies>> & {
  set?: (name: string, value: string) => void;
  delete?: (name: string) => void;
};

type EmailRequestBody = {
  itemName?: string;
  itemType?: 'reminder' | 'deadline';
  date?: string;
  time?: string;
  offsetHours?: number;
  deliveryReason?: 'created' | 'scheduled';
};

function getTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_PASS;

  if (!gmailUser || !gmailPass) {
    throw new Error('Missing GMAIL_USER or GMAIL_PASS in environment.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EmailRequestBody;
    const { itemName, itemType, date, time, offsetHours, deliveryReason } = body;

    if (!itemName || !itemType || !date || !time) {
      return NextResponse.json({ error: 'Missing itemName/itemType/date/time' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const cookieStoreWithMutators = cookieStore as CookieStoreWithMutators;
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string) {
            cookieStoreWithMutators.set?.(name, value);
          },
          remove(name: string) {
            cookieStoreWithMutators.delete?.(name);
          },
        },
      }
    );

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const email = authData?.user?.email;
    if (authError || !email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `Smart Campus AI <${process.env.GMAIL_USER}>`,
      to: email,
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
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send Email API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
