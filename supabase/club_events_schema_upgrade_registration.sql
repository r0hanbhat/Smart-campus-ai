-- ============================================================
-- MIGRATION: Add registration_starts and event_end_date to events
-- Run in Supabase SQL Editor → only adds columns if not present
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_starts TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS event_end_date       DATE;

-- Index for fast filtering of open registration events
CREATE INDEX IF NOT EXISTS events_reg_starts_idx
  ON public.events (registration_starts)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS events_end_date_idx
  ON public.events (event_end_date)
  WHERE is_published = true;
