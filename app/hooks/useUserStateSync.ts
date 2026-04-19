'use client';

import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSampleClubs, getSampleEvents } from '@/lib/smart-campus/sample-data';
import { toPersistedMessages } from '@/lib/smart-campus/utils';
import type {
  Deadline,
  Message,
  Reminder,
  UserProfileSummary,
} from '@/lib/smart-campus/types';

type UseUserStateSyncParams = {
  user: User | null;
  authLoading: boolean;
  supabase: SupabaseClient;
};

export function useUserStateSync({ user, authLoading, supabase }: UseUserStateSyncParams) {
  const [events, setEvents] = useState(getSampleEvents());
  const [clubs, setClubs] = useState(getSampleClubs());
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfileSummary | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const lastSavedSnapshotRef = useRef('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      const fallbackUsername = `${user.email?.split('@')[0] || 'student'}-${user.id.slice(0, 4)}`;
      setUserProfile({
        user_id: user.id,
        username: fallbackUsername,
        display_name: typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()
          ? user.user_metadata.name.trim()
          : user.email?.split('@')[0] || fallbackUsername,
        full_name: typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()
          ? user.user_metadata.name.trim()
          : null,
        age: typeof user.user_metadata?.age === 'number'
          ? user.user_metadata.age
          : typeof user.user_metadata?.age === 'string'
            ? Number.parseInt(user.user_metadata.age, 10) || null
            : null,
        email: user.email || null,
        is_online: true,
        last_seen: new Date().toISOString(),
      });

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to load user profile:', error.message);
        return;
      }

      if (data) {
        setUserProfile(data as UserProfileSummary);
      }
    };

    void fetchProfile();
  }, [supabase, user]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      setDataLoadError(null);

      try {
        const { data, error } = await supabase
          .from('user_state')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          if (error.code === 'PGRST116') {
            setEvents(getSampleEvents());
            setClubs(getSampleClubs());
            setDeadlines([]);
            setReminders([]);
            setMessages([{
              role: 'assistant',
              content: `Hi ${user.email}! I'm your Smart Campus AI Assistant. I can help with campus tasks, reminders, deadlines, research, and study questions.`,
            }]);
            setIsDataLoaded(true);
            return;
          }

          setDataLoadError(error.message || 'Failed to load your campus data from Supabase.');
          setIsDataLoaded(false);
          return;
        }

        if (data) {
          setEvents(data.events || []);
          setClubs(data.clubs || []);
          setReminders(data.reminders || []);
          setDeadlines((data.deadlines || []).map((deadline: Deadline) => ({
            ...deadline,
            time: deadline.time || '11:59 PM',
          })));
          setMessages((data.messages || [{
            role: 'assistant',
            content: `Welcome back ${user.email}! I'm ready to help.`,
          }]) as Message[]);
          setIsDataLoaded(true);
          return;
        }

        setEvents(getSampleEvents());
        setClubs(getSampleClubs());
        setDeadlines([]);
        setReminders([]);
        setMessages([{
          role: 'assistant',
          content: `Hi ${user.email}! I'm your Smart Campus AI Assistant. I can help with campus tasks, reminders, deadlines, research, and study questions.`,
        }]);
        setIsDataLoaded(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load your campus data from Supabase.';
        setDataLoadError(message);
        setIsDataLoaded(false);
      }
    };

    if (!authLoading && user) {
      void fetchUserData();
    }
  }, [user, authLoading, supabase]);

  useEffect(() => {
    const saveUserData = async () => {
      if (!user || !isDataLoaded) return;

      const profileForSave = {
        eventsAttended: events.filter((event) => event.checkedIn).length,
        clubsJoined: clubs.filter((club) => club.joined).length,
      };
      const persistedMessages = toPersistedMessages(messages);
      const snapshot = JSON.stringify({
        events,
        clubs,
        reminders,
        deadlines,
        profile: profileForSave,
        messages: persistedMessages,
      });

      if (lastSavedSnapshotRef.current === snapshot) {
        return;
      }
      lastSavedSnapshotRef.current = snapshot;

      try {
        const { error } = await supabase
          .from('user_state')
          .upsert({
            user_id: user.id,
            events,
            clubs,
            reminders,
            deadlines,
            profile: profileForSave,
            messages: persistedMessages,
          }, { onConflict: 'user_id' });

        if (error) {
          lastSavedSnapshotRef.current = '';
          console.error('SUPABASE SAVE ERROR:', error.message, error.hint);
        }
      } catch (error) {
        lastSavedSnapshotRef.current = '';
        const message = error instanceof Error ? error.message : 'Failed to save your campus data to Supabase.';
        console.error('SUPABASE SAVE ERROR:', message);
      }
    };

    const timeoutId = window.setTimeout(() => {
      void saveUserData();
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [clubs, deadlines, events, isDataLoaded, messages, reminders, supabase, user]);

  return {
    events,
    setEvents,
    clubs,
    setClubs,
    deadlines,
    setDeadlines,
    reminders,
    setReminders,
    messages,
    setMessages,
    userProfile,
    isDataLoaded,
    dataLoadError,
  };
}
