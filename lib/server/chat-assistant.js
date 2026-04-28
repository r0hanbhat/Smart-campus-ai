import { CAMPUS_LOCATIONS } from '../smart-campus/constants.js';
export function formatDateForStorage(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}
export function parseDateFromMessage(dateStr) {
    const normalized = dateStr.toLowerCase();
    const extractedDate = new Date();
    if (normalized === 'tomorrow') {
        extractedDate.setDate(extractedDate.getDate() + 1);
        return extractedDate;
    }
    if (normalized === 'today') {
        return extractedDate;
    }
    if (normalized === 'next week') {
        extractedDate.setDate(extractedDate.getDate() + 7);
        return extractedDate;
    }
    if (normalized === 'next month') {
        extractedDate.setMonth(extractedDate.getMonth() + 1);
        return extractedDate;
    }
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    }
    if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [month, day, year] = dateStr.split('/').map(Number);
        return new Date(year, month - 1, day);
    }
    return null;
}
export function extractTimeFromMessage(message) {
    const match = message.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (!match) {
        return null;
    }
    const hour = Number(match[1]);
    const minute = Number(match[2] ?? '00');
    const meridiem = match[3].toUpperCase();
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
        return null;
    }
    return `${hour}:${`${minute}`.padStart(2, '0')} ${meridiem}`;
}
function createInvalidDateAction(error, message) {
    return {
        type: 'invalid_date',
        error,
        message,
        retryField: 'date',
    };
}
export function detectAction(message) {
    const lowerMsg = message.toLowerCase();
    for (const location of Object.keys(CAMPUS_LOCATIONS)) {
        if (lowerMsg.includes(location.toLowerCase()) &&
            (lowerMsg.includes('navigate') ||
                lowerMsg.includes('direction') ||
                lowerMsg.includes('way to') ||
                lowerMsg.includes('how to get') ||
                lowerMsg.includes('where is') ||
                lowerMsg.includes('take me to'))) {
            return {
                type: 'navigate',
                destination: location,
                confirmation: `Should I navigate you to ${location}?`,
            };
        }
    }
    if (lowerMsg.includes('remind') || lowerMsg.includes('reminder')) {
        const datePatterns = [
            /(\d{4}-\d{2}-\d{2})/,
            /(\d{2}\/\d{2}\/\d{4})/,
            /(tomorrow|today|next week|next month)/i,
        ];
        let dateStr = '';
        let extractedDate = null;
        for (const pattern of datePatterns) {
            const match = message.match(pattern);
            if (match) {
                dateStr = match[0];
                extractedDate = parseDateFromMessage(dateStr);
                break;
            }
        }
        const eventMatch = message.match(/remind(?: me)?(?:\s+(?:for|about))?\s+([^,\.]+?)(\s+on|\s+at|\s+tomorrow|\s+today|\s+\d|$)/i);
        if (eventMatch) {
            const eventName = eventMatch[1].trim();
            const finalDate = extractedDate ? formatDateForStorage(extractedDate) : '';
            if (extractedDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                extractedDate.setHours(0, 0, 0, 0);
                if (extractedDate < today) {
                    return createInvalidDateAction('past_date', `The date ${finalDate} is in the past. Please provide a future date.`);
                }
            }
            if (dateStr && !extractedDate) {
                return createInvalidDateAction('invalid_format', 'I could not understand that reminder date. Please use YYYY-MM-DD.');
            }
            return {
                type: 'set_reminder',
                eventName,
                date: finalDate,
                time: '9:00 AM',
                needsDate: !dateStr,
                needsTime: false,
                confirmation: dateStr
                    ? `Should I set a reminder for "${eventName}" on ${finalDate}?`
                    : `What date should I set the reminder for "${eventName}"? (Format: YYYY-MM-DD, e.g., 2026-03-25)`,
            };
        }
    }
    if (lowerMsg.includes('deadline') || lowerMsg.includes('due date') || lowerMsg.includes('due by')) {
        const datePatterns = [
            /(\d{4}-\d{2}-\d{2})/,
            /(\d{2}\/\d{2}\/\d{4})/,
            /(tomorrow|today|next week|next month)/i,
        ];
        let dateStr = '';
        let extractedDate = null;
        for (const pattern of datePatterns) {
            const match = message.match(pattern);
            if (match) {
                dateStr = match[0];
                extractedDate = parseDateFromMessage(dateStr);
                break;
            }
        }
        const deadlineMatch = message.match(/deadline.*?(for|about)\s+([^,\.]+?)(\s+on|\s+by|\s+tomorrow|\s+today|\s+\d|$)/i);
        if (deadlineMatch) {
            const title = deadlineMatch[2].trim();
            const finalDate = extractedDate ? formatDateForStorage(extractedDate) : '';
            const extractedTime = extractTimeFromMessage(message);
            if (extractedDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                extractedDate.setHours(0, 0, 0, 0);
                if (extractedDate < today) {
                    return createInvalidDateAction('past_date', `The date ${finalDate} is in the past. Please provide a future date.`);
                }
            }
            if (dateStr && !extractedDate) {
                return createInvalidDateAction('invalid_format', 'I could not understand that deadline date. Please use YYYY-MM-DD.');
            }
            return {
                type: 'add_deadline',
                title,
                date: finalDate,
                time: extractedTime ?? '',
                needsDate: !dateStr,
                needsTime: !extractedTime,
                confirmation: !dateStr
                    ? `What's the due date for "${title}"? (Format: YYYY-MM-DD, e.g., 2026-03-25)`
                    : !extractedTime
                        ? `What time is the deadline for "${title}" on ${finalDate}? (Example: 11:59 PM)`
                        : `Should I add a deadline for "${title}" on ${finalDate} at ${extractedTime}?`,
            };
        }
    }
    if (lowerMsg.includes('interested in') ||
        lowerMsg.includes('express interest in') ||
        (lowerMsg.includes('join') && lowerMsg.includes('club'))) {
        const interestMatch = message.match(/(?:interested in|express interest in)\s+(.+?)(?:$|\.|,)/i) ||
            message.match(/(?:join|want to join)\s+(.+?)(?:$|\.|,)/i);
        if (interestMatch?.[1]) {
            const eventType = interestMatch[1].trim();
            if (eventType.length > 0) {
                return {
                    type: 'express_interest',
                    eventType,
                    needsDate: false,
                    confirmation: `Should I save that you're interested in "${eventType}"?`,
                };
            }
        }
    }
    return null;
}
export function buildConversationSnapshot(recentMessages) {
    if (recentMessages.length === 0) {
        return '';
    }
    const transcript = recentMessages
        .slice(-12)
        .map((entry) => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content}`)
        .join('\n');
    const lastAssistantMessage = [...recentMessages]
        .reverse()
        .find((entry) => entry.role === 'assistant')?.content;
    const lastUserMessage = [...recentMessages]
        .reverse()
        .find((entry) => entry.role === 'user')?.content;
    return [
        'Recent Conversation:',
        transcript,
        lastAssistantMessage ? `Last assistant message: ${lastAssistantMessage}` : '',
        lastUserMessage ? `Last user message: ${lastUserMessage}` : '',
    ]
        .filter(Boolean)
        .join('\n');
}
export function buildCurrentContext(userContext) {
    if (!userContext)
        return '';
    let currentContext = '\n\nCurrent Session Data:\n';
    if (userContext.events?.length) {
        const rsvpEvents = userContext.events.filter((event) => event.attending);
        const checkedInEvents = userContext.events.filter((event) => event.checkedIn);
        if (rsvpEvents.length > 0) {
            currentContext += `Events RSVPed: ${rsvpEvents.map((event) => event.name).join(', ')}\n`;
        }
        if (checkedInEvents.length > 0) {
            currentContext += `Events Attended: ${checkedInEvents.map((event) => event.name).join(', ')}\n`;
        }
    }
    if (userContext.clubs?.length) {
        const joinedClubs = userContext.clubs.filter((club) => club.joined);
        if (joinedClubs.length > 0) {
            currentContext += `Clubs Joined: ${joinedClubs.map((club) => club.name).join(', ')}\n`;
        }
    }
    if (userContext.reminders?.length) {
        currentContext += `Active Reminders: ${userContext.reminders.map((reminder) => `${reminder.eventName} (${reminder.date}${reminder.time ? ` at ${reminder.time}` : ''})`).join(', ')}\n`;
    }
    if (userContext.deadlines?.length) {
        const pendingDeadlines = userContext.deadlines.filter((deadline) => !deadline.completed);
        if (pendingDeadlines.length > 0) {
            currentContext += `Pending Deadlines: ${pendingDeadlines.map((deadline) => `${deadline.title} (due ${deadline.date}${deadline.time ? ` at ${deadline.time}` : ''})`).join(', ')}\n`;
        }
    }
    if (userContext.plannerEntries?.length) {
        const openPlannerEntries = userContext.plannerEntries.filter((entry) => !entry.completed);
        if (openPlannerEntries.length > 0) {
            currentContext += `Planner Blocks: ${openPlannerEntries.map((entry) => `${entry.title} (${entry.date} ${entry.startTime}-${entry.endTime})`).join(', ')}\n`;
        }
    }
    if (userContext.profile) {
        currentContext += `Total Events Attended: ${userContext.profile.eventsAttended}\n`;
        currentContext += `Total Clubs Joined: ${userContext.profile.clubsJoined}\n`;
    }
    return currentContext;
}
export function buildSystemPrompt(params) {
    const actionPrompt = params.action && 'confirmation' in params.action
        ? `The user wants to: ${params.action.confirmation}\n\nRespond naturally and ask for confirmation.`
        : 'Based on the student history and current activities, provide helpful and personalized responses. If they ask about events, clubs, reminders, deadlines, or previous requests from this conversation, use the supplied context.';
    return `You are a Smart Campus AI Assistant for J.C. Bose University of Science and Technology. You help students with:
- Finding campus events
- Recommending clubs based on interests
- Campus navigation
- Setting reminders and managing deadlines
- Personalized recommendations
- Studying, research help, concept explanations, and solving academic problems step by step
- Understanding uploaded images and answering questions about them when an image is provided

${params.currentContext}

${params.conversationSnapshot}

${actionPrompt}

When students ask academic questions:
- Be warm, encouraging, and easy to understand
- Give accurate, structured explanations
- Break down solutions into steps instead of only giving the final answer
- Help with research by summarizing ideas, comparing options, and suggesting follow-up questions
- If the prompt sounds like homework, help them learn the method instead of only dumping a final answer
- For numerical or calculation-based problems, solve them step by step with clean presentation
- When giving code, use fenced code blocks
- If an image is uploaded, analyze it together with the student's question
- Pay close attention to the recent conversation so follow-up requests like "do it", "change it", "same one", "make it shorter", or "set it for tomorrow" resolve correctly
- When the user uses pronouns or shorthand, infer the most likely referent from the recent conversation instead of asking them to repeat themselves unless the reference is genuinely ambiguous
- Preserve continuity: if the user is clearly refining an earlier request, continue that task instead of starting over`;
}
