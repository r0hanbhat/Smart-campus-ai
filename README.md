# Smart Campus AI

Smart Campus AI is a Next.js 16 student hub for J.C. Bose University. It combines:

- AI-assisted study and campus support
- events, clubs, reminders, and deadline tracking
- a Supabase-backed social chat system
- focus and attention analytics inside the app

## Stack

- Next.js 16.2
- React 19.2
- Supabase Auth, Postgres, and Realtime
- Groq for assistant responses
- Google Maps for campus navigation
- Nodemailer for reminder and deadline email delivery

## Project Structure

- `app/page.tsx`: main authenticated dashboard shell
- `app/components/CampusChatPanel.tsx`: realtime social and messaging UI
- `app/api/chat/route.ts`: AI assistant endpoint
- `app/api/dashboard-insights/route.ts`: derived student insight endpoint
- `app/api/send-email/route.ts`: canonical reminder/deadline email endpoint
- `app/api/reminder-jobs/`: sync and processor routes for durable scheduled reminder emails
- `app/hooks/`: extracted client hooks for attention, state sync, and scheduling
- `lib/server/`: server-side helpers for chat, Supabase access, insights, and email rendering
- `lib/smart-campus/`: shared campus constants, sample data, types, and utilities
- `supabase/chat_schema.sql`: chat/social schema and RLS policies
- `supabase/user_state_schema.sql`: app state storage schema
- `supabase/reminder_jobs_schema.sql`: durable reminder/deadline email job queue
- `functions/`: legacy Firebase compatibility path, no longer the primary email backend

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` with the required values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GROQ_API_KEY=
GMAIL_USER=
GMAIL_PASS=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
REMINDER_JOB_SECRET=
```

3. Apply the SQL files in Supabase:

- `supabase/chat_schema.sql`
- `supabase/user_state_schema.sql`
- `supabase/reminder_jobs_schema.sql`
- `supabase/role_panels_schema.sql`

4. Start the app:

```bash
npm run dev
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run test
```

## Architecture Notes

- The main app uses Supabase `user_state` for per-user dashboard state persistence.
- Social chat data lives in dedicated relational tables with RLS in `supabase/chat_schema.sql`.
- Next.js route handlers are the primary backend-for-frontend layer.
- Reminder emails now standardize on `app/api/send-email/route.ts`, and scheduled delivery is synced into `reminder_jobs` for server-side processing.
- Browser notifications are still best-effort client features, but scheduled reminder/deadline emails no longer depend on an open browser tab.
- The root Next.js app no longer depends on Firebase packages; `functions/` remains a separate legacy fallback project only.

## Current Priorities

- Continue breaking large client surfaces like `app/page.tsx` and `CampusChatPanel.tsx` into smaller components.
- Decide whether the legacy `functions/` Firebase project should be retained, archived, or removed entirely.
