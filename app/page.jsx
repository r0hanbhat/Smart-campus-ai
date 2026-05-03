'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { useAuth } from './contexts/AuthContext.jsx';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { AttentionTab, DashboardOverviewTab, ProfileTab } from './components/AnalyticsTabs.jsx';
import { StudentAttendanceTab } from './components/AttendancePanels.jsx';
import IssueReportingTab from './components/IssueReportingTab.jsx';
import NoticeBoard, { NoticeBellBadge } from './components/NoticeBoard.jsx';
import CampusChatPanel from './components/CampusChatPanel.jsx';
import { AdminDashboard, TeacherDashboard, TeacherPendingPanel } from './components/RolePanels.jsx';
import { SmartPlannerTab } from './components/SmartPlannerTab.jsx';
import { useAttentionTracking } from './hooks/useAttentionTracking.js';
import { useReminderScheduler } from './hooks/useReminderScheduler.js';
import { useUserStateSync } from './hooks/useUserStateSync.js';
import { APP_TABS, CAMPUS_CENTER, CAMPUS_LOCATIONS, TAB_LABELS } from '@/lib/smart-campus/constants';
import { buildWeeklyPlannerView, formatPlannerRange, getPlannerValidationError, normalizePlannerEntry } from '@/lib/smart-campus/planner.js';
import { resolveAccountRole, resolveVerificationStatus } from '@/lib/smart-campus/roles.js';
import { dedupeReminderByEventName, formatDuration, getAttentionSummary, parseDateTimeLocal, removeRemindersByEventName } from '@/lib/smart-campus/utils';
export default function Home() {
    const { user, loading: authLoading, signOut } = useAuth();
    const [supabase] = useState(() => createClient());
    const [activeTab, setActiveTab] = useState('chat');
    const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
    const [chatMode, setChatMode] = useState('assistant');
    const [clubEventsTab, setClubEventsTab] = useState('open'); // 'open' | 'live'
    const [clubEventsData, setClubEventsData] = useState({ open_registration: [], upcoming_live: [], loaded: false });
    const [input, setInput] = useState('');
    const [uploadedImage, setUploadedImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const imageInputRef = useRef(null);
    const [pendingAction, setPendingAction] = useState(null);
    const [waitingForDate, setWaitingForDate] = useState(null);
    const [waitingForTime, setWaitingForTime] = useState(null);
    const [learnedInsights, setLearnedInsights] = useState([]);
    const [selectedDestination, setSelectedDestination] = useState(null);
    const [userLocation, setUserLocation] = useState(CAMPUS_CENTER);
    const [currentLocationName, setCurrentLocationName] = useState('Main Gate');
    const [pendingClubJoinId, setPendingClubJoinId] = useState(null);
    const [clubJoinConfirmation, setClubJoinConfirmation] = useState('');
    const { events, setEvents, clubs, setClubs, deadlines, setDeadlines, reminders, setReminders, plannerEntries, setPlannerEntries, teacherWorkspace, setTeacherWorkspace, messages, setMessages, userProfile, teacherVerificationRequest, teacherVerificationLoading, teacherVerificationError, submitTeacherVerificationRequest, profileUpdateLoading, updateUserProfile, reportedIssues, issueNotificationPreferences, issuesLoading, issueError, createIssueReport, updateIssuePreferences, rateIssueSatisfaction, refreshIssueCenter, isDataLoaded, dataLoadError, } = useUserStateSync({ user, authLoading, supabase });
    const { attentionStats } = useAttentionTracking(activeTab);
    const { cancelScheduledNotification, sendImmediateCreationEmail, scheduleNotificationForDeadline, scheduleNotificationForReminder, } = useReminderScheduler({
        reminders,
        deadlines,
        isDataLoaded,
        userEmail: user?.email || '',
    });
    const joinedClubsCount = clubs.filter((club) => club.joined).length;
    const attendedEventsCount = events.filter((event) => event.checkedIn).length;
    const upcomingRemindersCount = reminders.length;
    const openDeadlinesCount = deadlines.filter((deadline) => !deadline.completed).length;
    const derivedProfile = {
        eventsAttended: attendedEventsCount,
        clubsJoined: joinedClubsCount,
    };
    const fullName = userProfile?.full_name || userProfile?.display_name || user?.email?.split('@')[0] || 'Student';
    const displayName = userProfile?.display_name || fullName;
    const username = userProfile?.username || (user ? `${user.email?.split('@')[0] || 'student'}-${user.id.slice(0, 4)}` : 'student');
    const profileEmail = userProfile?.email || user?.email || 'No email available';
    const profileAge = userProfile?.age ?? null;
    const profileRollNumber = userProfile?.roll_number || null;
    const profileCourse = userProfile?.course || null;
    const profileBranch = userProfile?.branch || null;
    const profileSemester = userProfile?.semester ?? null;
    const accountRole = resolveAccountRole(userProfile, user);
    const verificationStatus = resolveVerificationStatus(userProfile, user);
    const teacherRequestStatus = typeof teacherVerificationRequest?.status === 'string' ? teacherVerificationRequest.status : '';
    const isTeacherApproved = accountRole === 'teacher' && (verificationStatus === 'approved' || teacherRequestStatus === 'approved');
    const effectiveTeacherVerificationStatus = isTeacherApproved ? 'approved' : verificationStatus;
    const lastSeenLabel = userProfile?.is_online
        ? 'Online now'
        : userProfile?.last_seen
            ? new Date(userProfile.last_seen).toLocaleString()
            : 'No recent activity yet';
    const visibleInsights = Array.from(new Set(learnedInsights.length > 0
        ? learnedInsights
        : [
            ...clubs.filter((club) => club.joined).map((club) => `You joined ${club.name}.`),
            ...events.filter((event) => event.checkedIn).map((event) => `You checked in to ${event.name}.`),
            ...deadlines.filter((deadline) => !deadline.completed).map((deadline) => `You are tracking the deadline "${deadline.title}" due on ${deadline.date}.`),
            ...reminders.map((reminder) => `You asked to be reminded about ${reminder.eventName} on ${reminder.date}.`),
        ]));
    const { totalFocusedMs, totalBackgroundMs, totalVisits, focusRatio, averageFocusPerVisitMs, mostFocusedTab, mostDistractedTab, tabAttentionBreakdown, } = getAttentionSummary(attentionStats);
    const attentionScore = Math.max(0, Math.min(100, Math.round(focusRatio * 70 +
        Math.min(30, averageFocusPerVisitMs / 1000 / 6))));
    const attentionLevel = attentionScore >= 75
        ? 'Deep focus'
        : attentionScore >= 50
            ? 'Steady focus'
            : attentionScore >= 30
                ? 'Fragmented focus'
                : 'Highly distracted';
    const attentionReport = [
        totalFocusedMs === 0
            ? 'Start using different sections of the app and the dashboard will build an attention profile for you.'
            : `You spent the most focused time in ${TAB_LABELS[mostFocusedTab]}, which suggests that is your primary working zone right now.`,
        totalBackgroundMs > totalFocusedMs * 0.5
            ? `A large share of your session happened while the app was in the background, especially around ${TAB_LABELS[mostDistractedTab]}. That usually signals frequent tab switching or interruptions.`
            : 'Most of your time stayed in active focus, which is a good sign that you are working with intention instead of rapidly context switching.',
        averageFocusPerVisitMs >= 4 * 60 * 1000
            ? `Your average focused stretch is ${formatDuration(averageFocusPerVisitMs)} per visit, which points to decent sustained attention.`
            : `Your average focused stretch is ${formatDuration(averageFocusPerVisitMs)} per visit, so shorter bursts are breaking up your flow.`,
    ];
    const plannerWeekData = useMemo(() => buildWeeklyPlannerView({
        plannerEntries,
        events,
        reminders,
        deadlines,
        weekStartDate: new Date(),
    }), [deadlines, events, plannerEntries, reminders]);
    useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(startOfToday);
        endOfToday.setDate(endOfToday.getDate() + 1);
        endOfToday.setMilliseconds(endOfToday.getMilliseconds() - 1);
        const endOfWeek = new Date(startOfToday);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        endOfWeek.setHours(23, 59, 59, 999);
        const focusPenalty = focusRatio < 0.35 ? 20 : focusRatio < 0.55 ? 10 : 0;
        const matchingInsightBoost = (label) => visibleInsights.some((insight) => insight.toLowerCase().includes(label.toLowerCase())) ? 8 : 0;
        const formatDueLabel = (scheduledAt, fallbackDate, fallbackTime) => {
            if (Number.isNaN(scheduledAt.getTime())) {
                return `${fallbackDate} at ${fallbackTime}`;
            }
            return scheduledAt.toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            });
        };
        const deadlineItems = deadlines
            .filter((deadline) => !deadline.completed)
            .map((deadline) => {
            const scheduledAt = parseDateTimeLocal(deadline.date, deadline.time || '11:59 PM');
            const msUntil = scheduledAt.getTime() - now.getTime();
            const hoursUntil = msUntil / (1000 * 60 * 60);
            const isOverdue = !Number.isNaN(scheduledAt.getTime()) && msUntil < 0;
            const isToday = scheduledAt >= startOfToday && scheduledAt <= endOfToday;
            const score = (isOverdue ? 150 : hoursUntil <= 24 ? 120 : hoursUntil <= 72 ? 95 : scheduledAt <= endOfWeek ? 72 : 48) +
                focusPenalty +
                matchingInsightBoost(deadline.title);
            return {
                id: `deadline-${deadline.id}`,
                title: deadline.title,
                subtitle: isOverdue
                    ? 'This deadline has already passed and should be resolved first.'
                    : 'Academic deadline tracked by Smart Campus AI.',
                kind: 'deadline',
                tabTarget: 'deadlines',
                sourceId: deadline.id,
                score,
                isOverdue,
                isToday,
                dueLabel: `Due ${formatDueLabel(scheduledAt, deadline.date, deadline.time || '11:59 PM')}`,
                urgencyLabel: isOverdue ? 'overdue' : hoursUntil <= 24 ? 'today' : hoursUntil <= 72 ? 'soon' : 'upcoming',
                primaryActionLabel: 'Mark done',
            };
        });
        const reminderItems = reminders.map((reminder) => {
            const scheduledAt = parseDateTimeLocal(reminder.date, reminder.time);
            const msUntil = scheduledAt.getTime() - now.getTime();
            const hoursUntil = msUntil / (1000 * 60 * 60);
            const isOverdue = !Number.isNaN(scheduledAt.getTime()) && msUntil < 0;
            const isToday = scheduledAt >= startOfToday && scheduledAt <= endOfToday;
            const score = (isOverdue ? 130 : hoursUntil <= 12 ? 92 : hoursUntil <= 48 ? 74 : scheduledAt <= endOfWeek ? 60 : 36) +
                Math.round(focusPenalty * 0.7) +
                matchingInsightBoost(reminder.eventName);
            return {
                id: `reminder-${reminder.id}`,
                title: reminder.eventName,
                subtitle: 'Scheduled reminder waiting for follow-through.',
                kind: 'reminder',
                tabTarget: 'reminders',
                sourceId: reminder.id,
                score,
                isOverdue,
                isToday,
                dueLabel: `Reminder set for ${formatDueLabel(scheduledAt, reminder.date, reminder.time)}`,
                urgencyLabel: isOverdue ? 'missed' : hoursUntil <= 12 ? 'today' : hoursUntil <= 48 ? 'soon' : 'queued',
                primaryActionLabel: 'Open reminder',
            };
        });
        const eventItems = events
            .filter((event) => !event.checkedIn)
            .map((event) => {
            const scheduledAt = parseDateTimeLocal(event.date, event.time);
            const msUntil = scheduledAt.getTime() - now.getTime();
            const hoursUntil = msUntil / (1000 * 60 * 60);
            const isOverdue = !Number.isNaN(scheduledAt.getTime()) && msUntil < 0;
            const isToday = scheduledAt >= startOfToday && scheduledAt <= endOfToday;
            const score = (event.attending ? 16 : 0) +
                (isOverdue ? 84 : hoursUntil <= 24 ? 82 : hoursUntil <= 72 ? 66 : scheduledAt <= endOfWeek ? 52 : 28) +
                Math.round(focusPenalty * 0.5) +
                matchingInsightBoost(event.name);
            return {
                id: `event-${event.id}`,
                title: event.name,
                subtitle: `${event.location} · ${event.attending ? 'You already RSVPed.' : 'No RSVP yet.'}`,
                kind: 'event',
                tabTarget: 'events',
                sourceId: event.id,
                score,
                isOverdue,
                isToday,
                dueLabel: `Event starts ${formatDueLabel(scheduledAt, event.date, event.time)}`,
                urgencyLabel: isOverdue ? 'missed' : event.attending ? 'committed' : isToday ? 'today' : 'optional',
                primaryActionLabel: event.attending ? 'Open event' : 'RSVP now',
            };
        });
        const allItems = [...deadlineItems, ...reminderItems, ...eventItems]
            .filter((item) => {
            const rawDate = item.dueLabel;
            return Boolean(rawDate);
        })
            .sort((a, b) => b.score - a.score);
        const todayItems = allItems
            .filter((item) => item.isOverdue || item.isToday)
            .slice(0, 6);
        const weekItems = allItems
            .filter((item) => {
            const scheduledAt = (() => {
                if (item.kind === 'deadline') {
                    const deadline = deadlines.find((entry) => entry.id === item.sourceId);
                    return deadline ? parseDateTimeLocal(deadline.date, deadline.time || '11:59 PM') : null;
                }
                if (item.kind === 'reminder') {
                    const reminder = reminders.find((entry) => entry.id === item.sourceId);
                    return reminder ? parseDateTimeLocal(reminder.date, reminder.time) : null;
                }
                const event = events.find((entry) => entry.id === item.sourceId);
                return event ? parseDateTimeLocal(event.date, event.time) : null;
            })();
            return Boolean(scheduledAt) && scheduledAt <= endOfWeek;
        })
            .slice(0, 8);
        const highRiskItems = allItems
            .filter((item) => item.isOverdue || item.score >= 90)
            .slice(0, 6);
        const guidance = [
            todayItems.length > 0
                ? `You have ${todayItems.length} item${todayItems.length === 1 ? '' : 's'} that want attention today. Clear the overdue and same-day items before lower-stakes browsing.`
                : 'Your same-day load is light right now, so this is a good window for deeper work or prep.',
            focusRatio < 0.5
                ? `Your current attention pattern is ${attentionLevel.toLowerCase()}, so the planner is boosting urgent tasks higher than usual to reduce context switching.`
                : `Your current attention pattern is ${attentionLevel.toLowerCase()}, which gives you room to sequence work more deliberately across the week.`,
            visibleInsights.length > 0
                ? visibleInsights[0]
                : 'As you keep using reminders, deadlines, events, and chat, the planner will personalize its ranking more aggressively.',
        ];
        return {
            todayItems,
            weekItems,
            highRiskItems,
            guidance,
        };
    }, [attentionLevel, deadlines, events, focusRatio, reminders, visibleInsights]);
    const plannerData = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(startOfToday);
        endOfToday.setDate(endOfToday.getDate() + 1);
        endOfToday.setMilliseconds(endOfToday.getMilliseconds() - 1);
        const focusPenalty = focusRatio < 0.35 ? 20 : focusRatio < 0.55 ? 10 : 0;
        const matchingInsightBoost = (label) => visibleInsights.some((insight) => insight.toLowerCase().includes(label.toLowerCase())) ? 8 : 0;
        const allItems = plannerWeekData.days
            .flatMap((day) => day.items)
            .filter((item) => !(item.kind === 'planner' && item.completed))
            .map((item) => {
            const scheduledAt = new Date(`${item.date}T${item.startTime}:00`);
            const msUntil = scheduledAt.getTime() - now.getTime();
            const hoursUntil = msUntil / (1000 * 60 * 60);
            const isOverdue = !Number.isNaN(scheduledAt.getTime()) && msUntil < 0 && item.kind !== 'event';
            const isToday = scheduledAt >= startOfToday && scheduledAt <= endOfToday;
            const plannerScore = item.kind === 'planner'
                ? (item.category === 'study' ? 72 : 58) + (item.isConflicting ? 18 : 0)
                : 0;
            const kindScore = item.kind === 'deadline'
                ? (isOverdue ? 150 : hoursUntil <= 24 ? 120 : hoursUntil <= 72 ? 95 : 72)
                : item.kind === 'reminder'
                    ? (isOverdue ? 130 : hoursUntil <= 12 ? 92 : hoursUntil <= 48 ? 74 : 60)
                    : item.kind === 'event'
                        ? (hoursUntil <= 24 ? 84 : hoursUntil <= 72 ? 66 : 52)
                        : plannerScore;
            return {
                id: item.id,
                title: item.title,
                subtitle: item.subtitle,
                kind: item.kind,
                tabTarget: item.kind === 'planner' ? 'planner' : item.sourceType === 'event' ? 'events' : item.sourceType === 'deadline' ? 'deadlines' : 'reminders',
                sourceId: item.sourceId,
                score: kindScore + focusPenalty + matchingInsightBoost(item.title),
                isOverdue,
                isToday,
                dueLabel: item.kind === 'planner' ? `${item.date} | ${formatPlannerRange(item.startTime, item.endTime)}` : item.timeLabel,
                urgencyLabel: item.kind === 'planner'
                    ? item.isConflicting ? 'overlap' : isToday ? 'scheduled' : 'planned'
                    : isOverdue ? 'overdue' : isToday ? 'today' : 'upcoming',
                primaryActionLabel: item.kind === 'planner' ? (item.completed ? 'Reopen' : 'Mark done') : item.kind === 'deadline' ? 'Mark done' : item.kind === 'event' ? 'Open event' : 'Open reminder',
            };
        })
            .sort((a, b) => b.score - a.score);
        const todayItems = allItems.filter((item) => item.isOverdue || item.isToday).slice(0, 6);
        const weekItems = allItems.slice(0, 8);
        const highRiskItems = allItems
            .filter((item) => item.isOverdue || item.score >= 90 || item.urgencyLabel === 'overlap')
            .slice(0, 6);
        const guidance = [
            plannerWeekData.stats.conflictCount > 0
                ? `You have ${plannerWeekData.stats.conflictCount} overlap${plannerWeekData.stats.conflictCount === 1 ? '' : 's'} in this week's plan. Resolve those first so your schedule stays realistic.`
                : todayItems.length > 0
                    ? `You have ${todayItems.length} item${todayItems.length === 1 ? '' : 's'} that want attention today. Clear the urgent ones before adding more work.`
                    : 'Your same-day load is light right now, so this is a good window for deeper work or prep.',
            focusRatio < 0.5
                ? `Your current attention pattern is ${attentionLevel.toLowerCase()}, so the planner is boosting urgent tasks and visible conflicts higher than usual.`
                : `Your current attention pattern is ${attentionLevel.toLowerCase()}, which gives you room to sequence work more deliberately across the week.`,
            plannerWeekData.stats.plannerCount > 0
                ? `You already scheduled ${plannerWeekData.stats.plannerCount} planner block${plannerWeekData.stats.plannerCount === 1 ? '' : 's'} for this week.`
                : 'Add a few study or personal blocks and the weekly planner will start feeling like a real calendar instead of just a list.',
            visibleInsights.length > 0
                ? visibleInsights[0]
                : 'As you keep using reminders, deadlines, events, and planner blocks, the ranking will personalize more aggressively.',
        ];
        return {
            todayItems,
            weekItems,
            highRiskItems,
            guidance,
        };
    }, [attentionLevel, focusRatio, plannerWeekData, visibleInsights]);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    const handleSend = async () => {
        if ((!input.trim() && !uploadedImage) || loading || !user)
            return;
        const userMessage = input.trim() || 'Please analyze this image and answer my question.';
        const activeWaitingForDate = waitingForDate;
        const activeWaitingForTime = waitingForTime;
        const activeUploadedImage = uploadedImage;
        setInput('');
        setUploadedImage(null);
        setMessages(prev => [...prev, {
                role: 'user',
                content: userMessage,
                imagePreviewUrl: activeUploadedImage?.dataUrl,
            }]);
        setLoading(true);
        try {
            const userContext = {
                events,
                clubs,
                reminders,
                deadlines,
                plannerEntries,
                profile: derivedProfile
            };
            let finalMessage = userMessage;
            if (activeWaitingForDate) {
                finalMessage = `${activeWaitingForDate.originalMessage} on ${userMessage}`;
            }
            else if (activeWaitingForTime) {
                finalMessage = `${activeWaitingForTime.originalMessage} at ${userMessage}`;
            }
            const recentMessages = messages
                .filter((message) => message.role === 'user' || message.role === 'assistant')
                .slice(-12)
                .map((message) => ({
                role: message.role,
                content: message.content,
            }));
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: finalMessage,
                    userContext,
                    recentMessages,
                    imageDataUrl: activeUploadedImage?.dataUrl,
                    imageMimeType: activeUploadedImage?.mimeType,
                    imageName: activeUploadedImage?.name,
                }),
            });
            const data = (await response.json());
            const responseText = data.response ?? data.error ?? 'Sorry, something went wrong.';
            if (data.action) {
                if (data.action.type === 'invalid_date') {
                    if (activeWaitingForDate) {
                        setWaitingForDate(activeWaitingForDate);
                    }
                    if (activeWaitingForTime) {
                        setWaitingForTime(activeWaitingForTime);
                    }
                    setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: responseText,
                            memoriesUsed: data.memoriesUsed,
                            sources: data.sources,
                        }]);
                }
                else if ('needsDate' in data.action && data.action.needsDate) {
                    setWaitingForDate({
                        action: data.action,
                        originalMessage: activeWaitingForDate?.originalMessage ?? userMessage
                    });
                    setWaitingForTime(null);
                    setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: responseText,
                            memoriesUsed: data.memoriesUsed,
                            sources: data.sources,
                        }]);
                }
                else if ('needsTime' in data.action && data.action.needsTime) {
                    setWaitingForTime({
                        action: data.action,
                        originalMessage: activeWaitingForTime?.originalMessage ?? finalMessage
                    });
                    setWaitingForDate(null);
                    setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: responseText,
                            memoriesUsed: data.memoriesUsed,
                            sources: data.sources,
                        }]);
                }
                else {
                    setWaitingForDate(null);
                    setWaitingForTime(null);
                    setPendingAction(data.action);
                    setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: responseText,
                            memoriesUsed: data.memoriesUsed,
                            action: data.action ?? undefined,
                            sources: data.sources,
                        }]);
                }
            }
            else {
                setWaitingForDate(null);
                setWaitingForTime(null);
                setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: responseText,
                        memoriesUsed: data.memoriesUsed,
                        sources: data.sources,
                    }]);
            }
        }
        catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
        }
        finally {
            setLoading(false);
        }
    };
    const confirmAction = async () => {
        if (!pendingAction)
            return;
        const action = pendingAction;
        if (action.type === 'navigate') {
            const location = CAMPUS_LOCATIONS[action.destination];
            if (location) {
                setSelectedDestination(location);
                setActiveTab('navigation');
            }
        }
        else if (action.type === 'add_deadline') {
            const deadline = {
                id: Date.now().toString(),
                title: action.title,
                date: action.date,
                time: action.time,
                type: 'custom',
            };
            setDeadlines((prev) => [...prev, deadline]);
            setActiveTab('deadlines');
            void fetch('/api/store-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'add_deadline',
                    title: action.title,
                    date: action.date,
                    time: action.time,
                }),
            }).catch(() => undefined);
            void sendImmediateCreationEmail({
                itemName: action.title,
                itemType: 'deadline',
                date: action.date,
                time: action.time,
                email: user?.email || '',
            });
            void scheduleNotificationForDeadline(deadline);
        }
        else if (action.type === 'set_reminder') {
            const reminder = {
                id: Date.now().toString(),
                eventName: action.eventName,
                date: action.date,
                time: action.time,
            };
            upsertReminder(reminder);
            setActiveTab('reminders');
            void fetch('/api/store-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'set_reminder',
                    eventName: action.eventName,
                    date: action.date,
                    time: action.time,
                }),
            }).catch(() => undefined);
            void scheduleNotificationForReminder(reminder);
            void sendImmediateCreationEmail({
                itemName: action.eventName,
                itemType: 'reminder',
                date: action.date,
                time: action.time,
                email: user?.email || '',
            });
        }
        else if (action.type === 'express_interest') {
            void fetch('/api/store-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'express_interest',
                    eventType: action.eventType,
                }),
            }).catch(() => undefined);
        }
        setMessages(prev => [...prev, {
                role: 'assistant',
                content: `✅ Done! ${action.type === 'navigate'
                    ? 'Showing you the location on the map.'
                    : action.type === 'express_interest'
                        ? 'Saved your interest.'
                        : 'I\'ve set that up for you.'}`
            }]);
        setPendingAction(null);
    };
    const cancelAction = () => {
        setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'No problem! Let me know if you need anything else.'
            }]);
        setPendingAction(null);
    };
    const handleRSVP = async (eventId) => {
        if (!user)
            return;
        const event = events.find(e => e.id === eventId);
        const wasAttending = event?.attending;
        setEvents(events.map(e => e.id === eventId ? { ...e, attending: !e.attending } : e));
        if (event && !wasAttending) {
            await fetch('/api/store-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, eventName: event.name, eventType: event.type, action: 'attend_event' }),
            });
            const reminder = { id: Date.now().toString(), eventName: event.name, date: event.date, time: event.time };
            upsertReminder(reminder);
            const notificationScheduled = await scheduleNotificationForReminder(reminder);
            void sendImmediateCreationEmail({
                itemName: event.name,
                itemType: 'reminder',
                date: event.date,
                time: event.time,
                email: user.email || '',
            });
            if (notificationScheduled) {
                alert(`✅ Reminder set for ${event.name}! You'll get a notification.`);
            }
            else {
                alert(`✅ Reminder set for ${event.name}!`);
            }
        }
        else if (event && wasAttending) {
            removeReminderByEventName(event.name);
        }
    };
    const triggerImagePicker = () => {
        imageInputRef.current?.click();
    };
    const handleImageUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file.');
            event.target.value = '';
            return;
        }
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.onerror = () => reject(new Error('Failed to read image.'));
            reader.readAsDataURL(file);
        });
        setUploadedImage({
            dataUrl,
            mimeType: file.type,
            name: file.name,
        });
        event.target.value = '';
    };
    const renderMessageContent = (content) => {
        const parts = content.split(/```([\w-]*)\n?([\s\S]*?)```/g);
        return parts.map((part, index) => {
            if (index % 3 === 0) {
                if (!part.trim())
                    return null;
                return (<div key={`text-${index}`} className="whitespace-pre-wrap text-sm leading-7">
            {part}
          </div>);
            }
            if (index % 3 === 1) {
                return null;
            }
            const language = parts[index - 1];
            return (<div key={`code-${index}`} className="my-4 overflow-hidden rounded-xl border border-white/10 bg-slate-950/90">
          <div className="border-b border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-cyan-200/80">
            {language || 'code'}
          </div>
          <pre className="overflow-x-auto px-4 py-4 text-sm leading-6 text-cyan-50">
            <code>{part.trim()}</code>
          </pre>
        </div>);
        });
    };
    /* legacy scheduler helpers migrated into useReminderScheduler
    const parseDateTimeLocal = (date: string, time: string) => {
      // Expecting time like "2:00 PM". Interpreted in local browser timezone.
      const timeParts = time.trim().split(/\s+/);
      if (timeParts.length < 2) {
        return new Date(`${date} ${time}`);
      }
  
      const ampm = timeParts[1]?.toLowerCase();
      const hm = timeParts[0];
      const [hStr, mStr] = hm.split(':');
      const ymd = date.split('-').map((x) => Number(x));
  
      if (ymd.length !== 3 || Number.isNaN(ymd[0]) || Number.isNaN(ymd[1]) || Number.isNaN(ymd[2])) {
        return new Date(`${date} ${time}`);
      }
  
      let hours = Number(hStr);
      const minutes = mStr ? Number(mStr) : 0;
      if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return new Date(`${date} ${time}`);
      }
  
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
  
      return new Date(ymd[0], ymd[1] - 1, ymd[2], hours, minutes, 0, 0);
    };
  
    const triggerImagePicker = () => {
      imageInputRef.current?.click();
    };
  
    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
  
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file.');
        event.target.value = '';
        return;
      }
  
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Failed to read image.'));
        reader.readAsDataURL(file);
      });
  
      setUploadedImage({
        dataUrl,
        mimeType: file.type,
        name: file.name,
      });
      event.target.value = '';
    };
  
    const renderMessageContent = (content: string) => {
      const parts = content.split(/```([\w-]*)\n?([\s\S]*?)```/g);
  
      return parts.map((part, index) => {
        if (index % 3 === 0) {
          if (!part.trim()) return null;
          return (
            <div key={`text-${index}`} className="whitespace-pre-wrap text-sm leading-7">
              {part}
            </div>
          );
        }
  
        if (index % 3 === 1) {
          return null;
        }
  
        const language = parts[index - 1];
        return (
          <div key={`code-${index}`} className="my-4 overflow-hidden rounded-xl border border-white/10 bg-slate-950/90">
            <div className="border-b border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-cyan-200/80">
              {language || 'code'}
            </div>
            <pre className="overflow-x-auto px-4 py-4 text-sm leading-6 text-cyan-50">
              <code>{part.trim()}</code>
            </pre>
          </div>
        );
      });
    };
  
    const ensureNotificationPermission = async () => {
      if (typeof window === 'undefined') return false;
      if (!('Notification' in window)) return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
  
      // Only ask once per page load to avoid spamming the user.
      if (!notificationPermissionRequestedRef.current) {
        notificationPermissionRequestedRef.current = true;
        return (await Notification.requestPermission()) === 'granted';
      }
      return false;
    };
  
    const scheduleNotificationMoments = async (params: {
      itemId: string;
      title: string;
      bodyBuilder: (offsetHours: number) => string;
      date: string;
      time: string;
      offsets: number[];
    }) => {
      if (typeof window === 'undefined') return false;
      if (!('Notification' in window)) return false;
      if (!params?.date || !params?.time || !params?.title) return false;
      const permissionOk = await ensureNotificationPermission();
      if (!permissionOk) return false;
  
      const targetDate = parseDateTimeLocal(params.date, params.time);
      if (targetDate.getTime() <= Date.now()) return false;
  
      let scheduled = false;
  
      params.offsets.forEach((offsetHours) => {
        const timerKey = `${params.itemId}-${offsetHours}h`;
        if (notificationTimersRef.current[timerKey]) {
          scheduled = true;
          return;
        }
  
        const notifyAt = targetDate.getTime() - offsetHours * 60 * 60 * 1000;
        const timeUntil = notifyAt - Date.now();
        if (timeUntil <= 0) return;
  
        notificationTimersRef.current[timerKey] = window.setTimeout(() => {
          new Notification(params.title, {
            body: params.bodyBuilder(offsetHours),
            icon: '/icon.png',
            badge: '/badge.png',
            tag: timerKey,
          });
        }, timeUntil);
  
        scheduled = true;
      });
  
      return scheduled;
    };
  
    const scheduleNotificationForReminder = async (reminder: Reminder) => {
      if (!reminder?.date || !reminder?.time || !reminder?.eventName) return false;
      return scheduleNotificationMoments({
        itemId: reminder.id,
        title: 'Reminder Alert',
        bodyBuilder: (offsetHours) =>
          offsetHours === 0
            ? `${reminder.eventName} is happening now.`
            : `${reminder.eventName} is coming up in ${offsetHours} hours.`,
        date: reminder.date,
        time: reminder.time,
        offsets: [6, 2, 0],
      });
    };
  
    const scheduleNotificationForDeadline = async (deadline: Deadline) => {
      if (!deadline?.date || !deadline?.time || !deadline?.title || deadline.completed) return false;
      return scheduleNotificationMoments({
        itemId: deadline.id,
        title: 'Deadline Alert',
        bodyBuilder: (offsetHours) => `${deadline.title} is due in ${offsetHours} hours.`,
        date: deadline.date,
        time: deadline.time,
        offsets: [6, 2],
      });
    };
  
    const cancelScheduledNotification = (itemId: string) => {
      Object.keys(notificationTimersRef.current)
        .filter((key) => key === itemId || key.startsWith(`${itemId}-`))
        .forEach((key) => {
          clearTimeout(notificationTimersRef.current[key]);
          delete notificationTimersRef.current[key];
        });
    };
  
    const cancelScheduledEmail = (itemId: string) => {
      Object.keys(emailTimersRef.current)
        .filter((key) => key === itemId || key.startsWith(`${itemId}-`))
        .forEach((key) => {
          clearTimeout(emailTimersRef.current[key]);
          delete emailTimersRef.current[key];
        });
    };
  
    const SEND_EMAIL_API_URL = '/api/send-email';
  
    const sendReminderEmailNow = async (payload: {
      email: string;
      itemName: string;
      itemType: 'reminder' | 'deadline';
      date: string;
      time: string;
      offsetHours: number;
      deliveryReason?: 'created' | 'scheduled';
    }) => {
      if (!SEND_EMAIL_API_URL) return;
  
      try {
        await fetch(SEND_EMAIL_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemName: payload.itemName,
            itemType: payload.itemType,
            date: payload.date,
            time: payload.time,
            offsetHours: payload.offsetHours,
            deliveryReason: payload.deliveryReason ?? 'scheduled',
          }),
        });
      } catch {
        // Don't block UX if email fails; notifications + UI state still work.
      }
    };
  
    const sendImmediateCreationEmail = async (params: {
      itemName: string;
      itemType: 'reminder' | 'deadline';
      date: string;
      time: string;
      email: string;
    }) => {
      if (!params.email) return;
  
      await sendReminderEmailNow({
        email: params.email,
        itemName: params.itemName,
        itemType: params.itemType,
        date: params.date,
        time: params.time,
        offsetHours: 0,
        deliveryReason: 'created',
      });
    };
  
    const scheduleEmailNotifications = async (params: {
      itemId: string;
      itemName: string;
      itemType: 'reminder' | 'deadline';
      date: string;
      time: string;
      email: string;
      offsets: number[];
    }) => {
      if (typeof window === 'undefined') return false;
      if (!params?.date || !params?.time || !params?.itemName) return false;
      if (!params.email) return false;
      if (!SEND_EMAIL_API_URL) return false;
  
      const targetDate = parseDateTimeLocal(params.date, params.time);
      let scheduled = false;
  
      params.offsets.forEach((offsetHours) => {
        const timerKey = `${params.itemId}-${offsetHours}h`;
        if (emailTimersRef.current[timerKey]) {
          scheduled = true;
          return;
        }
  
        const sendAt = targetDate.getTime() - offsetHours * 60 * 60 * 1000;
        const timeUntil = sendAt - Date.now();
        if (timeUntil <= 0) {
          return;
        }
  
        const timerId = window.setTimeout(() => {
          void sendReminderEmailNow({
            email: params.email,
            itemName: params.itemName,
            itemType: params.itemType,
            date: params.date,
            time: params.time,
            offsetHours,
            deliveryReason: 'scheduled',
          });
        }, timeUntil);
  
        emailTimersRef.current[timerKey] = timerId;
        scheduled = true;
      });
  
      return scheduled;
    };
  
    const scheduleEmailForReminder = async (reminder: Reminder, email: string) => {
      return scheduleEmailNotifications({
        itemId: reminder.id,
        itemName: reminder.eventName,
        itemType: 'reminder',
        date: reminder.date,
        time: reminder.time,
        email,
        offsets: [6, 2, 0],
      });
    };
  
    const scheduleEmailForDeadline = async (deadline: Deadline, email: string) => {
      return scheduleEmailNotifications({
        itemId: deadline.id,
        itemName: deadline.title,
        itemType: 'deadline',
        date: deadline.date,
        time: deadline.time,
        email,
        offsets: [6, 2],
      });
    };
  
    */
    const upsertReminder = (nextReminder) => {
        setReminders((prev) => {
            const existing = prev.filter((r) => r.eventName === nextReminder.eventName);
            existing.forEach((r) => {
                cancelScheduledNotification(r.id);
            });
            return dedupeReminderByEventName(prev, nextReminder);
        });
    };
    const handleRemoveReminder = (reminderId) => {
        cancelScheduledNotification(reminderId);
        setReminders((prev) => prev.filter((r) => r.id !== reminderId));
    };
    const handleCheckIn = async (eventId) => {
        const event = events.find((e) => e.id === eventId);
        if (event) {
            void fetch('/api/store-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'check_in',
                    eventName: event.name,
                    eventType: event.type,
                }),
            }).catch(() => undefined);
        }
        setEvents(events.map((e) => (e.id === eventId ? { ...e, checkedIn: true } : e)));
    };
    const removeReminderByEventName = (eventName) => {
        setReminders((prev) => {
            const matches = prev.filter((reminder) => reminder.eventName === eventName);
            matches.forEach((reminder) => {
                cancelScheduledNotification(reminder.id);
            });
            return removeRemindersByEventName(prev, eventName);
        });
    };
    const openClubJoinConfirmation = (clubId) => {
        setPendingClubJoinId(clubId);
        setClubJoinConfirmation('');
    };
    const closeClubJoinConfirmation = () => {
        setPendingClubJoinId(null);
        setClubJoinConfirmation('');
    };
    const selectTab = (tab) => {
        setActiveTab(tab);
        setIsNavMenuOpen(false);
    };
    const savePlannerEntry = (entryInput) => {
        const nextEntry = normalizePlannerEntry(entryInput);
        if (getPlannerValidationError(nextEntry)) {
            return;
        }
        setPlannerEntries((prev) => {
            const hasExisting = prev.some((entry) => entry.id === nextEntry.id);
            if (hasExisting) {
                return prev.map((entry) => entry.id === nextEntry.id ? { ...entry, ...nextEntry } : entry);
            }
            return [...prev, nextEntry];
        });
    };
    const removePlannerEntry = (plannerId) => {
        setPlannerEntries((prev) => prev.filter((entry) => entry.id !== plannerId));
    };
    const togglePlannerEntryCompletion = (plannerId) => {
        setPlannerEntries((prev) => prev.map((entry) => entry.id === plannerId ? { ...entry, completed: !entry.completed } : entry));
    };
    const handlePlannerItemAction = (item) => {
        if (item.kind === 'deadline') {
            handleToggleDeadlineCompletion(item.sourceId);
            return;
        }
        if (item.kind === 'planner') {
            togglePlannerEntryCompletion(item.sourceId);
            return;
        }
        if (item.kind === 'event') {
            const targetEvent = events.find((event) => event.id === item.sourceId);
            if (targetEvent && !targetEvent.attending) {
                void handleRSVP(item.sourceId);
                return;
            }
        }
        selectTab(item.tabTarget);
    };
    const handleJoinClub = async (clubId) => {
        if (!user)
            return;
        const club = clubs.find((item) => item.id === clubId);
        if (!club)
            return;
        if (club.joined) {
            setClubs((prev) => prev.map((item) => item.id === clubId ? { ...item, joined: false } : item));
            return;
        }
        if (clubJoinConfirmation.trim().toLowerCase() !== 'confirm') {
            return;
        }
        setClubs((prev) => prev.map((item) => item.id === clubId ? { ...item, joined: true } : item));
        closeClubJoinConfirmation();
        await fetch('/api/store-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, clubName: club.name, action: 'join_club' }),
        });
    };
    const handleToggleDeadlineCompletion = (deadlineId) => {
        const targetDeadline = deadlines.find((deadline) => deadline.id === deadlineId);
        if (!targetDeadline)
            return;
        const nextCompleted = !targetDeadline.completed;
        if (nextCompleted) {
            cancelScheduledNotification(deadlineId);
        }
        else {
            void scheduleNotificationForDeadline({ ...targetDeadline, completed: false });
        }
        setDeadlines((prev) => prev.map((deadline) => deadline.id === deadlineId ? { ...deadline, completed: nextCompleted } : deadline));
    };
    const addDeadline = () => {
        const title = prompt('Deadline title:');
        const date = prompt('Date (YYYY-MM-DD):');
        const time = prompt('Time (e.g. 11:59 PM):');
        if (title && date && time) {
            const parsedDate = new Date(`${date}T00:00:00`);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (Number.isNaN(parsedDate.getTime())) {
                alert('Please enter a valid deadline date in YYYY-MM-DD format.');
                return;
            }
            if (parsedDate < today) {
                alert('Please choose today or a future date for the deadline.');
                return;
            }
            const deadline = { id: Date.now().toString(), title, date, time, type: 'custom' };
            setDeadlines([...deadlines, deadline]);
            void scheduleNotificationForDeadline(deadline);
            void sendImmediateCreationEmail({
                itemName: title,
                itemType: 'deadline',
                date,
                time,
                email: user?.email || '',
            });
        }
    };
    useEffect(() => {
        const loadDashboardInsights = async () => {
            if (!user || !isDataLoaded)
                return;
            try {
                const response = await fetch('/api/dashboard-insights', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        events,
                        clubs,
                        reminders,
                        deadlines,
                        plannerEntries,
                        attentionStats,
                    }),
                });
                if (!response.ok)
                    return;
                const data = (await response.json());
                setLearnedInsights(data.insights ?? []);
            }
            catch {
                setLearnedInsights([]);
            }
        };
        void loadDashboardInsights();
    }, [user, isDataLoaded, clubs, events, reminders, deadlines, plannerEntries, attentionStats, messages.length]);
    if (authLoading) {
        return (<div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>);
    }
    if (!user) {
        return (<div className="campus-shell min-h-screen px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="campus-panel-strong rounded-[2rem] p-8 text-white sm:p-10">
            <div className="campus-kicker">Role-Based Access</div>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold sm:text-5xl">Login or sign up for the right Smart Campus portal</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
              Student, teacher, and admin access each have their own flow now. Use the role cards to open the exact login or signup page you need.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link href="/auth?role=student&mode=signup" className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:bg-white/10">
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Student</div>
                <div className="mt-3 text-xl font-semibold text-white">Student Signup</div>
                <p className="mt-2 text-sm leading-6 text-white/65">Create a student account for planners, reminders, clubs, events, and campus chat.</p>
              </Link>
              <Link href="/auth?role=teacher&mode=signup" className="rounded-[1.5rem] border border-emerald-300/20 bg-emerald-500/10 p-5 transition hover:-translate-y-1 hover:bg-emerald-500/15">
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">Teacher</div>
                <div className="mt-3 text-xl font-semibold text-white">Teacher Signup</div>
                <p className="mt-2 text-sm leading-6 text-white/65">Sign up with email, phone verification, and employee ID to enter review.</p>
              </Link>
              <Link href="/auth?role=admin&mode=login" className="rounded-[1.5rem] border border-amber-300/20 bg-amber-500/10 p-5 transition hover:-translate-y-1 hover:bg-amber-500/15">
                <div className="text-xs uppercase tracking-[0.2em] text-amber-200/80">Admin</div>
                <div className="mt-3 text-xl font-semibold text-white">Admin Login</div>
                <p className="mt-2 text-sm leading-6 text-white/65">Open the admin login screen for the provisioned account and assigned Admin ID.</p>
              </Link>
              <Link href="/auth?role=club" className="rounded-[1.5rem] border border-purple-300/20 bg-purple-500/10 p-5 transition hover:-translate-y-1 hover:bg-purple-500/15">
                <div className="text-xs uppercase tracking-[0.2em] text-purple-200/80">Club</div>
                <div className="mt-3 text-xl font-semibold text-white">Club Login</div>
                <p className="mt-2 text-sm leading-6 text-white/65">Sign in with your Club Login ID and password to submit and track event proposals.</p>
              </Link>
            </div>
          </div>

          <div className="campus-panel rounded-[2rem] border border-white/10 bg-black/35 p-8 text-white sm:p-10">
            <div className="text-xs uppercase tracking-[0.2em] text-white/45">Quick Access</div>
            <div className="mt-4 space-y-4">
              <Link href="/auth?role=student&mode=login" className="flex items-center justify-between rounded-[1.3rem] border border-white/10 bg-white/5 px-5 py-4 transition hover:bg-white/10">
                <div>
                  <div className="text-sm font-semibold text-white">Student Login</div>
                  <div className="mt-1 text-sm text-white/60">Return to your planner, reminders, and student workspace.</div>
                </div>
                <span className="text-cyan-300">Open</span>
              </Link>
              <Link href="/auth?role=teacher&mode=login" className="flex items-center justify-between rounded-[1.3rem] border border-white/10 bg-white/5 px-5 py-4 transition hover:bg-white/10">
                <div>
                  <div className="text-sm font-semibold text-white">Teacher Login</div>
                  <div className="mt-1 text-sm text-white/60">Approved teachers can sign in here and open the teaching dashboard.</div>
                </div>
                <span className="text-emerald-300">Open</span>
              </Link>
              <Link href="/auth?role=admin&mode=login" className="flex items-center justify-between rounded-[1.3rem] border border-white/10 bg-white/5 px-5 py-4 transition hover:bg-white/10">
                <div>
                  <div className="text-sm font-semibold text-white">Admin Login</div>
                  <div className="mt-1 text-sm text-white/60">Use the single admin account credentials and Admin ID from this portal.</div>
                </div>
                <span className="text-amber-300">Open</span>
              </Link>
              <Link href="/auth?role=club" className="flex items-center justify-between rounded-[1.3rem] border border-purple-400/20 bg-purple-500/10 px-5 py-4 transition hover:bg-purple-500/15">
                <div>
                  <div className="text-sm font-semibold text-white">Club Login</div>
                  <div className="mt-1 text-sm text-white/60">Sign in with your Club Login ID to submit and manage event proposals.</div>
                </div>
                <span className="text-purple-300">Open</span>
              </Link>
            </div>
            <div className="mt-8 rounded-[1.4rem] border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">What each role can do</div>
              <div className="mt-3 space-y-2 text-sm text-white/70">
                <div>Students: planning, reminders, clubs, deadlines, events, campus navigation, and chat.</div>
                <div>Teachers: course management, announcements, lesson plans, grading, and student progress.</div>
                <div>Admins: teacher approval, session visibility, user oversight, and audit monitoring.</div>
                <div>Clubs: submit event proposals, track coordinator and admin approval status.</div>
              </div>
            </div>
          </div>
        </div>
      </div>);
    }
    if (accountRole === 'admin') {
        return (<AdminDashboard displayName={displayName} onSignOut={signOut} profile={userProfile}/>);
    }
    if (accountRole === 'teacher') {
        if (!isTeacherApproved) {
            return (<TeacherPendingPanel onSignOut={signOut} profile={userProfile} request={teacherVerificationRequest} requestLoading={teacherVerificationLoading} requestError={teacherVerificationError} onSubmitRequest={submitTeacherVerificationRequest}/>);
        }
        return (<TeacherDashboard displayName={displayName} onSignOut={signOut} profile={userProfile} teacherWorkspace={teacherWorkspace} setTeacherWorkspace={setTeacherWorkspace} verificationStatus={effectiveTeacherVerificationStatus}/>);
    }
    return (<div className="campus-shell min-h-screen pb-10">
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
        <div className="campus-panel-strong campus-grid overflow-hidden rounded-[2rem] px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-xl flex items-center justify-center text-2xl">🎓</div>
              <div>
                <div className="campus-kicker mb-2">Student Operating System</div>
                <h1 className="text-3xl font-bold text-white sm:text-4xl">Smart Campus AI</h1>
                <p className="mt-1 max-w-2xl text-sm text-white/65 sm:text-base">A calmer, smarter command center for classes, clubs, campus navigation, and student momentum.</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="campus-panel rounded-[1.4rem] px-4 py-3 text-right text-sm text-white/80">
                <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-white/45">Signed In</div>
                <div className="text-white">{displayName}</div>
                <div>@{username}</div>
              </div>
              <button onClick={() => setIsNavMenuOpen((value) => !value)} className="flex items-center justify-center gap-3 rounded-[1.1rem] border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15">
                <span className="flex flex-col gap-1">
                  <span className="h-0.5 w-5 rounded-full bg-white"/>
                  <span className="h-0.5 w-5 rounded-full bg-white"/>
                  <span className="h-0.5 w-5 rounded-full bg-white"/>
                </span>
                <span>Menu</span>
              </button>
              <button onClick={() => signOut()} className="rounded-full border border-red-300/20 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-100 transition hover:bg-red-500/20">
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="campus-panel rounded-[1.75rem] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="campus-kicker">Current Section</div>
              <div className="mt-2 text-2xl font-bold text-white">{TAB_LABELS[activeTab]}</div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
                {attendedEventsCount} events
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
                {joinedClubsCount} clubs
              </div>
              <button onClick={() => selectTab('profile')} className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20">
                Open Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {isNavMenuOpen && (<div className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm" onClick={() => setIsNavMenuOpen(false)}>
          <div className="absolute right-4 top-24 max-h-[calc(100vh-7rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-[1.8rem] border border-white/10 bg-slate-950/95 p-4 shadow-2xl sm:right-6 lg:right-8" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 rounded-[1.35rem] border border-white/10 bg-white/5 p-4 text-white">
              <div className="text-xs uppercase tracking-[0.22em] text-white/45">Student Menu</div>
              <div className="mt-2 text-lg font-semibold">{displayName}</div>
              <div className="text-sm text-white/60">@{username}</div>
            </div>
            <div className="grid gap-2">
              {APP_TABS.map((tab) => (<button key={tab} onClick={() => selectTab(tab)} className={`rounded-[1rem] px-4 py-3 text-left text-sm font-medium transition flex items-center justify-between gap-2 ${activeTab === tab ? 'campus-button text-white' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}>
                  <span>{TAB_LABELS[tab]}</span>
                  {tab === 'notices' && <NoticeBellBadge />}
                </button>))}
            </div>
          </div>
        </div>)}

        <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          {dataLoadError && (<div className="mb-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-red-100 backdrop-blur-md">
              <div className="font-semibold">Unable to sync with Supabase right now.</div>
              <div className="mt-1 text-sm text-red-100/80">{dataLoadError}</div>
            </div>)}
        {activeTab === 'chat' && (<div className="space-y-4">
            <div className="campus-panel flex gap-2 rounded-[1.5rem] p-2">
              <button onClick={() => setChatMode('assistant')} className={`rounded-[1rem] px-5 py-3 text-sm font-medium transition ${chatMode === 'assistant' ? 'campus-button text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
                AI Assistant
              </button>
              <button onClick={() => setChatMode('campus')} className={`rounded-[1rem] px-5 py-3 text-sm font-medium transition ${chatMode === 'campus' ? 'campus-button text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
                Campus Chat
              </button>
            </div>

            {chatMode === 'assistant' ? (<div className="campus-panel-strong overflow-hidden rounded-[2rem]">
                <div className="flex flex-col" style={{ height: '70vh' }}>
                <div className="border-b border-white/10 px-6 py-5">
                  <div className="campus-kicker">Academic Copilot</div>
                  <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white">AI Assistant</h2>
                      <p className="text-sm text-white/55">Research help, study guidance, reminders, and campus planning in one focused thread.</p>
                    </div>
                    <div className="campus-chip text-xs">
                      <span className="text-cyan-300">●</span>
                      <span>{visibleInsights.length > 0 ? `${visibleInsights.length} learned signals` : 'Learning your routine'}</span>
                    </div>
                  </div>
                </div>
                <div className="campus-scroll flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.map((msg, idx) => (<div key={idx}>
                      <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-[1.5rem] px-5 py-4 shadow-xl ${msg.role === 'user' ? 'campus-button text-white' : 'campus-soft-card text-white backdrop-blur-sm'}`}>
                          {msg.imagePreviewUrl && (<Image src={msg.imagePreviewUrl} alt="Uploaded context" width={640} height={360} unoptimized className="mb-3 max-h-64 w-full rounded-xl object-cover"/>)}
                          {renderMessageContent(msg.content)}
                          {msg.memoriesUsed && msg.memoriesUsed > 0 && (<p className="text-xs mt-2 opacity-70">💭 {msg.memoriesUsed} memories</p>)}
                        </div>
                      </div>
                      {msg.role === 'assistant' && msg.sources?.length > 0 && (
                        <div className="flex justify-start mt-1 ml-2">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="text-[10px] text-white/35 uppercase tracking-widest">?? Based on:</span>
                            {msg.sources.map((src, si) => (
                              <span key={si} className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-medium text-cyan-300">
                                {src.title || src.source}
                                <span className="text-cyan-400/50">� {Math.round((src.similarity || 0) * 100)}%</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {msg.action && pendingAction && (<div className="flex justify-start mt-2">
                          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl px-4 py-3 flex gap-3">
                            <button onClick={confirmAction} className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600">
                              ✓ Confirm
                            </button>
                            <button onClick={cancelAction} className="px-4 py-2 bg-red-500/80 text-white rounded-lg font-medium hover:bg-red-600">
                              ✗ Cancel
                            </button>
                          </div>
                        </div>)}
                    </div>))}
                  {loading && (<div className="flex justify-start">
                      <div className="bg-white/10 rounded-2xl px-5 py-3">
                        <div className="flex gap-2">
                          {[0, 150, 300].map(delay => (<div key={delay} className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }}></div>))}
                        </div>
                      </div>
                    </div>)}
                  <div ref={messagesEndRef}/>
                </div>
                <div className="border-t border-white/10 bg-black/20 p-4 backdrop-blur-md">
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload}/>
                  {uploadedImage && (<div className="campus-soft-card mb-3 flex items-center gap-3 rounded-[1.2rem] p-3">
                      <Image src={uploadedImage.dataUrl} alt={uploadedImage.name} width={56} height={56} unoptimized className="h-14 w-14 rounded-lg object-cover"/>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm text-white">{uploadedImage.name}</div>
                        <div className="text-xs text-white/60">Image will be sent with your next message.</div>
                      </div>
                      <button onClick={() => setUploadedImage(null)} className="rounded-lg bg-red-500/20 px-3 py-2 text-xs text-red-100">
                        Remove
                      </button>
                    </div>)}
                  <div className="flex gap-3">
                    <button onClick={triggerImagePicker} disabled={loading} className="rounded-[1rem] border border-white/20 bg-white/10 px-4 py-3 text-white hover:bg-white/15 disabled:opacity-50">
                      Image
                    </button>
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="Try: 'Explain binary search', 'Help me research AI ethics', or 'Set reminder for AI Workshop'" className="campus-input flex-1 rounded-[1rem] px-5 py-3 placeholder-white/45" disabled={loading}/>
                    <button onClick={handleSend} disabled={loading || (!input.trim() && !uploadedImage)} className="campus-button rounded-[1rem] px-8 py-3 font-medium text-white disabled:opacity-50">Send</button>
                  </div>
                </div>
              </div>
              </div>) : (<CampusChatPanel userId={user.id} userEmail={user.email || ''}/>)}
          </div>)}

        {activeTab === 'planner' && (<SmartPlannerTab attentionLevel={attentionLevel} attendedEventsCount={attendedEventsCount} focusRatio={focusRatio} guidance={plannerData.guidance} highRiskItems={plannerData.highRiskItems} onDeletePlannerEntry={removePlannerEntry} onItemAction={handlePlannerItemAction} onSavePlannerEntry={savePlannerEntry} onSelectTab={selectTab} onTogglePlannerEntryCompletion={togglePlannerEntryCompletion} openDeadlinesCount={openDeadlinesCount} plannerWeekData={plannerWeekData} todayItems={plannerData.todayItems} upcomingRemindersCount={upcomingRemindersCount} weekItems={plannerData.weekItems}/>)}

        {activeTab === 'attendance' && (<StudentAttendanceTab userId={user.id}/>)}

        {activeTab === 'notices' && (
            <div className="campus-panel rounded-[1.8rem] p-6">
                <NoticeBoard role="student" />
            </div>
        )}

        {activeTab === 'issues' && (<IssueReportingTab reportedIssues={reportedIssues} issueNotificationPreferences={issueNotificationPreferences} issuesLoading={issuesLoading} issueError={issueError} onCreateIssue={createIssueReport} onUpdateIssuePreferences={updateIssuePreferences} onRateIssueSatisfaction={rateIssueSatisfaction} onRefreshIssues={refreshIssueCenter}/>)}
        {activeTab === 'events' && (<div className="space-y-4">
            <div className="campus-panel rounded-[1.5rem] p-3 flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2">
                <button onClick={() => setClubEventsTab('open')} className={`rounded-[1rem] px-4 py-2.5 text-sm font-medium transition ${clubEventsTab === 'open' ? 'campus-button text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'}`}>
                  🎟️ Open Registration
                </button>
                <button onClick={() => setClubEventsTab('live')} className={`rounded-[1rem] px-4 py-2.5 text-sm font-medium transition ${clubEventsTab === 'live' ? 'campus-button text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'}`}>
                  🔴 Upcoming &amp; Live
                </button>
              </div>
              <button onClick={async () => {
                const res = await fetch('/api/events/published');
                if (res.ok) { const d = await res.json(); setClubEventsData({ ...d, loaded: true }); }
              }} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white">Refresh</button>
            </div>

            {/* Lazy load club events */}
            {!clubEventsData.loaded && activeTab === 'events' && (() => {
              fetch('/api/events/published').then(r => r.json()).then(d => setClubEventsData({ ...d, loaded: true })).catch(() => {});
              return null;
            })()}

            {clubEventsTab === 'open' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white">Open Registration Events</h2>
                  <div className="text-sm text-white/50">{clubEventsData.open_registration?.length || 0} events available</div>
                </div>
                {(clubEventsData.open_registration || []).length === 0 ? (
                  <div className="campus-panel rounded-[1.7rem] p-12 text-center text-white/50">
                    <div className="text-5xl mb-3">🎟️</div>
                    <p>No events open for registration right now.</p>
                    <p className="text-sm mt-2 text-white/35">Check back soon or look at the Upcoming &amp; Live tab.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(clubEventsData.open_registration || []).map(event => (
                      <div key={event.id} className="campus-panel rounded-[1.7rem] p-6 transition-all hover:-translate-y-1 hover:border-cyan-300/35">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-lg font-bold text-white">{event.title}</h3>
                          <span className="px-2 py-1 bg-cyan-500/20 text-cyan-200 rounded-full text-xs border border-cyan-400/30">Open</span>
                        </div>
                        {event.description && <p className="text-white/60 text-sm mb-3">{event.description}</p>}
                        <div className="space-y-1 text-sm text-white/60 mb-4">
                          <div>📅 {event.proposed_date} · {event.time_start} – {event.time_end}</div>
                          {event.venue && <div>📍 {event.venue}</div>}
                          <div>🏛️ {event.club?.club_name}</div>
                          <div>👥 {event.registration_count} registered</div>
                        </div>
                        <button
                          disabled={event.user_registered}
                          onClick={async () => {
                            if (event.user_registered) return;
                            if (!userProfile?.roll_number || !userProfile?.course || !userProfile?.branch) {
                              alert("Please complete your profile (roll no, course, branch) in the Profile tab to register for events.");
                              return;
                            }
                            const res = await fetch(`/api/events/${event.id}/register`, { method: 'POST' });
                            if (res.ok) {
                              setClubEventsData(prev => ({
                                ...prev,
                                open_registration: prev.open_registration.map(e => e.id === event.id ? { ...e, user_registered: true, registration_count: e.registration_count + 1 } : e),
                              }));
                            }
                          }}
                          className={`w-full py-2.5 rounded-[1rem] font-medium text-sm transition ${event.user_registered ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 cursor-default' : 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90'}`}
                        >
                          {event.user_registered ? '✓ Registered' : 'Register Now'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {clubEventsTab === 'live' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white">Upcoming &amp; Live Events</h2>
                  <div className="text-sm text-white/50">{clubEventsData.upcoming_live?.length || 0} events</div>
                </div>
                {(clubEventsData.upcoming_live || []).length === 0 ? (
                  <div className="campus-panel rounded-[1.7rem] p-12 text-center text-white/50">
                    <div className="text-5xl mb-3">🔴</div>
                    <p>No live or imminent events right now.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(clubEventsData.upcoming_live || []).map(event => {
                      const badge = event.is_today ? { label: 'Today 🔴', color: 'bg-red-500/25 text-red-200 border-red-400/30' }
                        : event.is_past ? { label: 'Ongoing', color: 'bg-purple-500/25 text-purple-200 border-purple-400/30' }
                        : { label: 'Coming Soon', color: 'bg-amber-500/20 text-amber-200 border-amber-400/30' };
                      return (
                        <div key={event.id} className="campus-panel rounded-[1.7rem] p-6 transition-all hover:-translate-y-1">
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="text-lg font-bold text-white">{event.title}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs border ${badge.color}`}>{badge.label}</span>
                          </div>
                          {event.description && <p className="text-white/60 text-sm mb-3">{event.description}</p>}
                          <div className="space-y-1 text-sm text-white/60 mb-4">
                            <div>📅 {event.proposed_date} · {event.time_start} – {event.time_end}</div>
                            {event.venue && <div>📍 {event.venue}</div>}
                            <div>🏛️ {event.club?.club_name}</div>
                            <div>👥 {event.registration_count} registered</div>
                          </div>
                          {event.user_registered ? (
                            <div className="rounded-[1rem] bg-emerald-500/15 border border-emerald-400/25 px-4 py-2 text-sm text-emerald-300 text-center">✓ You are registered</div>
                          ) : !event.is_past && (
                            <button
                              onClick={async () => {
                                if (!userProfile?.roll_number || !userProfile?.course || !userProfile?.branch) {
                                  alert("Please complete your profile (roll no, course, branch) in the Profile tab to register for events.");
                                  return;
                                }
                                const res = await fetch(`/api/events/${event.id}/register`, { method: 'POST' });
                                if (res.ok) {
                                  setClubEventsData(prev => ({
                                    ...prev,
                                    upcoming_live: prev.upcoming_live.map(e => e.id === event.id ? { ...e, user_registered: true, registration_count: e.registration_count + 1 } : e),
                                  }));
                                }
                              }}
                              className="w-full py-2.5 rounded-[1rem] font-medium text-sm transition bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90"
                            >
                              Register Now
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>)}

        {activeTab === 'clubs' && (<div className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-6">Student Clubs</h2>
            <div className="grid grid-cols-2 gap-4">
              {clubs.map((club) => (<div key={club.id} className="campus-panel rounded-[1.7rem] p-6 transition-all hover:-translate-y-1 hover:border-cyan-300/35">
                  <h3 className="text-xl font-bold text-white mb-2">{club.name}</h3>
                  <p className="text-white/60 text-sm mb-4">{club.description}</p>
                  <button onClick={() => club.joined ? void handleJoinClub(club.id) : openClubJoinConfirmation(club.id)} className={`w-full py-2 rounded-lg font-medium ${club.joined ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'}`}>{club.joined ? '✓ Joined' : 'Join Club'}</button>
                </div>))}
            </div>
          </div>)}

        {activeTab === 'reminders' && (<div className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-6">My Reminders</h2>
            {reminders.length === 0 ? (<div className="campus-panel rounded-[1.7rem] p-12 text-center text-white/60">
                <div className="text-6xl mb-4">🔔</div>
                <p>No reminders yet</p>
                <p className="text-sm mt-2">{'Try saying "Set reminder for AI Workshop"'}</p>
              </div>) : (<div className="space-y-3">
                {reminders.map((reminder) => (<div key={reminder.id} className="campus-panel rounded-[1.35rem] p-4 flex justify-between items-center">
                    <div>
                      <h3 className="text-white font-medium">🔔 {reminder.eventName}</h3>
                      <p className="text-white/60 text-sm">{reminder.date} at {reminder.time}</p>
                    </div>
                        <button onClick={() => handleRemoveReminder(reminder.id)} className="px-4 py-2 bg-red-500/20 text-red-200 rounded-lg">Remove</button>
                  </div>))}
              </div>)}
          </div>)}

        {activeTab === 'deadlines' && (<div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">My Deadlines</h2>
              <button onClick={addDeadline} className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg">+ Add</button>
            </div>
            <div className="space-y-3">
              {deadlines.map((deadline) => (<div key={deadline.id} className="campus-panel rounded-[1.35rem] p-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-white font-medium">{deadline.title}</h3>
                    <p className="text-white/60 text-sm">Due: {deadline.date} at {deadline.time}</p>
                  </div>
                  <button onClick={() => handleToggleDeadlineCompletion(deadline.id)} className={`px-4 py-2 rounded-lg ${deadline.completed ? 'bg-green-500' : 'bg-white/10'} text-white`}>{deadline.completed ? '✓ Done' : 'Mark Done'}</button>
                </div>))}
            </div>
          </div>)}

        {activeTab === 'navigation' && (<div className="campus-panel-strong rounded-[2rem] p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Campus Navigation</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">📍 Where are you now?</h3>
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(CAMPUS_LOCATIONS).map(([key, loc]) => (<button key={`current-${key}`} onClick={() => {
                    setUserLocation(loc);
                    setCurrentLocationName(key);
                }} className={`py-3 rounded-lg font-medium transition-all text-sm ${currentLocationName === key
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    {currentLocationName === key && '📍 '}{key}
                  </button>))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">🎯 Where do you want to go?</h3>
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(CAMPUS_LOCATIONS).map(([key, loc]) => (<button key={`dest-${key}`} onClick={() => setSelectedDestination(loc)} className={`py-3 rounded-lg font-medium transition-all text-sm ${selectedDestination?.name === loc.name
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg'
                    : 'bg-white/10 text-white hover:bg-white/20'} ${currentLocationName === key ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={currentLocationName === key}>
                    {selectedDestination?.name === loc.name && '🎯 '}{key}
                  </button>))}
              </div>
              {currentLocationName && (<p className="text-sm text-white/50 mt-2">
                  💡 You cannot select your current location as destination
                </p>)}
            </div>
            
            {selectedDestination ? (<div className="space-y-4">
                <div className="bg-white/5 rounded-xl overflow-hidden" style={{ height: '500px' }}>
                  <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                    <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={{
                    lat: (userLocation.lat + selectedDestination.lat) / 2,
                    lng: (userLocation.lng + selectedDestination.lng) / 2
                }} zoom={16}>
                      <Marker position={userLocation} label="📍" icon={{
                    url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                }} title={`You are here: ${currentLocationName}`}/>
                      <Marker position={selectedDestination} label="🎯" icon={{
                    url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
                }} title={`Destination: ${selectedDestination.name}`}/>
                      <Polyline path={[
                    { lat: userLocation.lat, lng: userLocation.lng },
                    { lat: selectedDestination.lat, lng: selectedDestination.lng }
                ]} options={{
                    strokeColor: '#00D9FF',
                    strokeOpacity: 0.8,
                    strokeWeight: 4,
                    geodesic: true,
                }}/>
                    </GoogleMap>
                  </LoadScript>
                </div>
                
                <div className="campus-soft-card rounded-[1.5rem] p-6 backdrop-blur-sm">
                  <h3 className="text-xl font-bold text-white mb-3">📍 Navigation Info</h3>
                  <div className="space-y-2 text-white/80">
                    <p className="flex items-center gap-2">
                      <span className="text-2xl">🔵</span>
                      <span><strong>From:</strong> {currentLocationName}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-2xl">🔴</span>
                      <span><strong>To:</strong> {selectedDestination.name}</span>
                    </p>
                    <div className="pt-3 mt-3 border-t border-white/20">
                      <p className="text-sm text-white/60">
                        💡 Walk from the <strong className="text-blue-300">blue marker</strong> towards the <strong className="text-red-300">red marker</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>) : (<div className="bg-white/5 rounded-xl p-12 text-center text-white/60">
                <div className="text-6xl mb-4">🗺️</div>
                <p className="text-lg font-semibold">Select your current location and destination above</p>
                <p className="text-sm mt-2">{'Or ask me in chat: "Navigate to Library"'}</p>
              </div>)}
          </div>)}

        {activeTab === 'dashboard' && (<DashboardOverviewTab attentionLevel={attentionLevel} attentionReport={attentionReport} attentionScore={attentionScore} averageFocusPerVisitMs={averageFocusPerVisitMs} focusRatio={focusRatio} mostFocusedTab={mostFocusedTab} tabAttentionBreakdown={tabAttentionBreakdown} totalBackgroundMs={totalBackgroundMs} totalFocusedMs={totalFocusedMs} totalVisits={totalVisits} visibleInsights={visibleInsights}/>)}

        {activeTab === 'profile' && (<ProfileTab attendedEventsCount={attendedEventsCount} attentionLevel={attentionLevel} branch={profileBranch} course={profileCourse} displayName={displayName} focusRatio={focusRatio} fullName={fullName} isOnline={userProfile?.is_online ?? false} isSavingProfile={profileUpdateLoading} joinedClubsCount={joinedClubsCount} lastSeenLabel={lastSeenLabel} mostFocusedTab={mostFocusedTab} onSaveProfile={updateUserProfile} openDeadlinesCount={openDeadlinesCount} profileAge={profileAge} profileEmail={profileEmail} rollNumber={profileRollNumber} semester={profileSemester} totalFocusedMs={totalFocusedMs} upcomingRemindersCount={upcomingRemindersCount} userId={user.id} username={username} visibleInsights={visibleInsights}/>)}

        {activeTab === 'attention' && (<AttentionTab attentionLevel={attentionLevel} attentionReport={attentionReport} attentionScore={attentionScore} averageFocusPerVisitMs={averageFocusPerVisitMs} focusRatio={focusRatio} mostFocusedTab={mostFocusedTab} tabAttentionBreakdown={tabAttentionBreakdown} totalBackgroundMs={totalBackgroundMs} totalFocusedMs={totalFocusedMs} totalVisits={totalVisits}/>)}
      </div>
      {pendingClubJoinId && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-6 text-white shadow-2xl">
            <h3 className="text-xl font-bold">Confirm club join</h3>
            <p className="mt-3 text-sm text-white/70">
              Type <span className="font-semibold text-cyan-300">confirm</span> to mark that you have joined{' '}
              <span className="font-semibold text-white">{clubs.find((club) => club.id === pendingClubJoinId)?.name}</span>.
            </p>
            <input type="text" value={clubJoinConfirmation} onChange={(e) => setClubJoinConfirmation(e.target.value)} placeholder='Type "confirm"' className="mt-4 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-500"/>
            <div className="mt-5 flex gap-3">
              <button onClick={() => void handleJoinClub(pendingClubJoinId)} disabled={clubJoinConfirmation.trim().toLowerCase() !== 'confirm'} className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-3 font-medium text-white disabled:opacity-40">
                Confirm Join
              </button>
              <button onClick={closeClubJoinConfirmation} className="flex-1 rounded-xl bg-white/10 px-4 py-3 font-medium text-white">
                Cancel
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}
