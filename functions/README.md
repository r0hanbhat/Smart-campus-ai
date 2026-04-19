# Firebase Functions Status

This folder is now considered a legacy compatibility path.

The Smart Campus web app sends reminder and deadline emails through the Next.js route handler at `app/api/send-email/route.ts`, which is the canonical backend path going forward.

Keep this Firebase project only if you still need an older deployment target. New email logic, validation, and tests should be added in the main Next.js app instead of here.
