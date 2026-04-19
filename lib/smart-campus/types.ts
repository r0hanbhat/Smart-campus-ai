export type NavigateAction = {
  type: 'navigate';
  destination: keyof typeof import('./constants.ts').CAMPUS_LOCATIONS;
  confirmation: string;
};

export type AddDeadlineAction = {
  type: 'add_deadline';
  title: string;
  date: string;
  time: string;
  needsDate?: boolean;
  needsTime?: boolean;
  confirmation: string;
};

export type SetReminderAction = {
  type: 'set_reminder';
  eventName: string;
  date: string;
  time: string;
  needsDate?: boolean;
  needsTime?: boolean;
  confirmation: string;
};

export type ExpressInterestAction = {
  type: 'express_interest';
  eventType: string;
  needsDate?: false;
  confirmation: string;
};

export type InvalidDateAction = {
  type: 'invalid_date';
  error: 'past_date' | 'invalid_format';
  message: string;
  retryField: 'date';
};

export type PendingAction =
  | NavigateAction
  | AddDeadlineAction
  | SetReminderAction
  | ExpressInterestAction;

export type WaitingForDate = {
  action: AddDeadlineAction | SetReminderAction;
  originalMessage: string;
};

export type WaitingForTime = {
  action: AddDeadlineAction | SetReminderAction;
  originalMessage: string;
};

export type Message = {
  role: string;
  content: string;
  memoriesUsed?: number;
  action?: PendingAction | InvalidDateAction;
  imagePreviewUrl?: string;
};

export type Event = {
  id: string;
  name: string;
  type: string;
  date: string;
  time: string;
  location: string;
  attending?: boolean;
  checkedIn?: boolean;
};

export type Club = {
  id: string;
  name: string;
  category: string;
  description: string;
  joined?: boolean;
};

export type Deadline = {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
  completed?: boolean;
};

export type Reminder = {
  id: string;
  eventName: string;
  date: string;
  time: string;
};

export type UploadedImage = {
  dataUrl: string;
  mimeType: string;
  name: string;
};

export type AppTabId =
  | 'chat'
  | 'events'
  | 'clubs'
  | 'reminders'
  | 'deadlines'
  | 'navigation'
  | 'attention'
  | 'dashboard'
  | 'profile';

export type AttentionStat = {
  focusedMs: number;
  backgroundMs: number;
  visits: number;
};

export type AttentionStats = Record<AppTabId, AttentionStat>;

export type UserProfileSummary = {
  user_id: string;
  username: string;
  display_name: string;
  full_name: string | null;
  age: number | null;
  email: string | null;
  is_online: boolean;
  last_seen: string;
};

export type ChatApiResponse = {
  response?: string;
  memoriesUsed?: number;
  action?: PendingAction | InvalidDateAction | null;
  error?: string;
};

export type DashboardInsightsResponse = {
  insights?: string[];
  error?: string;
};

export type PersistedMessage = {
  role: string;
  content: string;
  memoriesUsed?: number;
};

export type UserStateProfile = {
  eventsAttended: number;
  clubsJoined: number;
};

export type UserStateRow = {
  user_id: string;
  events: Event[];
  clubs: Club[];
  reminders: Reminder[];
  deadlines: Deadline[];
  profile: UserStateProfile;
  messages: PersistedMessage[];
};
