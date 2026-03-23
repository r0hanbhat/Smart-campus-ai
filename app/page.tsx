'use client';

import { useState, useEffect, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { useAuth } from './contexts/AuthContext';
import { useRouter } from 'next/navigation';

type Message = { role: string; content: string; memoriesUsed?: number; action?: any };
type Event = { id: string; name: string; type: string; date: string; time: string; location: string; attending?: boolean; checkedIn?: boolean };
type Club = { id: string; name: string; category: string; description: string; joined?: boolean };
type Deadline = { id: string; title: string; date: string; type: string; completed?: boolean };
type Reminder = { id: string; eventName: string; date: string; time: string };

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

  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [waitingForDate, setWaitingForDate] = useState<any>(null); // ADD THIS LINE
  const [events, setEvents] = useState<Event[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [userProfile, setUserProfile] = useState({ eventsAttended: 0, clubsJoined: 0 });

  const [selectedDestination, setSelectedDestination] = useState<any>(null);
  const [userLocation, setUserLocation] = useState(CAMPUS_CENTER);
  const [currentLocationName, setCurrentLocationName] = useState('Main Gate');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadSampleData();
      setMessages([{
        role: 'assistant',
        content: `Hi ${user.email}! I'm your Smart Campus AI Assistant. I can help you navigate campus, set reminders, manage deadlines, and recommend events! 🎓`,
      }]);
    }
  }, [user]);

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
    if (!input.trim() || loading || !user) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    
    try {
      const userContext = {
        events,
        clubs,
        reminders,
        deadlines,
        profile: userProfile
      };

      // Check if we're waiting for a date from the user
      let finalMessage = userMessage;
      if (waitingForDate) {
        // User is providing a date for a previous request
        finalMessage = `${waitingForDate.originalMessage} on ${userMessage}`;
        setWaitingForDate(null);
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: finalMessage, 
          userId: user.id,
          userContext
        }),
      });
      const data = await response.json();
      
      if (data.action) {
        // If action needs a date, store it and wait for user input
        if (data.action.needsDate) {
          setWaitingForDate({
            action: data.action,
            originalMessage: userMessage
          });
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: data.response,
            memoriesUsed: data.memoriesUsed
          }]);
        } else {
          setPendingAction(data.action);
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: data.response,
            memoriesUsed: data.memoriesUsed,
            action: data.action
          }]);
        }
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.response,
          memoriesUsed: data.memoriesUsed 
        }]);
      }
    } catch (error) {
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
      setDeadlines([...deadlines, {
        id: Date.now().toString(),
        title: action.title,
        date: action.date,
        type: 'custom'
      }]);
      setActiveTab('deadlines');
    } else if (action.type === 'set_reminder') {
      setReminders([...reminders, {
        id: Date.now().toString(),
        eventName: action.eventName,
        date: action.date,
        time: action.time
      }]);
      setActiveTab('reminders');
    }

    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: `✅ Done! ${action.type === 'navigate' ? 'Showing you the location on the map.' : 'I\'ve set that up for you.'}`
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
      setReminders([...reminders, { id: Date.now().toString(), eventName: event.name, date: event.date, time: event.time }]);
      
      // Schedule browser notification
      const notificationScheduled = await scheduleNotification(event.name, event.date, event.time);
      
      if (notificationScheduled) {
        alert(`✅ Reminder set for ${event.name}! You'll get a notification.`);
      } else {
        alert(`✅ Reminder set for ${event.name}!`);
      }
    } else if (event && wasAttending) {
      setReminders(reminders.filter(r => r.eventName !== event.name));
    }
  };
  const scheduleNotification = async (eventName: string, date: string, time: string) => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if (Notification.permission === 'granted') {
      // Calculate time until reminder
      const reminderDate = new Date(`${date} ${time}`);
      const now = new Date();
      const timeUntil = reminderDate.getTime() - now.getTime();

      if (timeUntil > 0) {
        // Schedule notification
        setTimeout(() => {
          new Notification('🔔 Campus Reminder', {
            body: `${eventName} is coming up soon!`,
            icon: '/icon.png', // Add your icon
            badge: '/badge.png',
            tag: eventName,
          });
        }, timeUntil);
        
        return true;
      }
    }
    return false;
  };

  const handleCheckIn = (eventId: string) => {
    setEvents(events.map(e => e.id === eventId ? { ...e, checkedIn: true } : e));
    setUserProfile(prev => ({ ...prev, eventsAttended: prev.eventsAttended + 1 }));
  };

  const handleJoinClub = async (clubId: string) => {
    if (!user) return;
    setClubs(clubs.map(c => c.id === clubId ? { ...c, joined: !c.joined } : c));
    const club = clubs.find(c => c.id === clubId);
    if (club && !club.joined) {
      setUserProfile(prev => ({ ...prev, clubsJoined: prev.clubsJoined + 1 }));
      await fetch('/api/store-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, clubName: club.name, action: 'join_club' }),
      });
    }
  };

  const addDeadline = () => {
    const title = prompt('Deadline title:');
    const date = prompt('Date (YYYY-MM-DD):');
    if (title && date) {
      setDeadlines([...deadlines, { id: Date.now().toString(), title, date, type: 'custom' }]);
    }
  };

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
                <div>{userProfile.eventsAttended} Events • {userProfile.clubsJoined} Clubs</div>
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
          <div className="flex flex-col" style={{ height: '70vh' }}>
            <div className="flex-1 bg-black/20 backdrop-blur-md rounded-t-2xl border border-white/10 border-b-0 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx}>
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${msg.role === 'user' ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white' : 'bg-white/10 text-white backdrop-blur-sm'}`}>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
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
              <div className="flex gap-3">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="Try: 'Navigate to library' or 'Set reminder for AI Workshop'" className="flex-1 px-5 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500" disabled={loading} />
                <button onClick={handleSend} disabled={loading || !input.trim()} className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl font-medium disabled:opacity-50">Send</button>
              </div>
            </div>
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
                  <button onClick={() => handleJoinClub(club.id)} className={`w-full py-2 rounded-lg font-medium ${club.joined ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'}`}>{club.joined ? '✓ Joined' : 'Join Club'}</button>
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
                <p className="text-sm mt-2">Try saying "Set reminder for AI Workshop"</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reminders.map((reminder) => (
                  <div key={reminder.id} className="bg-black/30 backdrop-blur-md rounded-xl p-4 border border-white/10 flex justify-between items-center">
                    <div>
                      <h3 className="text-white font-medium">🔔 {reminder.eventName}</h3>
                      <p className="text-white/60 text-sm">{reminder.date} at {reminder.time}</p>
                    </div>
                    <button onClick={() => setReminders(reminders.filter(r => r.id !== reminder.id))} className="px-4 py-2 bg-red-500/20 text-red-200 rounded-lg">Remove</button>
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
                    <p className="text-white/60 text-sm">Due: {deadline.date}</p>
                  </div>
                  <button onClick={() => setDeadlines(deadlines.map(d => d.id === deadline.id ? { ...d, completed: !d.completed } : d))} className={`px-4 py-2 rounded-lg ${deadline.completed ? 'bg-green-500' : 'bg-white/10'} text-white`}>{deadline.completed ? '✓ Done' : 'Mark Done'}</button>
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
                <p className="text-sm mt-2">Or ask me in chat: "Navigate to Library"</p>
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
                <div className="text-3xl font-bold text-white">{userProfile.eventsAttended}</div>
                <div className="text-cyan-200 text-sm">Events Attended</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-2xl p-6 border border-purple-500/30">
                <div className="text-4xl mb-2">👥</div>
                <div className="text-3xl font-bold text-white">{userProfile.clubsJoined}</div>
                <div className="text-purple-200 text-sm">Clubs Joined</div>
              </div>
              <div className="bg-gradient-to-br from-pink-500/20 to-pink-500/5 rounded-2xl p-6 border border-pink-500/30">
                <div className="text-4xl mb-2">💭</div>
                <div className="text-3xl font-bold text-white">127</div>
                <div className="text-pink-200 text-sm">AI Memories</div>
              </div>
            </div>
            <div className="bg-black/30 backdrop-blur-md rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">What AI Learned About You</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-white/80"><div className="w-2 h-2 bg-cyan-500 rounded-full"></div><span>You love coding and tech events</span></div>
                <div className="flex items-center gap-3 text-white/80"><div className="w-2 h-2 bg-purple-500 rounded-full"></div><span>You're interested in AI and machine learning</span></div>
                <div className="flex items-center gap-3 text-white/80"><div className="w-2 h-2 bg-pink-500 rounded-full"></div><span>You enjoy hackathons and competitive coding</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}