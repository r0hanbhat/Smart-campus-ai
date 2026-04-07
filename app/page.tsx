'use client';

import { useState, useEffect, useRef, useEffectEvent } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { useAuth } from './contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import CampusChatPanel from './components/CampusChatPanel';

type NavigateAction = { type: 'navigate'; destination: keyof typeof CAMPUS_LOCATIONS; confirmation: string };
type AddDeadlineAction = { type: 'add_deadline'; title: string; date: string; time: string; needsDate?: boolean; needsTime?: boolean; confirmation: string };
type SetReminderAction = { type: 'set_reminder'; eventName: string; date: string; time: string; needsDate?: boolean; needsTime?: boolean; confirmation: string };
type ExpressInterestAction = { type: 'express_interest'; eventType: string; needsDate?: false; confirmation: string };
type InvalidDateAction = { type: 'invalid_date'; error: 'past_date' | 'invalid_format'; message: string; retryField: 'date' };
type PendingAction = NavigateAction | AddDeadlineAction | SetReminderAction | ExpressInterestAction;
type WaitingForDate = {
  action: AddDeadlineAction | SetReminderAction;
  originalMessage: string;
};
type WaitingForTime = {
  action: AddDeadlineAction | SetReminderAction;
  originalMessage: string;
};
type Message = { role: string; content: string; memoriesUsed?: number; action?: PendingAction; imagePreviewUrl?: string };
type Event = { id: string; name: string; type: string; date: string; time: string; location: string; attending?: boolean; checkedIn?: boolean };
type Club = { id: string; name: string; category: string; description: string; joined?: boolean };
type Deadline = { id: string; title: string; date: string; time: string; type: string; completed?: boolean };
type Reminder = { id: string; eventName: string; date: string; time: string };
type UploadedImage = { dataUrl: string; mimeType: string; name: string };
type Destination = (typeof CAMPUS_LOCATIONS)[keyof typeof CAMPUS_LOCATIONS];
type ChatApiResponse = {
  response?: string;
  memoriesUsed?: number;
  action?: PendingAction | InvalidDateAction | null;
  error?: string;
};
type DashboardInsightsResponse = {
  insights?: string[];
};

const CAMPUS_LOCATIONS = {
  'Main Gate': { lat: 28.367459, lng: 77.315229, name: 'Main Gate' },
  'Library': { lat: 28.367287020362372, lng: 77.31642864173253, name: 'Central Library' },
  'Computer department': { lat: 28.36730265621971, lng: 77.31657893615694, name: 'Computer Science Building' },
  'Lal Chowk': { lat: 28.367669360616897, lng: 77.31714479154222, name: 'Main Auditorium' },
  'Cafeteria/Academic Branch': { lat: 28.36719261515068, lng: 77.31567225879179, name: 'Cafeteria/Academic Branch' },
  'Gym': { lat: 28.3680, lng: 77.3162, name: 'Sports Complex' },
  'Admin Block': { lat: 28.3676, lng: 77.3150, name: 'Administration Block' },
  'Auditorium': { lat: 28.367720914584893, lng: 77.31756496114842, name: 'Auditorium' },
  'Mandir': { lat: 28.36654397587192, lng: 77.31807963324546, name: 'Central Mandir' },
  'New Building': { lat: 28.367553696005043, lng: 77.31829293839884, name: 'New Academic Building' },
  'Electrical department': { lat: 28.367369660765572, lng: 77.31711588160906, name: 'Electrical Department' },
  'Bank': { lat: 28.366610546139377, lng: 77.31584429742577, name: 'Central Bank' },
  'CV Raman Block': { lat: 28.36654217952919, lng: 77.31725160673959, name: 'CV Raman Block' },
  'Mechanical Department': { lat: 28.366502031214903, lng: 77.31687041450068, name: 'Mechanical Department' },
  'Shakutalam': { lat: 28.36679690059596, lng: 77.31675623209462, name: 'Shakutalam' },
  'Mechanical Workshop': { lat: 28.366937526794985, lng: 77.31716172897714, name: 'Mechanical Workshop' },
  'Vita': { lat: 28.367155904894155, lng: 77.31802718303948, name: 'Vita' },
  'Mother dairy': { lat: 28.36630551795039, lng: 77.315464715611, name: 'Mother Dairy' },
  'Academic Block': { lat: 28.366439324018607, lng: 77.316146724016, name: 'Academic Block' },
  'Girls Hostel': { lat: 28.367024917474744, lng: 77.31800513748757, name: 'Girls Hostel' },
  'Dispensary': { lat: 28.367725708494717, lng: 77.31729941865407, name: 'Dispensary' },
};

