import { NextResponse } from 'next/server';
import { HindsightClient } from '@vectorize-io/hindsight-client';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieStoreWithMutators = Awaited<ReturnType<typeof cookies>> & {
  set?: (name: string, value: string) => void;
  delete?: (name: string) => void;
};

const hindsight = new HindsightClient({
  apiKey: process.env.HINDSIGHT_API_KEY!,
  baseUrl: 'https://api.hindsight.vectorize.io',
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { eventName, eventType, clubName, title, date, time, action } = body || {};

    // Derive user from Supabase session (do not trust client-supplied userId)
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
    const userId = authData?.user?.id;
    if (authError || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let memoryContent = '';

    // Store different types of activities
    if (action === 'attend_event') {
      if (!eventName || !eventType) {
        return NextResponse.json({ error: 'Missing eventName/eventType' }, { status: 400 });
      }
      memoryContent = `Student attended event: "${eventName}" (Type: ${eventType})`;
    } else if (action === 'join_club') {
      if (!clubName) {
        return NextResponse.json({ error: 'Missing clubName' }, { status: 400 });
      }
      memoryContent = `Student joined club: "${clubName}"`;
    } else if (action === 'set_reminder') {
      if (!eventName || !date || !time) {
        return NextResponse.json({ error: 'Missing eventName/date/time' }, { status: 400 });
      }
      memoryContent = `Student set a reminder for: "${eventName}" on ${date} at ${time}`;
    } else if (action === 'add_deadline') {
      if (!title || !date || !time) {
        return NextResponse.json({ error: 'Missing title/date/time' }, { status: 400 });
      }
      memoryContent = `Student added a deadline: "${title}" due on ${date} at ${time}`;
    } else if (action === 'check_in') {
      if (!eventName || !eventType) {
        return NextResponse.json({ error: 'Missing eventName/eventType' }, { status: 400 });
      }
      memoryContent = `Student checked in to event: "${eventName}" (Type: ${eventType})`;
    } else if (action === 'express_interest') {
      if (!eventType) {
        return NextResponse.json({ error: 'Missing eventType' }, { status: 400 });
      }
      memoryContent = `Student expressed interest in: ${eventType}`;
    } else {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    // Retain in Hindsight under the correct bank, with the user prefix so recall can filter.
    const prefixed = `[USER:${userId}] ${memoryContent}`;
    await hindsight.retain('smartai', prefixed);

    return NextResponse.json({ 
      success: true,
      message: 'Activity stored successfully'
    });

  } catch (error) {
    console.error('Store Activity Error:', error);
    return NextResponse.json(
      { error: 'Failed to store activity' },
      { status: 500 }
    );
  }
}
