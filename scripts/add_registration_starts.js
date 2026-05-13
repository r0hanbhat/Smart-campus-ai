// One-time migration: add registration_starts column to events table
// Run with: node --env-file=.env.local scripts/add_registration_starts.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
  // Use Supabase's SQL execution via the management API
  const sql = 'ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_starts TIMESTAMPTZ;';
  
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({}),
    }
  );

  // Fallback: direct column check by attempting an insert-select
  const { error } = await supabase
    .from('events')
    .select('registration_starts')
    .limit(1);

  if (!error) {
    console.log('✅ registration_starts column already exists!');
  } else {
    console.log('');
    console.log('⚠️  Please run this SQL in your Supabase Dashboard → SQL Editor:');
    console.log('');
    console.log('    ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_starts TIMESTAMPTZ;');
    console.log('');
  }
}

migrate().catch(console.error);
