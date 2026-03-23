import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { HindsightClient } from '@vectorize-io/hindsight-client';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const hindsight = new HindsightClient({
  apiKey: process.env.HINDSIGHT_API_KEY!,
  bankId: 'smartai',
  baseUrl: 'https://api.hindsight.vectorize.io',
});

// Campus locations for navigation
const CAMPUS_LOCATIONS = ['Main Gate', 'Library', 'Computer department', 'Lal Chowk', 'Cafeteria/Academic Branch', 'Gym', 'Admin Block', 'Auditorium', 'Mandir', 'New Building', 'Electrical department', 'Bank', 'CV Raman Block', 'Mechanical Department', 'Shakutalam', 'Mechanical Workshop', 'Vita', 'Mother dairy', 'Academic Block', 'Girls Hostel', 'Dispensary'];

// Detect if message contains an actionable intent
// Detect if message contains an actionable intent
function detectAction(message: string): any {
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
    let extractedDate = new Date();
    
    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match) {
        dateStr = match[0];
        
        // Parse different date formats
        if (dateStr.toLowerCase() === 'tomorrow') {
          extractedDate = new Date();
          extractedDate.setDate(extractedDate.getDate() + 1);
        } else if (dateStr.toLowerCase() === 'today') {
          extractedDate = new Date();
        } else if (dateStr.toLowerCase() === 'next week') {
          extractedDate = new Date();
          extractedDate.setDate(extractedDate.getDate() + 7);
        } else if (dateStr.toLowerCase() === 'next month') {
          extractedDate = new Date();
          extractedDate.setMonth(extractedDate.getMonth() + 1);
        } else if (dateStr.match(/\d{4}-\d{2}-\d{2}/)) {
          extractedDate = new Date(dateStr);
        } else if (dateStr.match(/\d{2}\/\d{2}\/\d{4}/)) {
          const parts = dateStr.split('/');
          extractedDate = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
        }
        break;
      }
    }
    
    const eventMatch = message.match(/remind.*?(for|about|me)\s+([^,\.]+?)(\s+on|\s+at|\s+tomorrow|\s+today|\s+\d|$)/i);
    if (eventMatch) {
      const eventName = eventMatch[2].trim();
      const finalDate = extractedDate.toISOString().split('T')[0];
      
      // Check if date is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      extractedDate.setHours(0, 0, 0, 0);
      
      if (extractedDate < today) {
        return {
          type: 'invalid_date',
          error: 'past_date',
          message: `The date ${finalDate} is in the past. Please provide a future date.`
        };
      }
      
      return {
        type: 'set_reminder',
        eventName: eventName,
        date: finalDate,
        time: '9:00 AM',
        needsDate: !dateStr, // true if no date was provided
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
    let extractedDate = new Date();
    
    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match) {
        dateStr = match[0];
        
        if (dateStr.toLowerCase() === 'tomorrow') {
          extractedDate = new Date();
          extractedDate.setDate(extractedDate.getDate() + 1);
        } else if (dateStr.toLowerCase() === 'today') {
          extractedDate = new Date();
        } else if (dateStr.toLowerCase() === 'next week') {
          extractedDate = new Date();
          extractedDate.setDate(extractedDate.getDate() + 7);
        } else if (dateStr.toLowerCase() === 'next month') {
          extractedDate = new Date();
          extractedDate.setMonth(extractedDate.getMonth() + 1);
        } else if (dateStr.match(/\d{4}-\d{2}-\d{2}/)) {
          extractedDate = new Date(dateStr);
        } else if (dateStr.match(/\d{2}\/\d{2}\/\d{4}/)) {
          const parts = dateStr.split('/');
          extractedDate = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
        }
        break;
      }
    }
    
    const deadlineMatch = message.match(/deadline.*?(for|about)\s+([^,\.]+?)(\s+on|\s+by|\s+tomorrow|\s+today|\s+\d|$)/i);
    if (deadlineMatch) {
      const title = deadlineMatch[2].trim();
      const finalDate = extractedDate.toISOString().split('T')[0];
      
      // Check if date is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      extractedDate.setHours(0, 0, 0, 0);
      
      if (extractedDate < today) {
        return {
          type: 'invalid_date',
          error: 'past_date',
          message: `The date ${finalDate} is in the past. Please provide a future date.`
        };
      }
      
      return {
        type: 'add_deadline',
        title: title,
        date: finalDate,
        needsDate: !dateStr,
        confirmation: dateStr
          ? `Should I add a deadline for "${title}" on ${finalDate}?`
          : `What's the due date for "${title}"? (Format: YYYY-MM-DD, e.g., 2026-03-25)`
      };
    }
  }
  
  return null;
}

