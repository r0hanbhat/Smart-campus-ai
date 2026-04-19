import { TAB_LABELS } from '@/lib/smart-campus/constants';
import { formatDuration } from '@/lib/smart-campus/utils';
import type { AppTabId } from '@/lib/smart-campus/types';

type AttentionBreakdownItem = {
  id: AppTabId;
  label: string;
  focusedMs: number;
  backgroundMs: number;
  visits: number;
  totalMs: number;
};

type DashboardOverviewTabProps = {
  attentionScore: number;
  attentionLevel: string;
  totalFocusedMs: number;
  totalBackgroundMs: number;
  totalVisits: number;
  attentionReport: string[];
  mostFocusedTab: AppTabId;
  focusRatio: number;
  averageFocusPerVisitMs: number;
  tabAttentionBreakdown: AttentionBreakdownItem[];
  visibleInsights: string[];
};

type ProfileTabProps = {
  displayName: string;
  username: string;
  isOnline: boolean;
  lastSeenLabel: string;
  attendedEventsCount: number;
  joinedClubsCount: number;
  upcomingRemindersCount: number;
  openDeadlinesCount: number;
  fullName: string;
  profileAge: number | null;
  profileEmail: string;
  userId: string;
  mostFocusedTab: AppTabId;
  attentionLevel: string;
  focusRatio: number;
  totalFocusedMs: number;
  visibleInsights: string[];
};

type AttentionTabProps = {
  mostFocusedTab: AppTabId;
  attentionScore: number;
  attentionLevel: string;
  totalFocusedMs: number;
  totalBackgroundMs: number;
  totalVisits: number;
  attentionReport: string[];
  focusRatio: number;
  averageFocusPerVisitMs: number;
  tabAttentionBreakdown: AttentionBreakdownItem[];
};

