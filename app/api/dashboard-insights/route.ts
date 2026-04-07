import { NextResponse } from 'next/server';
import { HindsightClient } from '@vectorize-io/hindsight-client';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieStoreWithMutators = Awaited<ReturnType<typeof cookies>> & {
  set?: (name: string, value: string) => void;
  delete?: (name: string) => void;
};

type HindsightMemory = {
  text?: string;
};

type HindsightRecallResult = {
  results?: HindsightMemory[];
};

const hindsight = new HindsightClient({
  apiKey: process.env.HINDSIGHT_API_KEY!,
  baseUrl: 'https://api.hindsight.vectorize.io',
});

function toInsight(memoryText: string) {
  if (memoryText.includes('Student joined club:')) {
    const clubName = memoryText.match(/Student joined club: "(.+?)"/)?.[1];
    return clubName ? `You joined ${clubName}.` : null;
  }

  if (memoryText.includes('Student expressed interest in:')) {
    const interest = memoryText.replace('Student expressed interest in:', '').trim();
    return interest ? `You showed interest in ${interest}.` : null;
  }

  if (memoryText.includes('Student attended event:')) {
    const eventName = memoryText.match(/Student attended event: "(.+?)"/)?.[1];
    return eventName ? `You RSVPed for ${eventName}.` : null;
  }

  if (memoryText.includes('Student checked in to event:')) {
    const eventName = memoryText.match(/Student checked in to event: "(.+?)"/)?.[1];
    return eventName ? `You checked in to ${eventName}.` : null;
  }

  if (memoryText.includes('Student set a reminder for:')) {
    const reminderName = memoryText.match(/Student set a reminder for: "(.+?)"/)?.[1];
    return reminderName ? `You asked for reminders about ${reminderName}.` : null;
  }

  if (memoryText.includes('Student added a deadline:')) {
    const deadlineTitle = memoryText.match(/Student added a deadline: "(.+?)"/)?.[1];
    return deadlineTitle ? `You are tracking the deadline "${deadlineTitle}".` : null;
  }

  if (memoryText.includes('User:')) {
    const userPrompt = memoryText.match(/User: "(.+?)"/)?.[1];
    if (userPrompt) {
      return `You asked about: ${userPrompt}`;
    }
  }

  return null;
}

export async function GET() {
  try {
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

    const recallResult = await hindsight.recall('smartai', `[USER:${userId}] profile interests clubs events reminders deadlines study subjects`) as HindsightRecallResult;
    const filteredInsights = (recallResult.results ?? [])
      .filter((memory) => memory.text?.includes(`[USER:${userId}]`))
      .map((memory) => (memory.text ?? '').replace(`[USER:${userId}] `, ''))
      .map(toInsight)
      .filter((insight): insight is string => Boolean(insight));

    const uniqueInsights = Array.from(new Set(filteredInsights));

    return NextResponse.json({
      insights: uniqueInsights,
    });
  } catch (error) {
    console.error('Dashboard Insights Error:', error);
    return NextResponse.json(
      { insights: [] },
      { status: 200 }
    );
  }
}
