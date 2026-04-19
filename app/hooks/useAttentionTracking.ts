'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ATTENTION_STORAGE_KEY } from '@/lib/smart-campus/constants';
import { createInitialAttentionStats } from '@/lib/smart-campus/utils';
import type { AppTabId, AttentionStats } from '@/lib/smart-campus/types';

export function useAttentionTracking(activeTab: AppTabId) {
  const [attentionStats, setAttentionStats] = useState<AttentionStats>(() => createInitialAttentionStats());
  const attentionTabRef = useRef<AppTabId>('chat');
  const attentionFocusedRef = useRef(true);
  const attentionTimestampRef = useRef<number | null>(null);
  const hasTrackedInitialTabRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const rawStats = window.localStorage.getItem(ATTENTION_STORAGE_KEY);
      if (!rawStats) return;

      const parsedStats = JSON.parse(rawStats) as Partial<AttentionStats>;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAttentionStats({
        ...createInitialAttentionStats(),
        ...parsedStats,
      });
    } catch {
      setAttentionStats(createInitialAttentionStats());
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ATTENTION_STORAGE_KEY, JSON.stringify(attentionStats));
  }, [attentionStats]);

  const flushAttention = useEffectEvent((now = Date.now()) => {
    if (attentionTimestampRef.current === null) {
      attentionTimestampRef.current = now;
      return;
    }

    const elapsedMs = now - attentionTimestampRef.current;
    if (elapsedMs <= 0) return;

    const currentTrackedTab = attentionTabRef.current;
    const bucket = attentionFocusedRef.current ? 'focusedMs' : 'backgroundMs';

    setAttentionStats((prev) => ({
      ...prev,
      [currentTrackedTab]: {
        ...prev[currentTrackedTab],
        [bucket]: prev[currentTrackedTab][bucket] + elapsedMs,
      },
    }));

    attentionTimestampRef.current = now;
  });

  useEffect(() => {
    const initialNow = Date.now();
    attentionTabRef.current = 'chat';
    attentionFocusedRef.current = typeof document === 'undefined' ? true : !document.hidden && document.hasFocus();
    attentionTimestampRef.current = initialNow;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttentionStats((prev) => ({
      ...prev,
      chat: {
        ...prev.chat,
        visits: prev.chat.visits + 1,
      },
    }));

    const handleVisibilityOrFocusChange = () => {
      const now = Date.now();
      flushAttention(now);
      attentionFocusedRef.current = !document.hidden && document.hasFocus();
      attentionTimestampRef.current = now;
    };

    const heartbeatId = window.setInterval(() => {
      flushAttention(Date.now());
    }, 5000);

    document.addEventListener('visibilitychange', handleVisibilityOrFocusChange);
    window.addEventListener('focus', handleVisibilityOrFocusChange);
    window.addEventListener('blur', handleVisibilityOrFocusChange);

    return () => {
      window.clearInterval(heartbeatId);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocusChange);
      window.removeEventListener('focus', handleVisibilityOrFocusChange);
      window.removeEventListener('blur', handleVisibilityOrFocusChange);
      flushAttention(Date.now());
    };
  }, []);

  useEffect(() => {
    if (!hasTrackedInitialTabRef.current) {
      hasTrackedInitialTabRef.current = true;
      return;
    }

    const now = Date.now();
    flushAttention(now);
    attentionTabRef.current = activeTab;
    attentionTimestampRef.current = now;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttentionStats((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        visits: prev[activeTab].visits + 1,
      },
    }));
  }, [activeTab]);

  return { attentionStats };
}
