import { NextResponse } from 'next/server';
import { HindsightClient } from '@vectorize-io/hindsight-client';

const hindsight = new HindsightClient({
  apiKey: process.env.HINDSIGHT_API_KEY!,
  bankId: 'smartai',  // Force use of smartai bank
  baseUrl: 'https://api.hindsight.vectorize.io',
});

export async function POST(req: Request) {
  try {
    const { userId, eventName, eventType, clubName, action } = await req.json();

    let memoryContent = '';

    // Store different types of activities
    if (action === 'attend_event') {
      memoryContent = `Student attended event: "${eventName}" (Type: ${eventType})`;
    } else if (action === 'join_club') {
      memoryContent = `Student joined club: "${clubName}"`;
    } else if (action === 'express_interest') {
      memoryContent = `Student expressed interest in: ${eventType}`;
    }

    // Retain in Hindsight
    await hindsight.retain(userId, memoryContent);

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