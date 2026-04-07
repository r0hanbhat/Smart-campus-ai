import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { HindsightClient } from '@vectorize-io/hindsight-client';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type NavigateAction = {
  type: 'navigate';
  destination: string;
  confirmation: string;
};

type ReminderAction = {
  type: 'set_reminder';
  eventName: string;
  date: string;
  time: string;
  needsDate: boolean;
  needsTime?: boolean;
  confirmation: string;
};

type DeadlineAction = {
  type: 'add_deadline';
  title: string;
  date: string;
  time: string;
  needsDate: boolean;
  needsTime: boolean;
  confirmation: string;
};

type InterestAction = {
  type: 'express_interest';
  eventType: string;
  needsDate: false;
  confirmation: string;
};

type InvalidDateAction = {
  type: 'invalid_date';
  error: 'past_date' | 'invalid_format';
  message: string;
  retryField: 'date';
};

type Action = NavigateAction | ReminderAction | DeadlineAction | InterestAction | InvalidDateAction;

type SessionEvent = {
  name: string;
  date: string;
  attending?: boolean;
  checkedIn?: boolean;
};

type SessionClub = {
  name: string;
  joined?: boolean;
};

type SessionReminder = {
  eventName: string;
  date: string;
  time?: string;
};

type SessionDeadline = {
  title: string;
  date: string;
  time?: string;
  completed?: boolean;
};

type UserProfile = {
  eventsAttended: number;
  clubsJoined: number;
};

type UserContext = {
  events?: SessionEvent[];
  clubs?: SessionClub[];
  reminders?: SessionReminder[];
  deadlines?: SessionDeadline[];
  profile?: UserProfile;
};

type ChatRequestBody = {
  message?: string;
  userContext?: UserContext;
  imageDataUrl?: string;
  imageMimeType?: string;
  imageName?: string;
};

type HindsightMemory = {
  text?: string;
};

type HindsightRecallResult = {
  results?: HindsightMemory[];
};

type CookieStoreWithMutators = Awaited<ReturnType<typeof cookies>> & {
  set?: (name: string, value: string) => void;
  delete?: (name: string) => void;
};

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const hindsight = new HindsightClient({
  apiKey: process.env.HINDSIGHT_API_KEY!,
  baseUrl: 'https://api.hindsight.vectorize.io',
});

// Campus locations for navigation
const CAMPUS_LOCATIONS = ['Main Gate', 'Library', 'Computer department', 'Lal Chowk', 'Cafeteria/Academic Branch', 'Gym', 'Admin Block', 'Auditorium', 'Mandir', 'New Building', 'Electrical department', 'Bank', 'CV Raman Block', 'Mechanical Department', 'Shakutalam', 'Mechanical Workshop', 'Vita', 'Mother dairy', 'Academic Block', 'Girls Hostel', 'Dispensary'];