function AttentionSectionBreakdown({
  tabAttentionBreakdown,
  totalFocusedMs,
  keyPrefix,
}: {
  tabAttentionBreakdown: AttentionBreakdownItem[];
  totalFocusedMs: number;
  keyPrefix: string;
}) {
  return (
    <div className="space-y-3">
      {tabAttentionBreakdown.map((tab) => {
        const share = totalFocusedMs > 0 ? Math.round((tab.focusedMs / totalFocusedMs) * 100) : 0;
        const barWidth = tab.totalMs > 0 ? Math.max(share, tab.focusedMs > 0 ? 6 : 0) : 0;

        return (
          <div key={`${keyPrefix}-${tab.id}`} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium text-white">{tab.label}</div>
                <div className="text-sm text-white/50">{tab.visits} visits</div>
              </div>
              <div className="grid gap-3 text-sm text-white/80 md:min-w-[360px] md:grid-cols-3">
                <div className="rounded-lg bg-white/5 px-3 py-2">Focused: {formatDuration(tab.focusedMs)}</div>
                <div className="rounded-lg bg-white/5 px-3 py-2">Background: {formatDuration(tab.backgroundMs)}</div>
                <div className="rounded-lg bg-white/5 px-3 py-2">Share: {share}%</div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardOverviewTab({
  attentionScore,
  attentionLevel,
  totalFocusedMs,
  totalBackgroundMs,
  totalVisits,
  attentionReport,
  mostFocusedTab,
  focusRatio,
  averageFocusPerVisitMs,
  tabAttentionBreakdown,
  visibleInsights,
}: DashboardOverviewTabProps) {
  return (
    <div className="space-y-6">
      <h2 className="mb-6 text-2xl font-bold text-white">My Dashboard</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 p-6">
          <div className="mb-2 text-4xl">AI</div>
          <div className="text-3xl font-bold text-white">{attentionScore}</div>
          <div className="text-sm text-cyan-200">Attention Score</div>
        </div>
        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/20 to-purple-500/5 p-6">
          <div className="mb-2 text-4xl">FP</div>
          <div className="text-3xl font-bold text-white">{attentionLevel}</div>
          <div className="text-sm text-purple-200">Current Focus Pattern</div>
        </div>
        <div className="rounded-2xl border border-pink-500/30 bg-gradient-to-br from-pink-500/20 to-pink-500/5 p-6">
          <div className="mb-2 text-4xl">FT</div>
          <div className="text-3xl font-bold text-white">{formatDuration(totalFocusedMs)}</div>
          <div className="text-sm text-pink-200">Focused Time</div>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-amber-500/5 p-6">
          <div className="mb-2 text-4xl">BG</div>
          <div className="text-3xl font-bold text-white">{formatDuration(totalBackgroundMs)}</div>
          <div className="text-sm text-amber-200">Background Time</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-6">
          <div className="mb-2 text-4xl">SW</div>
          <div className="text-3xl font-bold text-white">{totalVisits}</div>
          <div className="text-sm text-emerald-200">Section Visits</div>
        </div>
      </div>
      <div className="campus-panel rounded-[1.7rem] p-6">
        <h3 className="mb-4 text-xl font-bold text-white">Attention Analysis Report</h3>
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            {attentionReport.map((line, index) => (
              <div key={`attention-report-${index}`} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/80">
                {line}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-cyan-200/70">Top signal</div>
            <div className="mt-3 text-2xl font-bold text-white">{TAB_LABELS[mostFocusedTab]}</div>
            <div className="mt-2 text-sm text-white/70">
              This section currently holds the strongest share of your focused attention.
            </div>
            <div className="mt-5 text-sm text-white/60">Focus ratio: {Math.round(focusRatio * 100)}%</div>
            <div className="mt-1 text-sm text-white/60">Avg focused stretch: {formatDuration(averageFocusPerVisitMs)}</div>
          </div>
        </div>
      </div>
      <div className="campus-panel rounded-[1.7rem] p-6">
        <h3 className="mb-4 text-xl font-bold text-white">Attention By Section</h3>
        <AttentionSectionBreakdown
          keyPrefix="dashboard"
          tabAttentionBreakdown={tabAttentionBreakdown}
          totalFocusedMs={totalFocusedMs}
        />
      </div>
      <div className="campus-panel rounded-[1.7rem] p-6">
        <h3 className="mb-4 text-xl font-bold text-white">What AI Learned About You</h3>
        <div className="space-y-3">
          {visibleInsights.length === 0 ? (
            <div className="text-white/60">Start joining clubs, checking in to events, setting reminders, or chatting with the AI to build your activity profile.</div>
          ) : (
            visibleInsights.map((insight, index) => (
              <div key={`${insight}-${index}`} className="flex items-center gap-3 text-white/80">
                <div className="h-2 w-2 rounded-full bg-cyan-500" />
                <span>{insight}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function ProfileTab({
  displayName,
  username,
  isOnline,
  lastSeenLabel,
  attendedEventsCount,
  joinedClubsCount,
  upcomingRemindersCount,
  openDeadlinesCount,
  fullName,
  profileAge,
  profileEmail,
  userId,
  mostFocusedTab,
  attentionLevel,
  focusRatio,
  totalFocusedMs,
  visibleInsights,
}: ProfileTabProps) {
  return (
    <div className="space-y-6">
      <div className="campus-panel-strong rounded-[2rem] p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-gradient-to-br from-cyan-400 via-sky-400 to-emerald-400 text-3xl font-bold text-slate-950">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="campus-kicker">Student Profile</div>
              <h2 className="mt-2 text-3xl font-bold text-white">{displayName}</h2>
              <p className="mt-1 text-white/65">@{username}</p>
              <p className="mt-3 max-w-2xl text-sm text-white/60">
                Your profile brings together your account identity, campus activity, and attention signals in one place.
              </p>
            </div>
          </div>
          <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/75">
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">Account Status</div>
            <div className="mt-2 text-base font-semibold text-white">{isOnline ? 'Online' : 'Signed in'}</div>
            <div className="mt-1">Last seen: {lastSeenLabel}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.7rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 p-6">
          <div className="text-sm uppercase tracking-[0.2em] text-cyan-200/70">Events</div>
          <div className="mt-3 text-4xl font-bold text-white">{attendedEventsCount}</div>
          <div className="mt-2 text-sm text-white/65">Checked in and attended</div>
        </div>
        <div className="rounded-[1.7rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-6">
          <div className="text-sm uppercase tracking-[0.2em] text-emerald-200/70">Clubs</div>
          <div className="mt-3 text-4xl font-bold text-white">{joinedClubsCount}</div>
          <div className="mt-2 text-sm text-white/65">Communities you joined</div>
        </div>
        <div className="rounded-[1.7rem] border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-500/5 p-6">
          <div className="text-sm uppercase tracking-[0.2em] text-fuchsia-200/70">Reminders</div>
          <div className="mt-3 text-4xl font-bold text-white">{upcomingRemindersCount}</div>
          <div className="mt-2 text-sm text-white/65">Active reminder items</div>
        </div>
        <div className="rounded-[1.7rem] border border-amber-400/20 bg-gradient-to-br from-amber-500/20 to-amber-500/5 p-6">
          <div className="text-sm uppercase tracking-[0.2em] text-amber-200/70">Deadlines</div>
          <div className="mt-3 text-4xl font-bold text-white">{openDeadlinesCount}</div>
          <div className="mt-2 text-sm text-white/65">Open tasks still pending</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="campus-panel rounded-[1.8rem] p-6">
          <h3 className="text-xl font-bold text-white">Account Details</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">Full Name</div>
              <div className="mt-2 text-white">{fullName}</div>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">Age</div>
              <div className="mt-2 text-white">{profileAge ?? 'Not set yet'}</div>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">Username</div>
              <div className="mt-2 text-white">@{username}</div>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">Email</div>
              <div className="mt-2 break-all text-white">{profileEmail}</div>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">Password</div>
              <div className="mt-2 text-white">Stored securely in Supabase Auth</div>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">User ID</div>
              <div className="mt-2 break-all text-white/80">{userId}</div>
            </div>
          </div>
        </div>

        <div className="campus-panel rounded-[1.8rem] p-6">
          <h3 className="text-xl font-bold text-white">Student Activity Snapshot</h3>
          <div className="mt-5 space-y-3">
            <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4 text-white/80">
              Most focused section: <span className="font-semibold text-white">{TAB_LABELS[mostFocusedTab]}</span>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4 text-white/80">
              Attention level: <span className="font-semibold text-white">{attentionLevel}</span>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4 text-white/80">
              Focus ratio: <span className="font-semibold text-white">{Math.round(focusRatio * 100)}%</span>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4 text-white/80">
              Total focused time: <span className="font-semibold text-white">{formatDuration(totalFocusedMs)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="campus-panel rounded-[1.8rem] p-6">
        <h3 className="text-xl font-bold text-white">What Smart Campus AI Knows About You</h3>
        <div className="mt-5 grid gap-3">
          {visibleInsights.length === 0 ? (
            <div className="rounded-[1.2rem] border border-dashed border-white/15 px-4 py-5 text-white/55">
              Start using events, clubs, reminders, deadlines, and chat to build your profile automatically.
            </div>
          ) : (
            visibleInsights.map((insight, index) => (
              <div key={`profile-insight-${index}`} className="rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-4 text-white/80">
                {insight}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function AttentionTab({
  mostFocusedTab,
  attentionScore,
  attentionLevel,
  totalFocusedMs,
  totalBackgroundMs,
  totalVisits,
  attentionReport,
  focusRatio,
  averageFocusPerVisitMs,
  tabAttentionBreakdown,
}: AttentionTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Attention Span</h2>
          <p className="text-sm text-white/60">
            This is Phase 1 tracking inside Smart Campus AI only. Full device tracking needs a desktop app or extension.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
          Most focused section: <span className="font-semibold text-white">{TAB_LABELS[mostFocusedTab]}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 p-6">
          <div className="mb-2 text-4xl">SC</div>
          <div className="text-3xl font-bold text-white">{attentionScore}</div>
          <div className="text-sm text-cyan-200">Attention Score</div>
        </div>
        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/20 to-purple-500/5 p-6">
          <div className="mb-2 text-4xl">FP</div>
          <div className="text-3xl font-bold text-white">{attentionLevel}</div>
          <div className="text-sm text-purple-200">Focus Pattern</div>
        </div>
        <div className="rounded-2xl border border-pink-500/30 bg-gradient-to-br from-pink-500/20 to-pink-500/5 p-6">
          <div className="mb-2 text-4xl">FT</div>
          <div className="text-3xl font-bold text-white">{formatDuration(totalFocusedMs)}</div>
          <div className="text-sm text-pink-200">Focused Time</div>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-amber-500/5 p-6">
          <div className="mb-2 text-4xl">BG</div>
          <div className="text-3xl font-bold text-white">{formatDuration(totalBackgroundMs)}</div>
          <div className="text-sm text-amber-200">Background Time</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-6">
          <div className="mb-2 text-4xl">SW</div>
          <div className="text-3xl font-bold text-white">{totalVisits}</div>
          <div className="text-sm text-emerald-200">Section Visits</div>
        </div>
      </div>

      <div className="campus-panel rounded-[1.7rem] p-6">
        <h3 className="mb-4 text-xl font-bold text-white">Analysis Report</h3>
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            {attentionReport.map((line, index) => (
              <div key={`attention-tab-report-${index}`} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/80">
                {line}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-cyan-200/70">Roadmap Status</div>
            <div className="mt-3 text-2xl font-bold text-white">Website Scope</div>
            <div className="mt-2 text-sm text-white/70">
              This version measures focus across Smart Campus AI sections. System-wide app tracking is the next architecture phase.
            </div>
            <div className="mt-5 text-sm text-white/60">Focus ratio: {Math.round(focusRatio * 100)}%</div>
            <div className="mt-1 text-sm text-white/60">Avg focused stretch: {formatDuration(averageFocusPerVisitMs)}</div>
          </div>
        </div>
      </div>

      <div className="campus-panel rounded-[1.7rem] p-6">
        <h3 className="mb-4 text-xl font-bold text-white">Section Breakdown</h3>
        <AttentionSectionBreakdown
          keyPrefix="attention"
          tabAttentionBreakdown={tabAttentionBreakdown}
          totalFocusedMs={totalFocusedMs}
        />
      </div>
    </div>
  );
}