export async function POST(req: Request) {
  try {
    const { message, userId, userContext } = await req.json();

    console.log('🔍 Processing request for user:', userId);

    // Detect if this is an actionable request
    let action = detectAction(message);

    // Step 1: Recall relevant memories from Hindsight
    let memories: any = null;
    let memoryContext = '';
    
    try {
      console.log('📝 Attempting to recall memories for user:', userId);
      
      // Store with user prefix to ensure separation
      const userPrefixedQuery = `[USER:${userId}] ${message}`;
      memories = await hindsight.recall('smartai', userPrefixedQuery);
      
      console.log('📦 Raw memories returned:', memories?.results?.length || 0);
      
      if (memories && memories.results && memories.results.length > 0) {
        // CRITICAL: Manually filter to only include this user's memories
        const userMemories = memories.results.filter((memory: any) => {
          // Check if memory text contains the user prefix
          const isUserMemory = memory.text && memory.text.includes(`[USER:${userId}]`);
          return isUserMemory;
        });
        
        console.log(`✅ Filtered from ${memories.results.length} to ${userMemories.length} memories for user ${userId}`);
        
        if (userMemories.length > 0) {
          memoryContext = '\n\nPrevious interactions and user preferences:\n';
          userMemories.forEach((memory: any) => {
            // Remove the user prefix when displaying
            const cleanText = memory.text.replace(`[USER:${userId}] `, '');
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
        const rsvpEvents = userContext.events.filter((e: any) => e.attending);
        const checkedInEvents = userContext.events.filter((e: any) => e.checkedIn);
        
        if (rsvpEvents.length > 0) {
          currentContext += `Events RSVPed: ${rsvpEvents.map((e: any) => e.name).join(', ')}\n`;
        }
        if (checkedInEvents.length > 0) {
          currentContext += `Events Attended: ${checkedInEvents.map((e: any) => e.name).join(', ')}\n`;
        }
      }
      
      if (userContext.clubs && userContext.clubs.length > 0) {
        const joinedClubs = userContext.clubs.filter((c: any) => c.joined);
        if (joinedClubs.length > 0) {
          currentContext += `Clubs Joined: ${joinedClubs.map((c: any) => c.name).join(', ')}\n`;
        }
      }
      
      if (userContext.reminders && userContext.reminders.length > 0) {
        currentContext += `Active Reminders: ${userContext.reminders.map((r: any) => `${r.eventName} (${r.date})`).join(', ')}\n`;
      }
      
      if (userContext.deadlines && userContext.deadlines.length > 0) {
        const pendingDeadlines = userContext.deadlines.filter((d: any) => !d.completed);
        if (pendingDeadlines.length > 0) {
          currentContext += `Pending Deadlines: ${pendingDeadlines.map((d: any) => `${d.title} (due ${d.date})`).join(', ')}\n`;
        }
      }

      if (userContext.profile) {
        currentContext += `Total Events Attended: ${userContext.profile.eventsAttended}\n`;
        currentContext += `Total Clubs Joined: ${userContext.profile.clubsJoined}\n`;
      }
    }
    
    // Step 3: Create system prompt
    const systemPrompt = `You are a Smart Campus AI Assistant for J.C. Bose University of Science and Technology. You help students with:
- Finding campus events
- Recommending clubs based on interests  
- Campus navigation (locations: Library, CS Building, Student Union, Main Hall, Cafeteria, Gym, Admin Block)
- Setting reminders and managing deadlines
- Personalized recommendations

${memoryContext}${currentContext}

${action ? `The user wants to: ${action.confirmation}\n\nRespond naturally and ask for confirmation.` : 'Based on the student\'s history and current activities, provide helpful, personalized responses. If they ask about their events, clubs, or activities, reference the data from "Current Session Data" above.'}`;

    // Step 4: Get AI response from Groq
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 1024,
    });

    let aiResponse = completion.choices[0]?.message?.content || 'Sorry, I could not process that.';
    
    // If action detected, append confirmation request or ask for date
    if (action) {
      if (action.type === 'invalid_date') {
        aiResponse = action.message;
        action = null; // Don't show confirm/cancel buttons
      } else if (action.needsDate) {
        aiResponse = action.confirmation; // Ask for the date
      } else {
        aiResponse += `\n\n${action.confirmation}`; // Show confirmation
      }
    }

    // Step 5: Store this interaction in Hindsight WITH USER PREFIX
    try {
      const memoryText = `[USER:${userId}] User: "${message}" | Response: "${aiResponse}"`;
      const stored = await hindsight.retain('smartai', memoryText);
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