import type { AppTabId } from './types.ts';

export const MAX_SAVED_MESSAGES = 40;

export const CAMPUS_LOCATIONS = {
  'Main Gate': { lat: 28.367459, lng: 77.315229, name: 'Main Gate' },
  Library: { lat: 28.367287020362372, lng: 77.31642864173253, name: 'Central Library' },
  'Computer department': { lat: 28.36730265621971, lng: 77.31657893615694, name: 'Computer Science Building' },
  'Lal Chowk': { lat: 28.367669360616897, lng: 77.31714479154222, name: 'Main Auditorium' },
  'Cafeteria/Academic Branch': { lat: 28.36719261515068, lng: 77.31567225879179, name: 'Cafeteria/Academic Branch' },
  Gym: { lat: 28.368, lng: 77.3162, name: 'Sports Complex' },
  'Admin Block': { lat: 28.3676, lng: 77.315, name: 'Administration Block' },
  Auditorium: { lat: 28.367720914584893, lng: 77.31756496114842, name: 'Auditorium' },
  Mandir: { lat: 28.36654397587192, lng: 77.31807963324546, name: 'Central Mandir' },
  'New Building': { lat: 28.367553696005043, lng: 77.31829293839884, name: 'New Academic Building' },
  'Electrical department': { lat: 28.367369660765572, lng: 77.31711588160906, name: 'Electrical Department' },
  Bank: { lat: 28.366610546139377, lng: 77.31584429742577, name: 'Central Bank' },
  'CV Raman Block': { lat: 28.36654217952919, lng: 77.31725160673959, name: 'CV Raman Block' },
  'Mechanical Department': { lat: 28.366502031214903, lng: 77.31687041450068, name: 'Mechanical Department' },
  Shakutalam: { lat: 28.36679690059596, lng: 77.31675623209462, name: 'Shakutalam' },
  'Mechanical Workshop': { lat: 28.366937526794985, lng: 77.31716172897714, name: 'Mechanical Workshop' },
  Vita: { lat: 28.367155904894155, lng: 77.31802718303948, name: 'Vita' },
  'Mother dairy': { lat: 28.36630551795039, lng: 77.315464715611, name: 'Mother Dairy' },
  'Academic Block': { lat: 28.366439324018607, lng: 77.316146724016, name: 'Academic Block' },
  'Girls Hostel': { lat: 28.367024917474744, lng: 77.31800513748757, name: 'Girls Hostel' },
  Dispensary: { lat: 28.367725708494717, lng: 77.31729941865407, name: 'Dispensary' },
} as const;

export const CAMPUS_CENTER = { lat: 28.367459, lng: 77.315229 };
export const ATTENTION_STORAGE_KEY = 'smart-campus-attention-stats';

export const APP_TABS: AppTabId[] = [
  'chat',
  'events',
  'clubs',
  'reminders',
  'deadlines',
  'navigation',
  'attention',
  'dashboard',
  'profile',
];

export const TAB_LABELS: Record<AppTabId, string> = {
  chat: 'AI Chat',
  events: 'Events',
  clubs: 'Clubs',
  reminders: 'Reminders',
  deadlines: 'Deadlines',
  navigation: 'Navigation',
  attention: 'Attention',
  dashboard: 'Dashboard',
  profile: 'Profile',
};

export const SEND_EMAIL_API_URL = '/api/send-email';
