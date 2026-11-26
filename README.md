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

- `app/page.jsx`: main authenticated dashboard shell
- `app/components/CampusChatPanel.jsx`: realtime social and messaging UI
- `app/api/chat/route.js`: AI assistant endpoint
- `app/api/dashboard-insights/route.js`: derived student insight endpoint
- `app/api/send-email/route.js`: canonical reminder/deadline email endpoint
- `app/hostel/`: warden and hosteller portals plus admin block and assignment management
- `app/components/FacilityBookingPanel.jsx`: student-facing campus and hostel facility reservations
- `app/components/FacilityManagementPanel.jsx`: admin-managed block-specific laundry weeks, monthly reading-room slots, and campus recurring availability
- `app/api/reminder-jobs/`: sync and processor routes for durable scheduled reminder emails
- `app/hooks/`: extracted client hooks for attention, state sync, and scheduling
- `lib/server/`: server-side helpers for chat, Supabase access, insights, and email rendering
- `lib/smart-campus/`: shared campus constants, sample data, types, and utilities
- `supabase/chat_schema.sql`: chat/social schema and RLS policies
- `supabase/user_state_schema.sql`: app state storage schema
- `supabase/reminder_jobs_schema.sql`: durable reminder/deadline email job queue
- `supabase/hostel_schema.sql`: hostel blocks, warden accounts/sessions, resident assignments, maintenance timelines, shared mess menus, announcements, meal ratings, and outpass approvals
- `supabase/hostel_registration_schema.sql`: verified hosteller access requests and staff approval/assignment
- `supabase/facility_bookings_schema.sql`: recurring schedules and capacity-safe bookings for hostel laundry/reading rooms and campus library/cafeteria seats
- `supabase/facility_booking_windows_upgrade.sql`: block-specific laundry publishing, monthly reading-room publishing, 200-seat availability, and facility-specific reservation windows
- `supabase/event_checkin_schema.sql`: per-registration QR tickets and one-time event attendance check-ins
- `supabase/lost_and_found_schema.sql`: student-only lost/found posts and private claim/finder responses
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
- `supabase/attendance_schema.sql` (provides student roll numbers)
- `supabase/club_events_schema.sql`
- `supabase/club_events_schema_upgrade_registration.sql` (adds registration windows and event end dates)
- `supabase/event_checkin_schema.sql` (after the club event schema)
- `supabase/hostel_schema.sql`
- `supabase/hostel_registration_schema.sql` (after `supabase/hostel_schema.sql`)
- `supabase/facility_bookings_schema.sql` (after `supabase/hostel_schema.sql`)
- `supabase/facility_booking_windows_upgrade.sql` (after `supabase/facility_bookings_schema.sql`)
- `supabase/lost_and_found_schema.sql`

4. Start the app:

```bash
npm run dev
```

After applying the hostel schemas, enable email confirmations in Supabase Auth. Sign in with the admin account and open **Manage Hostel** to create blocks, provision wardens, assign existing student accounts, and review hosteller access requests. New hostellers register with their campus email and roll number, verify their email, then sign in and request hostel access. Admins or wardens assign the block and room before access is enabled; warden assignments remain limited to their assigned blocks. Warden passcodes are stored as bcrypt hashes.

Club portal sessions are signed and expire after eight hours. Existing unsigned club sessions must sign in again after this update.

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
- The hostel portal uses existing Supabase student accounts for hostellers and hashed standalone warden credentials with expiring, database-backed sessions. Hostel APIs restrict each warden to assigned blocks and each hosteller to their own room.
- Hostel account signup uses Supabase email confirmation. Verified students can request hostel access; staff review the request and assign a block and room before hosteller services become available. Apply `supabase/hostel_registration_schema.sql` after `supabase/hostel_schema.sql`.
- Hostel maintenance requests are stored separately from general student issues. Hostellers can create and track their own requests; wardens can view and post status updates only for requests in their assigned blocks. Apply `supabase/hostel_schema.sql` to create the maintenance tables and RPC functions.
- The hostel mess menu is a shared weekly schedule managed by hostel admins. Hostellers can rate each meal once per date (and update their rating); the portal and admin view expose aggregates only. Menu-change announcements appear in the hostel portal without sending email.
- Hostellers can submit and track outpass requests; wardens can review requests only for assigned blocks, and hostel admins can review across blocks. Requesters see only their own request and decision timeline.
- Shared facility bookings cover hostel laundry and reading rooms plus campus library and cafeteria seats. Admins publish laundry slots for one Monday–Sunday week and select one or more hostel blocks (or all blocks); hostellers see only their assigned block, and bookings for that week open on the preceding Monday. Reading-room availability is published for a whole month, shared by all blocks, with 200 seats per slot. Hostellers choose a date to see vacant seats and can book one seat per slot while more than 30 minutes remain, including during an in-progress slot. Campus facilities remain recurring and available for the next 14 days; students can cancel before a reservation starts. Hostel resources are restricted to assigned residents.
- Students can display a private, per-registration QR ticket and view their event registration/check-in history. Club coordinators and admins can scan tickets on the event date; each registration can only be checked in once.
- AI Assistant answers grounded in campus knowledge show numbered citations and expandable excerpts from the retrieved source chunks.
- Campus Lost & Found lets students post text-only lost or found item details. Owners can privately claim found items, while students who find a lost item can privately respond; the post owner can mark an item recovered or returned. Re-run `supabase/lost_and_found_schema.sql` in Supabase to add lost-item support; personal contact details are not part of public posts.
- Reminder emails now standardize on `app/api/send-email/route.js`, and scheduled delivery is synced into `reminder_jobs` for server-side processing.
- Browser notifications are still best-effort client features, but scheduled reminder/deadline emails no longer depend on an open browser tab.
- Scheduled reminder email delivery still requires a background trigger.
- Free option: use the GitHub Actions workflow in `.github/workflows/process-reminder-jobs.yml`. Add repository secrets `REMINDER_PROCESS_URL` and `CRON_SECRET`, then the workflow will call your deployed `/api/reminder-jobs/process` route every 5 minutes.
- Vercel option: configure a Cron Job to call `/api/reminder-jobs/process` and set `CRON_SECRET` so Vercel sends the matching `Authorization: Bearer ...` header automatically.
- The root Next.js app no longer depends on Firebase packages; `functions/` remains a separate legacy fallback project only.

## Current Priorities

- Continue breaking large client surfaces like `app/page.jsx` and `app/components/CampusChatPanel.jsx` into smaller components.
- Decide whether the legacy `functions/` Firebase project should be retained, archived, or removed entirely.
