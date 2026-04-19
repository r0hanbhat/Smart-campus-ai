import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import {
  buildConversationSnapshot,
  buildCurrentContext,
  buildSystemPrompt,
  detectAction,
  type ChatRequestBody,
} from '@/lib/server/chat-assistant';
import { getAuthenticatedUser } from '@/lib/server/supabase';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message, userContext, recentMessages, imageDataUrl, imageName } = (await req.json()) as ChatRequestBody;
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
    }

    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const action = detectAction(message);
    const currentContext = buildCurrentContext(userContext);

    const conversationContext = (recentMessages ?? [])
      .filter(
        (entry): entry is { role: 'user' | 'assistant'; content: string } =>
          (entry.role === 'user' || entry.role === 'assistant') &&
          typeof entry.content === 'string' &&
          entry.content.trim().length > 0
      )
      .slice(-12);

    const conversationSnapshot = buildConversationSnapshot(conversationContext);
    const systemPrompt = buildSystemPrompt({
      currentContext,
      conversationSnapshot,
      action,
    });

    const userMessageContent = imageDataUrl
      ? [
          { type: 'text' as const, text: imageName ? `${message}\n\nAttached image: ${imageName}` : message },
          { type: 'image_url' as const, image_url: { url: imageDataUrl, detail: 'auto' as const } },
        ]
      : message;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationContext.map((entry) => ({
          role: entry.role,
          content: entry.content,
        })),
        { role: 'user', content: userMessageContent },
      ],
      model: imageDataUrl ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 1400,
    });

    let aiResponse = completion.choices[0]?.message?.content || 'Sorry, I could not process that.';

    if (action) {
      if (action.type === 'invalid_date') {
        aiResponse = action.message;
      } else if ('needsDate' in action && action.needsDate) {
        aiResponse = action.confirmation;
      } else {
        aiResponse += `\n\n${action.confirmation}`;
      }
    }

    return NextResponse.json({
      response: aiResponse,
      memoriesUsed: 0,
      action,
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