function formatDateForStorage(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateFromMessage(dateStr: string) {
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

function extractTimeFromMessage(message: string) {
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

// Detect if message contains an actionable intent
function detectAction(message: string): Action | null {
  const lowerMsg = message.toLowerCase();
  
  // Navigation intent
  for (const location of CAMPUS_LOCATIONS) {
    if (lowerMsg.includes(location.toLowerCase()) && (
      lowerMsg.includes('navigate') || 
      lowerMsg.includes('direction') || 
      lowerMsg.includes('way to') ||
      lowerMsg.includes('how to get') ||
      lowerMsg.includes('where is') ||
      lowerMsg.includes('take me to')
    )) {
      return {
        type: 'navigate',
        destination: location,
        confirmation: `Should I navigate you to ${location}?`
      };
    }
  }
  
  // Set reminder intent - IMPROVED
  if (lowerMsg.includes('remind') || lowerMsg.includes('reminder')) {
    // Check if date is provided in the message
    const datePatterns = [
      /(\d{4}-\d{2}-\d{2})/,  // 2026-03-25
      /(\d{2}\/\d{2}\/\d{4})/, // 03/25/2026
      /(tomorrow|today|next week|next month)/i
    ];
    
    let dateStr = '';
    let extractedDate: Date | null = null;
    
    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match) {
        dateStr = match[0];
        
        extractedDate = parseDateFromMessage(dateStr);
        break;
      }
    }
    
    const eventMatch = message.match(/remind.*?(for|about|me)\s+([^,\.]+?)(\s+on|\s+at|\s+tomorrow|\s+today|\s+\d|$)/i);
    if (eventMatch) {
      const eventName = eventMatch[2].trim();
      const finalDate = extractedDate ? formatDateForStorage(extractedDate) : '';
      
      // Check if date is in the past
      if (extractedDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        extractedDate.setHours(0, 0, 0, 0);
        
        if (extractedDate < today) {
          return {
            type: 'invalid_date',
            error: 'past_date',
            message: `The date ${finalDate} is in the past. Please provide a future date.`,
            retryField: 'date',
          };
        }
      }

      if (dateStr && !extractedDate) {
        return {
          type: 'invalid_date',
          error: 'invalid_format',
          message: 'I could not understand that reminder date. Please use YYYY-MM-DD.',
          retryField: 'date',
        };
      }
      
      return {
        type: 'set_reminder',
        eventName: eventName,
        date: finalDate,
        time: '9:00 AM',
        needsDate: !dateStr, // true if no date was provided
        needsTime: false,
        confirmation: dateStr 
          ? `Should I set a reminder for "${eventName}" on ${finalDate}?`
          : `What date should I set the reminder for "${eventName}"? (Format: YYYY-MM-DD, e.g., 2026-03-25)`
      };
    }
  }
  
  // Add deadline intent - IMPROVED
  if (lowerMsg.includes('deadline') || lowerMsg.includes('due date') || lowerMsg.includes('due by')) {
    // Check if date is provided
    const datePatterns = [
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{2}\/\d{2}\/\d{4})/,
      /(tomorrow|today|next week|next month)/i
    ];
    
    let dateStr = '';
    let extractedDate: Date | null = null;
    
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
      
      // Check if date is in the past
      if (extractedDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        extractedDate.setHours(0, 0, 0, 0);
        
        if (extractedDate < today) {
          return {
            type: 'invalid_date',
            error: 'past_date',
            message: `The date ${finalDate} is in the past. Please provide a future date.`,
            retryField: 'date',
          };
        }
      }

      if (dateStr && !extractedDate) {
        return {
          type: 'invalid_date',
          error: 'invalid_format',
          message: 'I could not understand that deadline date. Please use YYYY-MM-DD.',
          retryField: 'date',
        };
      }
      
      return {
        type: 'add_deadline',
        title: title,
        date: finalDate,
        time: extractedTime ?? '',
        needsDate: !dateStr,
        needsTime: !extractedTime,
        confirmation: !dateStr
          ? `What's the due date for "${title}"? (Format: YYYY-MM-DD, e.g., 2026-03-25)`
          : !extractedTime
          ? `What time is the deadline for "${title}" on ${finalDate}? (Example: 11:59 PM)`
          : `Should I add a deadline for "${title}" on ${finalDate} at ${extractedTime}?`
      };
    }
  }
  
  // Express interest intent (clubs/events)
  // Examples: "I'm interested in AI & ML Club", "express interest in Robotics Society", "join Coding Club"
  if (
    lowerMsg.includes('interested in') ||
    lowerMsg.includes('express interest in') ||
    (lowerMsg.includes('join') && lowerMsg.includes('club'))
  ) {
    const interestMatch =
      message.match(/(?:interested in|express interest in)\s+(.+?)(?:$|\.|,)/i) ||
      message.match(/(?:join|want to join)\s+(.+?)(?:$|\.|,)/i);

    if (interestMatch && interestMatch[1]) {
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

export async function POST(req: Request) {
  try {
    const { message, userContext, imageDataUrl, imageName } = (await req.json()) as ChatRequestBody;
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
    }

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

    console.log('🔍 Processing request for authenticated user:', userId);

    // Detect if this is an actionable request
    const action = detectAction(message);

    // Step 1: Recall relevant memories from Hindsight
    let memories: HindsightRecallResult | null = null;
    let memoryContext = '';
    
    try {
      console.log('📝 Attempting to recall memories for user:', userId);
      
      // Store with user prefix to ensure separation
      const userPrefixedQuery = `[USER:${userId}] ${message}`;
      memories = await hindsight.recall('smartai', userPrefixedQuery);
      
      console.log('📦 Raw memories returned:', memories?.results?.length || 0);
      
      if (memories && memories.results && memories.results.length > 0) {
        // CRITICAL: Manually filter to only include this user's memories
        const userMemories = memories.results.filter((memory) => {
          // Check if memory text contains the user prefix
          const isUserMemory = memory.text?.includes(`[USER:${userId}]`);
          return isUserMemory;
        });
        
        console.log(`✅ Filtered from ${memories.results.length} to ${userMemories.length} memories for user ${userId}`);
        
        if (userMemories.length > 0) {
          memoryContext = '\n\nPrevious interactions and user preferences:\n';
          userMemories.forEach((memory) => {
            // Remove the user prefix when displaying
            const cleanText = (memory.text ?? '').replace(`[USER:${userId}] `, '');
            memoryContext += `- ${cleanText}\n`;
          });
          console.log('💭 Memory context built with', userMemories.length, 'memories');
        } else {
          console.log('❌ No user-specific memories found after filtering');
        }
      } else {
        console.log('📭 No memories found at all');
      }
    } catch (recallError) {
      console.error('❌ Memory recall failed:', recallError);
    }

    // Step 2: Build current session context
    let currentContext = '';
    if (userContext) {
      currentContext = '\n\nCurrent Session Data:\n';
      
      if (userContext.events && userContext.events.length > 0) {
        const rsvpEvents = userContext.events.filter((event) => event.attending);
        const checkedInEvents = userContext.events.filter((event) => event.checkedIn);
        
        if (rsvpEvents.length > 0) {
          currentContext += `Events RSVPed: ${rsvpEvents.map((event) => event.name).join(', ')}\n`;
        }
        if (checkedInEvents.length > 0) {
          currentContext += `Events Attended: ${checkedInEvents.map((event) => event.name).join(', ')}\n`;
        }
      }
      
      if (userContext.clubs && userContext.clubs.length > 0) {
        const joinedClubs = userContext.clubs.filter((club) => club.joined);
        if (joinedClubs.length > 0) {
          currentContext += `Clubs Joined: ${joinedClubs.map((club) => club.name).join(', ')}\n`;
        }
      }
      
      if (userContext.reminders && userContext.reminders.length > 0) {
        currentContext += `Active Reminders: ${userContext.reminders.map((reminder) => `${reminder.eventName} (${reminder.date}${reminder.time ? ` at ${reminder.time}` : ''})`).join(', ')}\n`;
      }
      
      if (userContext.deadlines && userContext.deadlines.length > 0) {
        const pendingDeadlines = userContext.deadlines.filter((deadline) => !deadline.completed);
        if (pendingDeadlines.length > 0) {
          currentContext += `Pending Deadlines: ${pendingDeadlines.map((deadline) => `${deadline.title} (due ${deadline.date}${deadline.time ? ` at ${deadline.time}` : ''})`).join(', ')}\n`;
        }
      }

      if (userContext.profile) {
        currentContext += `Total Events Attended: ${userContext.profile.eventsAttended}\n`;
        currentContext += `Total Clubs Joined: ${userContext.profile.clubsJoined}\n`;
      }
    }
    
    // Step 3: Create system prompt
    const actionPrompt =
      action && 'confirmation' in action
        ? `The user wants to: ${action.confirmation}\n\nRespond naturally and ask for confirmation.`
        : 'Based on the student\'s history and current activities, provide helpful, personalized responses. If they ask about their events, clubs, or activities, reference the data from "Current Session Data" above. You are also a friendly study partner who helps with research, subject questions, concept explanations, brainstorming, and step-by-step problem solving.';

    const systemPrompt = `You are a Smart Campus AI Assistant for J.C. Bose University of Science and Technology. You help students with:
- Finding campus events
- Recommending clubs based on interests  
- Campus navigation (locations: Library, CS Building, Student Union, Main Hall, Cafeteria, Gym, Admin Block)
- Setting reminders and managing deadlines
- Personalized recommendations
- Studying, research help, concept explanations, and solving academic problems step by step
- Understanding uploaded images and answering questions about them when an image is provided

${memoryContext}${currentContext}

${actionPrompt}

When students ask academic questions:
- Be warm, encouraging, and easy to understand
- Give accurate, structured explanations
- Break down solutions into steps instead of only giving the final answer
- Help with research by summarizing ideas, comparing options, and suggesting follow-up questions
- If the prompt sounds like homework, help them learn the method instead of only dumping a final answer
- For numerical or calculation-based problems, always solve them step by step with clean presentation
- When giving code, use fenced code blocks and organize the answer clearly
- If an image is uploaded, analyze the image and use it together with the student's question`;

    // Step 4: Get AI response from Groq
    const userMessageContent = imageDataUrl
      ? [
          { type: 'text' as const, text: imageName ? `${message}\n\nAttached image: ${imageName}` : message },
          { type: 'image_url' as const, image_url: { url: imageDataUrl, detail: 'auto' as const } },
        ]
      : message;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessageContent },
      ],
      model: imageDataUrl ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 1024,
    });

    let aiResponse = completion.choices[0]?.message?.content || 'Sorry, I could not process that.';
    
    // If action detected, append confirmation request or ask for date
    if (action) {
      if (action.type === 'invalid_date') {
        aiResponse = action.message;
      } else if ('needsDate' in action && action.needsDate) {
        aiResponse = action.confirmation; // Ask for the date
      } else {
        aiResponse += `\n\n${action.confirmation}`; // Show confirmation
      }
    }

    // Step 5: Store this interaction in Hindsight WITH USER PREFIX
    try {
      const memoryText = `[USER:${userId}] User: "${message}" | Response: "${aiResponse}"`;
      await hindsight.retain('smartai', memoryText);
      console.log('✅ Memory stored with user prefix for:', userId);
      console.log('📝 Stored text:', memoryText.substring(0, 100) + '...');
    } catch (error) {
      console.error('❌ Memory storage failed:', error);
    }

    return NextResponse.json({ 
      response: aiResponse,
      memoriesUsed: memoryContext ? memoryContext.split('\n').length - 2 : 0,
      action: action
    });

  } catch (error) {
    console.error('❌ Chat API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
