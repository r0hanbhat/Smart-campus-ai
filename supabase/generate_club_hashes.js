// Run with: node supabase/generate_club_hashes.js
import bcrypt from 'bcryptjs';

const clubs = [
  { name: 'Computer Science Club', loginId: 'cs_club',       password: 'Club@1234' },
  { name: 'Cultural Club',         loginId: 'cultural_club', password: 'Club@1234' },
  { name: 'Sports Club',           loginId: 'sports_club',   password: 'Club@1234' },
  { name: 'Robotics Club',         loginId: 'robotics_club', password: 'Club@1234' },
];

console.log('\n-- Paste this into supabase/seed_clubs.sql (replace existing INSERT)\n');
console.log('insert into public.clubs (club_name, login_id, password_hash, coordinator_id)');
console.log('values');

clubs.forEach((club, i) => {
  const hash = bcrypt.hashSync(club.password, 10);
  const comma = i < clubs.length - 1 ? ',' : '';
  console.log(`  ('${club.name}', '${club.loginId}', '${hash}', null)${comma}`);
});

console.log('on conflict (login_id) do update set password_hash = excluded.password_hash;');
console.log('\n-- Default password for all clubs: Club@1234');
console.log('-- Change the password values above before generating if needed.\n');