const CAMPUS_CENTER = { lat: 28.367459, lng: 77.315229 };

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [activeTab, setActiveTab] = useState('chat');
  const [chatMode, setChatMode] = useState<'assistant' | 'campus'>('assistant');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [waitingForDate, setWaitingForDate] = useState<WaitingForDate | null>(null);
  const [waitingForTime, setWaitingForTime] = useState<WaitingForTime | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [learnedInsights, setLearnedInsights] = useState<string[]>([]);

  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [userLocation, setUserLocation] = useState(CAMPUS_CENTER);
  const [currentLocationName, setCurrentLocationName] = useState('Main Gate');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [pendingClubJoinId, setPendingClubJoinId] = useState<string | null>(null);
  const [clubJoinConfirmation, setClubJoinConfirmation] = useState('');
  const notificationTimersRef = useRef<Record<string, number>>({});
  const emailTimersRef = useRef<Record<string, number>>({});
  const notificationPermissionRequestedRef = useRef(false);

  const joinedClubsCount = clubs.filter((club) => club.joined).length;
  const attendedEventsCount = events.filter((event) => event.checkedIn).length;
  const derivedProfile = {
    eventsAttended: attendedEventsCount,
    clubsJoined: joinedClubsCount,
  };
  const visibleInsights = Array.from(new Set(learnedInsights.length > 0
    ? learnedInsights
    : [
        ...clubs.filter((club) => club.joined).map((club) => `You joined ${club.name}.`),
        ...events.filter((event) => event.checkedIn).map((event) => `You checked in to ${event.name}.`),
        ...deadlines.filter((deadline) => !deadline.completed).map((deadline) => `You are tracking the deadline "${deadline.title}" due on ${deadline.date}.`),
        ...reminders.map((reminder) => `You asked to be reminded about ${reminder.eventName} on ${reminder.date}.`),
      ]));
  const aiMemoriesCount = visibleInsights.length;

  // Handle Authentication redirect
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  // 1. Fetch user data from Supabase (one row per user)
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      console.log("🔄 Attempting to fetch data from Supabase for user:", user.id);

      const { data, error } = await supabase
        .from('user_state')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // 'PGRST116' just means no rows found (new user), any other error is a real problem
        console.error("❌ SUPABASE FETCH ERROR:", error.message, error.hint);
      }

      if (data) {
        console.log("✅ Successfully loaded data from DB!");
        setEvents(data.events || []);
        setClubs(data.clubs || []);
        setReminders(data.reminders || []);
        setDeadlines((data.deadlines || []).map((deadline: Deadline) => ({
          ...deadline,
          time: deadline.time || '11:59 PM',
        })));
        setMessages(data.messages || [{
          role: 'assistant',
          content: `Welcome back ${user.email}! I'm ready to help. 🎓`,
        }]);
      } else {
        console.log("⚠️ No existing data found in DB. Loading defaults.");
        loadSampleData();
        setMessages([{
          role: 'assistant',
          content: `Hi ${user.email}! I'm your Smart Campus AI Assistant. I can help with campus tasks, reminders, deadlines, research, and study questions. 🎓`,
        }]);
      }
      setIsDataLoaded(true); // Mark data as fully loaded
    };

    if (!authLoading && user) {
      fetchUserData();
    }
  }, [user, authLoading, supabase]);

  // 2. Auto-save user data to Supabase (debounced + safe)
  useEffect(() => {
    const saveUserData = async () => {
      // ONLY save if the data has successfully loaded first to prevent overwriting with blanks
      if (user && isDataLoaded) { 
        console.log("💾 Attempting to save data to Supabase...");
        const profileForSave = {
          eventsAttended: events.filter((event) => event.checkedIn).length,
          clubsJoined: clubs.filter((club) => club.joined).length,
        };
        const { error } = await supabase
          .from('user_state')
          .upsert({
            user_id: user.id,
            events,
            clubs,
            reminders,
            deadlines,
            profile: profileForSave,
            messages
          }, { onConflict: 'user_id' });

        if (error) {
          console.error("❌ SUPABASE SAVE ERROR:", error.message, error.hint);
        } else {
          console.log("✅ Data saved successfully!");
        }
      }
    };

    // Small delay to prevent spamming the database on rapid state changes
    const timeoutId = setTimeout(() => {
      saveUserData();
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [events, clubs, reminders, deadlines, messages, user, isDataLoaded, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSampleData = () => {
    setEvents([
      { id: '1', name: 'AI Workshop', type: 'tech', date: '2026-03-25', time: '2:00 PM', location: 'CS Building' },
      { id: '2', name: 'Hackathon 2026', type: 'tech', date: '2026-03-27', time: '9:00 AM', location: 'Student Union' },
      { id: '3', name: 'Career Fair', type: 'career', date: '2026-03-28', time: '10:00 AM', location: 'Main Hall' },
      { id: '4', name: 'Music Fest', type: 'cultural', date: '2026-03-30', time: '6:00 PM', location: 'Main Hall' },
      { id: '5', name: 'Coding Bootcamp', type: 'tech', date: '2026-04-01', time: '3:00 PM', location: 'CS Building' },
    ]);
    setClubs([
      { id: '1', name: 'Coding Club', category: 'tech', description: 'Learn programming and build projects' },
      { id: '2', name: 'Robotics Society', category: 'tech', description: 'Build amazing robots' },
      { id: '3', name: 'AI & ML Club', category: 'tech', description: 'Explore artificial intelligence' },
      { id: '4', name: 'Dance Team', category: 'cultural', description: 'Express yourself through dance' },
      { id: '5', name: 'Entrepreneur Club', category: 'business', description: 'Start your venture' },
    ]);
    setDeadlines([]);
  };

  const handleSend = async () => {
    if ((!input.trim() && !uploadedImage) || loading || !user) return;
    const userMessage = input.trim() || 'Please analyze this image and answer my question.';
    const activeWaitingForDate = waitingForDate;
    const activeWaitingForTime = waitingForTime;
    const activeUploadedImage = uploadedImage;
    setInput('');
    setUploadedImage(null);
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      imagePreviewUrl: activeUploadedImage?.dataUrl,
    }]);
    setLoading(true);
    
    try {
      const userContext = {
        events,
        clubs,
        reminders,
        deadlines,
        profile: derivedProfile
      };

      let finalMessage = userMessage;
      if (activeWaitingForDate) {
        finalMessage = `${activeWaitingForDate.originalMessage} on ${userMessage}`;
      } else if (activeWaitingForTime) {
        finalMessage = `${activeWaitingForTime.originalMessage} at ${userMessage}`;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: finalMessage, 
          userId: user.id,
          userContext,
          imageDataUrl: activeUploadedImage?.dataUrl,
          imageMimeType: activeUploadedImage?.mimeType,
          imageName: activeUploadedImage?.name,
        }),
      });
      const data = (await response.json()) as ChatApiResponse;
      const responseText = data.response ?? data.error ?? 'Sorry, something went wrong.';
      
      if (data.action) {
        if (data.action.type === 'invalid_date') {
          if (activeWaitingForDate) {
            setWaitingForDate(activeWaitingForDate);
          }
          if (activeWaitingForTime) {
            setWaitingForTime(activeWaitingForTime);
          }
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: responseText,
            memoriesUsed: data.memoriesUsed,
          }]);
        } else if ('needsDate' in data.action && data.action.needsDate) {
          setWaitingForDate({
            action: data.action,
            originalMessage: activeWaitingForDate?.originalMessage ?? userMessage
          });
          setWaitingForTime(null);
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: responseText,
            memoriesUsed: data.memoriesUsed
          }]);
        } else if ('needsTime' in data.action && data.action.needsTime) {
          setWaitingForTime({
            action: data.action,
            originalMessage: activeWaitingForTime?.originalMessage ?? finalMessage
          });
          setWaitingForDate(null);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: responseText,
            memoriesUsed: data.memoriesUsed
          }]);
        } else {
          setWaitingForDate(null);
          setWaitingForTime(null);
          setPendingAction(data.action);
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: responseText,
            memoriesUsed: data.memoriesUsed,
            action: data.action ?? undefined
          }]);
        }
      } else {
        setWaitingForDate(null);
        setWaitingForTime(null);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: responseText,
          memoriesUsed: data.memoriesUsed 
        }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
    } finally {
      setLoading(false);
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    
    if (action.type === 'navigate') {
      const location = CAMPUS_LOCATIONS[action.destination as keyof typeof CAMPUS_LOCATIONS];
      if (location) {
        setSelectedDestination(location);
        setActiveTab('navigation');
      }
    } else if (action.type === 'add_deadline') {
      const deadline = {
        id: Date.now().toString(),
        title: action.title,
        date: action.date,
        time: action.time,
        type: 'custom',
      };
      setDeadlines((prev) => [...prev, deadline]);
      setActiveTab('deadlines');
      void fetch('/api/store-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_deadline',
          title: action.title,
          date: action.date,
          time: action.time,
        }),
      }).catch(() => undefined);
      void sendImmediateCreationEmail({
        itemName: action.title,
        itemType: 'deadline',
        date: action.date,
        time: action.time,
        email: user?.email || '',
      });
      void scheduleEmailForDeadline(deadline, user?.email || '');
      void scheduleNotificationForDeadline(deadline);
    } else if (action.type === 'set_reminder') {
      const reminder = {
        id: Date.now().toString(),
        eventName: action.eventName,
        date: action.date,
        time: action.time,
      };
      upsertReminder(reminder);
      setActiveTab('reminders');
      void fetch('/api/store-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_reminder',
          eventName: action.eventName,
          date: action.date,
          time: action.time,
        }),
      }).catch(() => undefined);
      void scheduleNotificationForReminder(reminder);
      void sendImmediateCreationEmail({
        itemName: action.eventName,
        itemType: 'reminder',
        date: action.date,
        time: action.time,
        email: user?.email || '',
      });
      void scheduleEmailForReminder(reminder, user?.email || '');
    } else if (action.type === 'express_interest') {
      void fetch('/api/store-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'express_interest',
          eventType: action.eventType,
        }),
      }).catch(() => undefined);
    }

    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: `✅ Done! ${
        action.type === 'navigate'
          ? 'Showing you the location on the map.'
          : action.type === 'express_interest'
            ? 'Saved your interest.'
            : 'I\'ve set that up for you.'
      }`
    }]);
    setPendingAction(null);
  };

  const cancelAction = () => {
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: 'No problem! Let me know if you need anything else.'
    }]);
    setPendingAction(null);
  };

  const handleRSVP = async (eventId: string) => {
    if (!user) return;
    const event = events.find(e => e.id === eventId);
    const wasAttending = event?.attending;
    setEvents(events.map(e => e.id === eventId ? { ...e, attending: !e.attending } : e));
    if (event && !wasAttending) {
      await fetch('/api/store-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, eventName: event.name, eventType: event.type, action: 'attend_event' }),
      });
      const reminder = { id: Date.now().toString(), eventName: event.name, date: event.date, time: event.time };
      upsertReminder(reminder);

      const notificationScheduled = await scheduleNotificationForReminder(reminder);
      void sendImmediateCreationEmail({
        itemName: event.name,
        itemType: 'reminder',
        date: event.date,
        time: event.time,
        email: user.email || '',
      });
      if (notificationScheduled) {
        alert(`✅ Reminder set for ${event.name}! You'll get a notification.`);
      } else {
        alert(`✅ Reminder set for ${event.name}!`);
      }
      void scheduleEmailForReminder(reminder, user.email || '');
    } else if (event && wasAttending) {
      removeReminderByEventName(event.name);
    }
  };

  const parseDateTimeLocal = (date: string, time: string) => {
    // Expecting time like "2:00 PM". Interpreted in local browser timezone.
    const timeParts = time.trim().split(/\s+/);
    if (timeParts.length < 2) {
      return new Date(`${date} ${time}`);
    }

    const ampm = timeParts[1]?.toLowerCase();
    const hm = timeParts[0];
    const [hStr, mStr] = hm.split(':');
    const ymd = date.split('-').map((x) => Number(x));

    if (ymd.length !== 3 || Number.isNaN(ymd[0]) || Number.isNaN(ymd[1]) || Number.isNaN(ymd[2])) {
      return new Date(`${date} ${time}`);
    }

    let hours = Number(hStr);
    const minutes = mStr ? Number(mStr) : 0;
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return new Date(`${date} ${time}`);
    }

    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    return new Date(ymd[0], ymd[1] - 1, ymd[2], hours, minutes, 0, 0);
  };

  const triggerImagePicker = () => {
    imageInputRef.current?.click();
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      event.target.value = '';
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Failed to read image.'));
      reader.readAsDataURL(file);
    });

    setUploadedImage({
      dataUrl,
      mimeType: file.type,
      name: file.name,
    });
    event.target.value = '';
  };

  const renderMessageContent = (content: string) => {
    const parts = content.split(/```([\w-]*)\n?([\s\S]*?)```/g);

    return parts.map((part, index) => {
      if (index % 3 === 0) {
        if (!part.trim()) return null;
        return (
          <div key={`text-${index}`} className="whitespace-pre-wrap text-sm leading-7">
            {part}
          </div>
        );
      }

      if (index % 3 === 1) {
        return null;
      }

      const language = parts[index - 1];
      return (
        <div key={`code-${index}`} className="my-4 overflow-hidden rounded-xl border border-white/10 bg-slate-950/90">
          <div className="border-b border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-cyan-200/80">
            {language || 'code'}
          </div>
          <pre className="overflow-x-auto px-4 py-4 text-sm leading-6 text-cyan-50">
            <code>{part.trim()}</code>
          </pre>
        </div>
      );
    });
  };

  const ensureNotificationPermission = async () => {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    // Only ask once per page load to avoid spamming the user.
    if (!notificationPermissionRequestedRef.current) {
      notificationPermissionRequestedRef.current = true;
      return (await Notification.requestPermission()) === 'granted';
    }
    return false;
  };

  const scheduleNotificationMoments = async (params: {
    itemId: string;
    title: string;
    bodyBuilder: (offsetHours: number) => string;
    date: string;
    time: string;
    offsets: number[];
  }) => {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) return false;
    if (!params?.date || !params?.time || !params?.title) return false;
    const permissionOk = await ensureNotificationPermission();
    if (!permissionOk) return false;

    const targetDate = parseDateTimeLocal(params.date, params.time);
    if (targetDate.getTime() <= Date.now()) return false;

    let scheduled = false;

    params.offsets.forEach((offsetHours) => {
      const timerKey = `${params.itemId}-${offsetHours}h`;
      if (notificationTimersRef.current[timerKey]) {
        scheduled = true;
        return;
      }

      const notifyAt = targetDate.getTime() - offsetHours * 60 * 60 * 1000;
      const timeUntil = notifyAt - Date.now();
      if (timeUntil <= 0) return;

      notificationTimersRef.current[timerKey] = window.setTimeout(() => {
        new Notification(params.title, {
          body: params.bodyBuilder(offsetHours),
          icon: '/icon.png',
          badge: '/badge.png',
          tag: timerKey,
        });
      }, timeUntil);

      scheduled = true;
    });

    return scheduled;
  };

  const scheduleNotificationForReminder = async (reminder: Reminder) => {
    if (!reminder?.date || !reminder?.time || !reminder?.eventName) return false;
    return scheduleNotificationMoments({
      itemId: reminder.id,
      title: 'Reminder Alert',
      bodyBuilder: (offsetHours) =>
        offsetHours === 0
          ? `${reminder.eventName} is happening now.`
          : `${reminder.eventName} is coming up in ${offsetHours} hours.`,
      date: reminder.date,
      time: reminder.time,
      offsets: [6, 2, 0],
    });
  };

  const scheduleNotificationForDeadline = async (deadline: Deadline) => {
    if (!deadline?.date || !deadline?.time || !deadline?.title || deadline.completed) return false;
    return scheduleNotificationMoments({
      itemId: deadline.id,
      title: 'Deadline Alert',
      bodyBuilder: (offsetHours) => `${deadline.title} is due in ${offsetHours} hours.`,
      date: deadline.date,
      time: deadline.time,
      offsets: [6, 2],
    });
  };

  const cancelScheduledNotification = (itemId: string) => {
    Object.keys(notificationTimersRef.current)
      .filter((key) => key === itemId || key.startsWith(`${itemId}-`))
      .forEach((key) => {
        clearTimeout(notificationTimersRef.current[key]);
        delete notificationTimersRef.current[key];
      });
  };

  const cancelScheduledEmail = (itemId: string) => {
    Object.keys(emailTimersRef.current)
      .filter((key) => key === itemId || key.startsWith(`${itemId}-`))
      .forEach((key) => {
        clearTimeout(emailTimersRef.current[key]);
        delete emailTimersRef.current[key];
      });
  };

  const SEND_EMAIL_API_URL = '/api/send-email';

  const sendReminderEmailNow = async (payload: {
    email: string;
    itemName: string;
    itemType: 'reminder' | 'deadline';
    date: string;
    time: string;
    offsetHours: number;
    deliveryReason?: 'created' | 'scheduled';
  }) => {
    if (!SEND_EMAIL_API_URL) return;

    try {
      await fetch(SEND_EMAIL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: payload.itemName,
          itemType: payload.itemType,
          date: payload.date,
          time: payload.time,
          offsetHours: payload.offsetHours,
          deliveryReason: payload.deliveryReason ?? 'scheduled',
        }),
      });
    } catch {
      // Don't block UX if email fails; notifications + UI state still work.
    }
  };

  const sendImmediateCreationEmail = async (params: {
    itemName: string;
    itemType: 'reminder' | 'deadline';
    date: string;
    time: string;
    email: string;
  }) => {
    if (!params.email) return;

    await sendReminderEmailNow({
      email: params.email,
      itemName: params.itemName,
      itemType: params.itemType,
      date: params.date,
      time: params.time,
      offsetHours: 0,
      deliveryReason: 'created',
    });
  };

  const scheduleEmailNotifications = async (params: {
    itemId: string;
    itemName: string;
    itemType: 'reminder' | 'deadline';
    date: string;
    time: string;
    email: string;
    offsets: number[];
  }) => {
    if (typeof window === 'undefined') return false;
    if (!params?.date || !params?.time || !params?.itemName) return false;
    if (!params.email) return false;
    if (!SEND_EMAIL_API_URL) return false;

    const targetDate = parseDateTimeLocal(params.date, params.time);
    let scheduled = false;

    params.offsets.forEach((offsetHours) => {
      const timerKey = `${params.itemId}-${offsetHours}h`;
      if (emailTimersRef.current[timerKey]) {
        scheduled = true;
        return;
      }

      const sendAt = targetDate.getTime() - offsetHours * 60 * 60 * 1000;
      const timeUntil = sendAt - Date.now();
      if (timeUntil <= 0) {
        return;
      }

      const timerId = window.setTimeout(() => {
        void sendReminderEmailNow({
          email: params.email,
          itemName: params.itemName,
          itemType: params.itemType,
          date: params.date,
          time: params.time,
          offsetHours,
          deliveryReason: 'scheduled',
        });
      }, timeUntil);

      emailTimersRef.current[timerKey] = timerId;
      scheduled = true;
    });

    return scheduled;
  };

  const scheduleEmailForReminder = async (reminder: Reminder, email: string) => {
    return scheduleEmailNotifications({
      itemId: reminder.id,
      itemName: reminder.eventName,
      itemType: 'reminder',
      date: reminder.date,
      time: reminder.time,
      email,
      offsets: [6, 2, 0],
    });
  };

  const scheduleEmailForDeadline = async (deadline: Deadline, email: string) => {
    return scheduleEmailNotifications({
      itemId: deadline.id,
      itemName: deadline.title,
      itemType: 'deadline',
      date: deadline.date,
      time: deadline.time,
      email,
      offsets: [6, 2],
    });
  };

  const upsertReminder = (nextReminder: Reminder) => {
    setReminders((prev) => {
      const existing = prev.filter((r) => r.eventName === nextReminder.eventName);
      existing.forEach((r) => {
        cancelScheduledNotification(r.id);
        cancelScheduledEmail(r.id);
      });
      const without = prev.filter((r) => r.eventName !== nextReminder.eventName);
      return [...without, nextReminder];
    });
  };

  const handleRemoveReminder = (reminderId: string) => {
    cancelScheduledNotification(reminderId);
    cancelScheduledEmail(reminderId);
    setReminders((prev) => prev.filter((r) => r.id !== reminderId));
  };

  const scheduleLoadedReminder = useEffectEvent((reminder: Reminder, notificationsSupported: boolean, email: string) => {
    void scheduleEmailForReminder(reminder, email);
    if (notificationsSupported && Notification.permission !== 'denied') {
      void scheduleNotificationForReminder(reminder);
    }
  });

  const scheduleLoadedDeadline = useEffectEvent((deadline: Deadline, email: string) => {
    if (deadline.completed) return;
    void scheduleEmailForDeadline(deadline, email);
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'denied') {
      void scheduleNotificationForDeadline(deadline);
    }
  });

  // Best-effort: schedule reminders for reminders that were loaded from Supabase.
  useEffect(() => {
    if (!isDataLoaded) return;
    if (typeof window === 'undefined') return;
    const notificationsSupported = 'Notification' in window;

    const seenEventNames = new Set<string>();
    reminders.forEach((r) => {
      if (seenEventNames.has(r.eventName)) return; // dedupe same eventName
      seenEventNames.add(r.eventName);

      scheduleLoadedReminder(r, notificationsSupported, user?.email || '');
    });
  }, [isDataLoaded, reminders, user?.email]);

  useEffect(() => {
    if (!isDataLoaded) return;
    if (typeof window === 'undefined') return;

    deadlines.forEach((deadline) => {
      scheduleLoadedDeadline(deadline, user?.email || '');
    });
  }, [deadlines, isDataLoaded, user?.email]);

  const handleCheckIn = async (eventId: string) => {
    const event = events.find((e) => e.id === eventId);
    if (event) {
      void fetch('/api/store-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_in',
          eventName: event.name,
          eventType: event.type,
        }),
      }).catch(() => undefined);
    }
    setEvents(events.map((e) => (e.id === eventId ? { ...e, checkedIn: true } : e)));
  };

  const removeReminderByEventName = (eventName: string) => {
    setReminders((prev) => {
      const matches = prev.filter((reminder) => reminder.eventName === eventName);
      matches.forEach((reminder) => {
        cancelScheduledNotification(reminder.id);
        cancelScheduledEmail(reminder.id);
      });
      return prev.filter((reminder) => reminder.eventName !== eventName);
    });
  };

  const openClubJoinConfirmation = (clubId: string) => {
    setPendingClubJoinId(clubId);
    setClubJoinConfirmation('');
  };

  const closeClubJoinConfirmation = () => {
    setPendingClubJoinId(null);
    setClubJoinConfirmation('');
  };

  const handleJoinClub = async (clubId: string) => {
    if (!user) return;
    const club = clubs.find((item) => item.id === clubId);
    if (!club) return;

    if (club.joined) {
      setClubs((prev) => prev.map((item) => item.id === clubId ? { ...item, joined: false } : item));
      return;
    }

    if (clubJoinConfirmation.trim().toLowerCase() !== 'confirm') {
      return;
    }

    setClubs((prev) => prev.map((item) => item.id === clubId ? { ...item, joined: true } : item));
    closeClubJoinConfirmation();

    await fetch('/api/store-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, clubName: club.name, action: 'join_club' }),
    });
  };

  const handleToggleDeadlineCompletion = (deadlineId: string) => {
    const targetDeadline = deadlines.find((deadline) => deadline.id === deadlineId);
    if (!targetDeadline) return;

    const nextCompleted = !targetDeadline.completed;
    if (nextCompleted) {
      cancelScheduledNotification(deadlineId);
      cancelScheduledEmail(deadlineId);
    } else {
      void scheduleNotificationForDeadline({ ...targetDeadline, completed: false });
      void scheduleEmailForDeadline({ ...targetDeadline, completed: false }, user?.email || '');
    }

    setDeadlines((prev) =>
      prev.map((deadline) =>
        deadline.id === deadlineId ? { ...deadline, completed: nextCompleted } : deadline
      )
    );
  };

  const addDeadline = () => {
    const title = prompt('Deadline title:');
    const date = prompt('Date (YYYY-MM-DD):');
    const time = prompt('Time (e.g. 11:59 PM):');
    if (title && date && time) {
      const parsedDate = new Date(`${date}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (Number.isNaN(parsedDate.getTime())) {
        alert('Please enter a valid deadline date in YYYY-MM-DD format.');
        return;
      }

      if (parsedDate < today) {
        alert('Please choose today or a future date for the deadline.');
        return;
      }

      const deadline = { id: Date.now().toString(), title, date, time, type: 'custom' };
      setDeadlines([...deadlines, deadline]);
      void scheduleNotificationForDeadline(deadline);
      void sendImmediateCreationEmail({
        itemName: title,
        itemType: 'deadline',
        date,
        time,
        email: user?.email || '',
      });
      void scheduleEmailForDeadline(deadline, user?.email || '');
    }
  };

  useEffect(() => {
    const loadDashboardInsights = async () => {
      if (!user || !isDataLoaded) return;

      try {
        const response = await fetch('/api/dashboard-insights');
        if (!response.ok) return;
        const data = (await response.json()) as DashboardInsightsResponse;
        setLearnedInsights(data.insights ?? []);
      } catch {
        setLearnedInsights([]);
      }
    };

    void loadDashboardInsights();
  }, [user, isDataLoaded, clubs, events, reminders, deadlines, messages.length]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-xl flex items-center justify-center text-2xl">🎓</div>
              <div>
                <h1 className="text-2xl font-bold text-white">Smart Campus AI</h1>
                <p className="text-sm text-purple-200">J.C. Bose University</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-white/80 text-sm">
                <div className="text-white/60 mb-1">{user.email}</div>
                <div>{attendedEventsCount} Events • {joinedClubsCount} Clubs</div>
              </div>
              <button 
                onClick={() => signOut()}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg transition-all"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex gap-2 bg-black/20 backdrop-blur-md rounded-2xl p-2 border border-white/10 overflow-x-auto">
          {['chat', 'events', 'clubs', 'reminders', 'deadlines', 'navigation', 'dashboard'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-shrink-0 py-3 px-6 rounded-xl font-medium transition-all ${activeTab === tab ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
              {tab === 'chat' && '💬 Chat'}
              {tab === 'events' && '🎉 Events'}
              {tab === 'clubs' && '🎯 Clubs'}
              {tab === 'reminders' && '🔔 Reminders'}
              {tab === 'deadlines' && '📅 Deadlines'}
              {tab === 'navigation' && '🗺️ Navigate'}
              {tab === 'dashboard' && '📊 Dashboard'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-8">
        {activeTab === 'chat' && (
          <div className="space-y-4">
            <div className="flex gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
              <button
                onClick={() => setChatMode('assistant')}
                className={`rounded-xl px-5 py-3 text-sm font-medium transition ${chatMode === 'assistant' ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
              >
                AI Assistant
              </button>
              <button
                onClick={() => setChatMode('campus')}
                className={`rounded-xl px-5 py-3 text-sm font-medium transition ${chatMode === 'campus' ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
              >
                Campus Chat
              </button>
            </div>

            {chatMode === 'assistant' ? (
              <div className="flex flex-col" style={{ height: '70vh' }}>
                <div className="flex-1 bg-black/20 backdrop-blur-md rounded-t-2xl border border-white/10 border-b-0 overflow-y-auto p-6 space-y-4">
                  {messages.map((msg, idx) => (
                    <div key={idx}>
                      <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${msg.role === 'user' ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white' : 'bg-white/10 text-white backdrop-blur-sm'}`}>
                          {msg.imagePreviewUrl && (
                            <Image
                              src={msg.imagePreviewUrl}
                              alt="Uploaded context"
                              width={640}
                              height={360}
                              unoptimized
                              className="mb-3 max-h-64 w-full rounded-xl object-cover"
                            />
                          )}
                          {renderMessageContent(msg.content)}
                          {msg.memoriesUsed && msg.memoriesUsed > 0 && (<p className="text-xs mt-2 opacity-70">💭 {msg.memoriesUsed} memories</p>)}
                        </div>
                      </div>
                      
                      {msg.action && pendingAction && (
                        <div className="flex justify-start mt-2">
                          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl px-4 py-3 flex gap-3">
                            <button onClick={confirmAction} className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600">
                              ✓ Confirm
                            </button>
                            <button onClick={cancelAction} className="px-4 py-2 bg-red-500/80 text-white rounded-lg font-medium hover:bg-red-600">
                              ✗ Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white/10 rounded-2xl px-5 py-3">
                        <div className="flex gap-2">
                          {[0, 150, 300].map(delay => (
                            <div key={delay} className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }}></div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-4 bg-black/30 backdrop-blur-md rounded-b-2xl border border-white/10 border-t-0">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  {uploadedImage && (
                    <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                      <Image src={uploadedImage.dataUrl} alt={uploadedImage.name} width={56} height={56} unoptimized className="h-14 w-14 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm text-white">{uploadedImage.name}</div>
                        <div className="text-xs text-white/60">Image will be sent with your next message.</div>
                      </div>
                      <button onClick={() => setUploadedImage(null)} className="rounded-lg bg-red-500/20 px-3 py-2 text-xs text-red-100">
                        Remove
                      </button>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={triggerImagePicker}
                      disabled={loading}
                      className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white hover:bg-white/15 disabled:opacity-50"
                    >
                      Image
                    </button>
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="Try: 'Explain binary search', 'Help me research AI ethics', or 'Set reminder for AI Workshop'" className="flex-1 px-5 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500" disabled={loading} />
                    <button onClick={handleSend} disabled={loading || (!input.trim() && !uploadedImage)} className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl font-medium disabled:opacity-50">Send</button>
                  </div>
                </div>
              </div>
            ) : (
              <CampusChatPanel userId={user.id} userEmail={user.email || ''} />
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Campus Events</h2>
              <div className="text-sm text-purple-200">🔥 23 students attending today</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {events.map((event) => (
                <div key={event.id} className="bg-black/30 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:border-purple-500/50 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xl font-bold text-white">{event.name}</h3>
                    <span className="px-3 py-1 bg-purple-500/30 text-purple-200 rounded-full text-xs">{event.type}</span>
                  </div>
                  <div className="space-y-2 text-sm text-white/70 mb-4">
                    <div>📅 {event.date} at {event.time}</div>
                    <div>📍 {event.location}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleRSVP(event.id)} className={`flex-1 py-2 rounded-lg font-medium ${event.attending ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>{event.attending ? '✓ RSVPed' : 'RSVP'}</button>
                    {event.attending && !event.checkedIn && (<button onClick={() => handleCheckIn(event.id)} className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg">Check In</button>)}
                    {event.checkedIn && (<div className="flex-1 py-2 bg-yellow-500/30 text-yellow-200 rounded-lg text-center">✓ Checked In</div>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'clubs' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-6">Student Clubs</h2>
            <div className="grid grid-cols-2 gap-4">
              {clubs.map((club) => (
                <div key={club.id} className="bg-black/30 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:border-cyan-500/50 transition-all">
                  <h3 className="text-xl font-bold text-white mb-2">{club.name}</h3>
                  <p className="text-white/60 text-sm mb-4">{club.description}</p>
                  <button onClick={() => club.joined ? void handleJoinClub(club.id) : openClubJoinConfirmation(club.id)} className={`w-full py-2 rounded-lg font-medium ${club.joined ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'}`}>{club.joined ? '✓ Joined' : 'Join Club'}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'reminders' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-6">My Reminders</h2>
            {reminders.length === 0 ? (
              <div className="bg-black/30 backdrop-blur-md rounded-2xl p-12 border border-white/10 text-center text-white/60">
                <div className="text-6xl mb-4">🔔</div>
                <p>No reminders yet</p>
                <p className="text-sm mt-2">{'Try saying "Set reminder for AI Workshop"'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reminders.map((reminder) => (
                  <div key={reminder.id} className="bg-black/30 backdrop-blur-md rounded-xl p-4 border border-white/10 flex justify-between items-center">
                    <div>
                      <h3 className="text-white font-medium">🔔 {reminder.eventName}</h3>
                      <p className="text-white/60 text-sm">{reminder.date} at {reminder.time}</p>
                    </div>
                        <button onClick={() => handleRemoveReminder(reminder.id)} className="px-4 py-2 bg-red-500/20 text-red-200 rounded-lg">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'deadlines' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">My Deadlines</h2>
              <button onClick={addDeadline} className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg">+ Add</button>
            </div>
            <div className="space-y-3">
              {deadlines.map((deadline) => (
                <div key={deadline.id} className="bg-black/30 backdrop-blur-md rounded-xl p-4 border border-white/10 flex justify-between items-center">
                  <div>
                    <h3 className="text-white font-medium">{deadline.title}</h3>
                    <p className="text-white/60 text-sm">Due: {deadline.date} at {deadline.time}</p>
                  </div>
                  <button onClick={() => handleToggleDeadlineCompletion(deadline.id)} className={`px-4 py-2 rounded-lg ${deadline.completed ? 'bg-green-500' : 'bg-white/10'} text-white`}>{deadline.completed ? '✓ Done' : 'Mark Done'}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'navigation' && (
          <div className="bg-black/30 backdrop-blur-md rounded-2xl p-8 border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-6">Campus Navigation</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">📍 Where are you now?</h3>
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(CAMPUS_LOCATIONS).map(([key, loc]) => (
                  <button 
                    key={`current-${key}`}
                    onClick={() => {
                      setUserLocation(loc);
                      setCurrentLocationName(key);
                    }}
                    className={`py-3 rounded-lg font-medium transition-all text-sm ${
                      currentLocationName === key
                        ? 'bg-blue-500 text-white shadow-lg' 
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {currentLocationName === key && '📍 '}{key}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">🎯 Where do you want to go?</h3>
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(CAMPUS_LOCATIONS).map(([key, loc]) => (
                  <button 
                    key={`dest-${key}`}
                    onClick={() => setSelectedDestination(loc)}
                    className={`py-3 rounded-lg font-medium transition-all text-sm ${
                      selectedDestination?.name === loc.name 
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg' 
                        : 'bg-white/10 text-white hover:bg-white/20'
                    } ${currentLocationName === key ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={currentLocationName === key}
                  >
                    {selectedDestination?.name === loc.name && '🎯 '}{key}
                  </button>
                ))}
              </div>
              {currentLocationName && (
                <p className="text-sm text-white/50 mt-2">
                  💡 You cannot select your current location as destination
                </p>
              )}
            </div>
            
            {selectedDestination ? (
              <div className="space-y-4">
                <div className="bg-white/5 rounded-xl overflow-hidden" style={{ height: '500px' }}>
                  <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={{
                        lat: (userLocation.lat + selectedDestination.lat) / 2,
                        lng: (userLocation.lng + selectedDestination.lng) / 2
                      }}
                      zoom={16}
                    >
                      <Marker 
                        position={userLocation} 
                        label="📍" 
                        icon={{
                          url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                        }}
                        title={`You are here: ${currentLocationName}`}
                      />
                      <Marker 
                        position={selectedDestination} 
                        label="🎯" 
                        icon={{
                          url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
                        }}
                        title={`Destination: ${selectedDestination.name}`}
                      />
                      <Polyline
                        path={[
                          { lat: userLocation.lat, lng: userLocation.lng },
                          { lat: selectedDestination.lat, lng: selectedDestination.lng }
                        ]}
                        options={{
                          strokeColor: '#00D9FF',
                          strokeOpacity: 0.8,
                          strokeWeight: 4,
                          geodesic: true,
                        }}
                      />
                    </GoogleMap>
                  </LoadScript>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <h3 className="text-xl font-bold text-white mb-3">📍 Navigation Info</h3>
                  <div className="space-y-2 text-white/80">
                    <p className="flex items-center gap-2">
                      <span className="text-2xl">🔵</span>
                      <span><strong>From:</strong> {currentLocationName}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-2xl">🔴</span>
                      <span><strong>To:</strong> {selectedDestination.name}</span>
                    </p>
                    <div className="pt-3 mt-3 border-t border-white/20">
                      <p className="text-sm text-white/60">
                        💡 Walk from the <strong className="text-blue-300">blue marker</strong> towards the <strong className="text-red-300">red marker</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 rounded-xl p-12 text-center text-white/60">
                <div className="text-6xl mb-4">🗺️</div>
                <p className="text-lg font-semibold">Select your current location and destination above</p>
                <p className="text-sm mt-2">{'Or ask me in chat: "Navigate to Library"'}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">My Dashboard</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 rounded-2xl p-6 border border-cyan-500/30">
                <div className="text-4xl mb-2">🎯</div>
                <div className="text-3xl font-bold text-white">{attendedEventsCount}</div>
                <div className="text-cyan-200 text-sm">Events Attended</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-2xl p-6 border border-purple-500/30">
                <div className="text-4xl mb-2">👥</div>
                <div className="text-3xl font-bold text-white">{joinedClubsCount}</div>
                <div className="text-purple-200 text-sm">Clubs Joined</div>
              </div>
              <div className="bg-gradient-to-br from-pink-500/20 to-pink-500/5 rounded-2xl p-6 border border-pink-500/30">
                <div className="text-4xl mb-2">💭</div>
                <div className="text-3xl font-bold text-white">{aiMemoriesCount}</div>
                <div className="text-pink-200 text-sm">AI Memories</div>
              </div>
            </div>
            <div className="bg-black/30 backdrop-blur-md rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">What AI Learned About You</h3>
              <div className="space-y-3">
                {visibleInsights.length === 0 ? (
                  <div className="text-white/60">Start joining clubs, checking in to events, setting reminders, or chatting with the AI to build your activity profile.</div>
                ) : (
                  visibleInsights.map((insight, index) => (
                    <div key={`${insight}-${index}`} className="flex items-center gap-3 text-white/80">
                      <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                      <span>{insight}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {pendingClubJoinId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-6 text-white shadow-2xl">
            <h3 className="text-xl font-bold">Confirm club join</h3>
            <p className="mt-3 text-sm text-white/70">
              Type <span className="font-semibold text-cyan-300">confirm</span> to mark that you have joined{' '}
              <span className="font-semibold text-white">{clubs.find((club) => club.id === pendingClubJoinId)?.name}</span>.
            </p>
            <input
              type="text"
              value={clubJoinConfirmation}
              onChange={(e) => setClubJoinConfirmation(e.target.value)}
              placeholder='Type "confirm"'
              className="mt-4 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => void handleJoinClub(pendingClubJoinId)}
                disabled={clubJoinConfirmation.trim().toLowerCase() !== 'confirm'}
                className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-3 font-medium text-white disabled:opacity-40"
              >
                Confirm Join
              </button>
              <button
                onClick={closeClubJoinConfirmation}
                className="flex-1 rounded-xl bg-white/10 px-4 py-3 font-medium text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
