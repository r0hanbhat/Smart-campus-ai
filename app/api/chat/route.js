import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import {
    buildConversationSnapshot,
    buildCurrentContext,
    buildSystemPrompt,
    detectAction,
} from '@/lib/server/chat-assistant';
import { getAuthenticatedUser } from '@/lib/server/supabase';
import { retrieveContext, buildRAGContextSection } from '@/lib/server/rag';

function createGroqClient() {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('GROQ_API_KEY is missing.');
    }
    return new Groq({ apiKey });
}

export async function POST(req) {
    try {
        const groq = createGroqClient();
        const { message, userContext, recentMessages, imageDataUrl, imageName } = await req.json();

        if (!message || typeof message !== 'string') {
            return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
        }

        const { user, error: authError } = await getAuthenticatedUser(req);
        if (authError || !user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ── 1. Detect structured action (navigation, reminder, deadline) ─────
        const action = detectAction(message);

        // ── 2. RAG retrieval — run in parallel with context building ──────────
        //    Skip retrieval only for image messages and navigation/interest actions
        //    Allow RAG for reminders/deadlines since they often involve campus policies
        const actionTypesSkipRAG = ['navigate', 'express_interest'];
        const shouldRunRAG = !imageDataUrl && (!action || !actionTypesSkipRAG.includes(action.type));
        const ragPromise   = shouldRunRAG
            ? retrieveContext(message)
            : Promise.resolve({ chunks: [], sources: [], contextBlock: '', hasContext: false });

        // ── 3. Build user-session context ─────────────────────────────────────
        const currentContext = buildCurrentContext(userContext);
        const conversationContext = (recentMessages ?? [])
            .filter(entry =>
                (entry.role === 'user' || entry.role === 'assistant') &&
                typeof entry.content === 'string' &&
                entry.content.trim().length > 0
            )
            .slice(-12);
        const conversationSnapshot = buildConversationSnapshot(conversationContext);

        // ── 4. Await RAG result ───────────────────────────────────────────────
        const ragResult = await ragPromise;
        const ragSection = buildRAGContextSection(ragResult.contextBlock);

        // ── 5. Build enriched system prompt ───────────────────────────────────
        const baseSystemPrompt = buildSystemPrompt({ currentContext, conversationSnapshot, action });
        //    Prepend RAG context before the base prompt so it takes highest priority
        const systemPrompt = ragSection
            ? `${ragSection}\n\n${baseSystemPrompt}`
            : baseSystemPrompt;

        // ── 6. Build user message content (text or multimodal) ───────────────
        const userMessageContent = imageDataUrl
            ? [
                { type: 'text', text: imageName ? `${message}\n\nAttached image: ${imageName}` : message },
                { type: 'image_url', image_url: { url: imageDataUrl, detail: 'auto' } },
              ]
            : message;

        // ── 7. Groq completion ────────────────────────────────────────────────
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                ...conversationContext.map(entry => ({
                    role:    entry.role,
                    content: entry.content,
                })),
                { role: 'user', content: userMessageContent },
            ],
            model: imageDataUrl
                ? 'meta-llama/llama-4-scout-17b-16e-instruct'
                : 'llama-3.3-70b-versatile',
            temperature: ragResult.hasContext ? 0.3 : 0.7, // lower temp when grounded
            max_tokens: 1400,
        });

        let aiResponse =
            completion.choices[0]?.message?.content || 'Sorry, I could not process that.';

        // ── 8. Append action confirmation ─────────────────────────────────────
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
            // ── RAG metadata returned to client (optional UI use) ────────────
            sources: ragResult.sources.length > 0 ? ragResult.sources : undefined,
            ragUsed: ragResult.hasContext,
        });
    } catch (error) {
        console.error('Chat API Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to process chat message';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
