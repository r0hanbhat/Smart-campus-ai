import { NextResponse } from 'next/server';
import { sendReminderEmail } from '@/lib/server/reminder-mailer';
import { getAuthenticatedUser } from '@/lib/server/supabase';

type EmailRequestBody = {
  itemName?: string;
  itemType?: 'reminder' | 'deadline';
  date?: string;
  time?: string;
  offsetHours?: number;
  deliveryReason?: 'created' | 'scheduled';
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EmailRequestBody;
    const { itemName, itemType, date, time, offsetHours, deliveryReason } = body;

    if (!itemName || !itemType || !date || !time) {
      return NextResponse.json({ error: 'Missing itemName/itemType/date/time' }, { status: 400 });
    }

    const { user, error: authError } = await getAuthenticatedUser();
    const email = user?.email;
    if (authError || !email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await sendReminderEmail({
      to: email,
      itemName,
      itemType,
      date,
      time,
      offsetHours,
      deliveryReason,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send Email API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
