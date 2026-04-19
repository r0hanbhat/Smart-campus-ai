'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AuthError, User } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signUp: (details: {
    name: string;
    age: number;
    email: string;
    password: string;
  }) => Promise<{ data: unknown; error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ data: unknown; error: AuthError | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const ACTIVE_TAB_IDS_KEY = 'smart-campus-active-tab-ids';
const LAST_TAB_CLOSED_AT_KEY = 'smart-campus-last-tab-closed-at';
const CURRENT_TAB_ID_KEY = 'smart-campus-current-tab-id';

function buildFallbackUsername(email: string, userId: string) {
  const base = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'student';
  return `${base}-${userId.slice(0, 4)}`;
}

function readUserMetadataString(user: User, key: string) {
  const value = user.user_metadata?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function isReloadNavigation() {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return false;

  const navigationEntries = performance.getEntriesByType('navigation');
  const navigationEntry = navigationEntries[0] as PerformanceNavigationTiming | undefined;

  if (navigationEntry) {
    return navigationEntry.type === 'reload';
  }

  return false;
}

function readActiveTabIds() {
  if (typeof window === 'undefined') return [] as string[];

  try {
    const rawValue = window.localStorage.getItem(ACTIVE_TAB_IDS_KEY);
    if (!rawValue) return [];
    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function writeActiveTabIds(tabIds: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_TAB_IDS_KEY, JSON.stringify(Array.from(new Set(tabIds))));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tabId = window.sessionStorage.getItem(CURRENT_TAB_ID_KEY) || crypto.randomUUID();
    window.sessionStorage.setItem(CURRENT_TAB_ID_KEY, tabId);

    const activeTabIds = readActiveTabIds();
    writeActiveTabIds([...activeTabIds, tabId]);

    const unregisterTab = () => {
      const remainingTabIds = readActiveTabIds().filter((id) => id !== tabId);
      writeActiveTabIds(remainingTabIds);

      if (remainingTabIds.length === 0) {
        window.localStorage.setItem(LAST_TAB_CLOSED_AT_KEY, String(Date.now()));
      }
    };

    window.addEventListener('pagehide', unregisterTab);

    return () => {
      window.removeEventListener('pagehide', unregisterTab);
      unregisterTab();
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        const lastTabClosedAt = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_TAB_CLOSED_AT_KEY) : null;
        const shouldClearSession =
          Boolean(lastTabClosedAt) &&
          !isReloadNavigation() &&
          readActiveTabIds().length <= 1;

        if (shouldClearSession) {
          window.localStorage.removeItem(LAST_TAB_CLOSED_AT_KEY);
          await supabase.auth.signOut();
          setUser(null);
          setLoading(false);
          return;
        }

        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(LAST_TAB_CLOSED_AT_KEY);
        }

        const nextUser = session?.user ?? null;
        setUser(nextUser);
        setLoading(false);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown auth session error.';
        console.error('Failed to load auth session:', message);
        setUser(null);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setLoading(false);

      if (typeof window !== 'undefined' && nextUser) {
        window.localStorage.removeItem(LAST_TAB_CLOSED_AT_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const ensureProfile = async () => {
      if (!user) return;

      const email = user.email || '';
      const fallbackUsername = buildFallbackUsername(email, user.id);
      const metadataName = readUserMetadataString(user, 'name');
      const displayName = metadataName || email.split('@')[0] || fallbackUsername;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Failed to check profile:', error.message);
          return;
        }

        if (!data) {
          const profileInsert = {
            user_id: user.id,
            username: fallbackUsername,
            display_name: displayName,
            is_online: false,
          };
          const { error: insertError } = await supabase.from('profiles').insert(profileInsert);

          if (insertError && insertError.code !== '23505') {
            console.error('Failed to create profile:', insertError.message);
          }
          return;
        }

        const currentProfile = data as Partial<{
          username: string;
          display_name: string;
        }>;
        const nextUsername = currentProfile.username?.trim() ? currentProfile.username : fallbackUsername;
        const nextDisplayName = currentProfile.display_name?.trim() ? currentProfile.display_name : displayName;
        const needsUpdate =
          currentProfile.username !== nextUsername ||
          currentProfile.display_name !== nextDisplayName;

        if (!needsUpdate) return;

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            username: nextUsername,
            display_name: nextDisplayName,
          })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Failed to update profile:', updateError.message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown profile sync error.';
        console.error('Failed to sync profile:', message);
      }
    };

    void ensureProfile();
  }, [supabase, user]);

  const signUp = async ({ name, age, email, password }: {
    name: string;
    age: number;
    email: string;
    password: string;
  }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name.trim(),
          age,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
