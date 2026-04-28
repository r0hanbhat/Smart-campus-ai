'use client';
import { useEffect, useRef, useState } from 'react';
import { getSampleClubs, getSampleEvents } from '@/lib/smart-campus/sample-data';
import { DEFAULT_ISSUE_NOTIFICATION_PREFERENCES } from '@/lib/smart-campus/issues.js';
import { createDefaultTeacherWorkspace } from '@/lib/smart-campus/teacher-workspace.js';
import { withMissingSelectColumnsFallback } from '@/lib/supabase/schema-compat.js';
import { toPersistedMessages } from '@/lib/smart-campus/utils';
const PENDING_TEACHER_SIGNUP_KEY = 'smart-campus-pending-teacher-signup';

function readPendingTeacherSignup() {
    if (typeof window === 'undefined') {
        return null;
    }
    try {
        const rawValue = window.localStorage.getItem(PENDING_TEACHER_SIGNUP_KEY);
        if (!rawValue) {
            return null;
        }
        const parsedValue = JSON.parse(rawValue);
        return parsedValue && typeof parsedValue === 'object' ? parsedValue : null;
    }
    catch {
        return null;
    }
}

function clearPendingTeacherSignup() {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.removeItem(PENDING_TEACHER_SIGNUP_KEY);
}

export function useUserStateSync({ user, authLoading, supabase }) {
    const [events, setEvents] = useState(getSampleEvents());
    const [clubs, setClubs] = useState(getSampleClubs());
    const [deadlines, setDeadlines] = useState([]);
    const [reminders, setReminders] = useState([]);
    const [plannerEntries, setPlannerEntries] = useState([]);
    const [teacherWorkspace, setTeacherWorkspace] = useState(createDefaultTeacherWorkspace());
    const [teacherVerificationRequest, setTeacherVerificationRequest] = useState(null);
    const [teacherVerificationLoading, setTeacherVerificationLoading] = useState(false);
    const [teacherVerificationError, setTeacherVerificationError] = useState('');
    const [profileUpdateLoading, setProfileUpdateLoading] = useState(false);
    const [reportedIssues, setReportedIssues] = useState([]);
    const [issueNotificationPreferences, setIssueNotificationPreferences] = useState(DEFAULT_ISSUE_NOTIFICATION_PREFERENCES);
    const [issuesLoading, setIssuesLoading] = useState(false);
    const [issueError, setIssueError] = useState('');
    const [messages, setMessages] = useState([]);
    const [userProfile, setUserProfile] = useState(null);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [dataLoadError, setDataLoadError] = useState(null);
    const lastSavedSnapshotRef = useRef('');
    useEffect(() => {
        const fetchProfile = async () => {
            if (!user)
                return;
            const fallbackUsername = `${user.email?.split('@')[0] || 'student'}-${user.id.slice(0, 4)}`;
            setUserProfile({
                user_id: user.id,
                username: fallbackUsername,
                display_name: typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()
                    ? user.user_metadata.name.trim()
                    : user.email?.split('@')[0] || fallbackUsername,
                full_name: typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()
                    ? user.user_metadata.name.trim()
                    : null,
                age: typeof user.user_metadata?.age === 'number'
                    ? user.user_metadata.age
                    : typeof user.user_metadata?.age === 'string'
                        ? Number.parseInt(user.user_metadata.age, 10) || null
                        : null,
                email: user.email || null,
                role: typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : 'student',
                verification_status: typeof user.user_metadata?.verification_status === 'string' ? user.user_metadata.verification_status : 'approved',
                phone_number: typeof user.user_metadata?.phoneNumber === 'string' ? user.user_metadata.phoneNumber : null,
                phone_verified: Boolean(user.user_metadata?.phoneVerified),
                employee_id: typeof user.user_metadata?.employeeId === 'string' ? user.user_metadata.employeeId : null,
                roll_number: typeof user.user_metadata?.rollNumber === 'string' ? user.user_metadata.rollNumber : null,
                course: typeof user.user_metadata?.course === 'string' ? user.user_metadata.course : null,
                branch: typeof user.user_metadata?.branch === 'string' ? user.user_metadata.branch : null,
                semester: typeof user.user_metadata?.semester === 'number'
                    ? user.user_metadata.semester
                    : typeof user.user_metadata?.semester === 'string'
                        ? Number.parseInt(user.user_metadata.semester, 10) || null
                        : null,
                admin_id: typeof user.user_metadata?.adminId === 'string' ? user.user_metadata.adminId : null,
                is_online: true,
                last_seen: new Date().toISOString(),
            });
            const profileColumns = [
                'user_id',
                'username',
                'display_name',
                'full_name',
                'age',
                'email',
                'role',
                'verification_status',
                'phone_number',
                'phone_verified',
                'employee_id',
                'roll_number',
                'course',
                'branch',
                'semester',
                'admin_id',
                'is_online',
                'last_seen',
                'jcufa_position',
            ];
            const { data, error } = await withMissingSelectColumnsFallback((nextColumns) => supabase
                .from('profiles')
                .select(nextColumns.join(', '))
                .eq('user_id', user.id)
                .maybeSingle(), profileColumns, ['age', 'role', 'verification_status', 'phone_number', 'phone_verified', 'employee_id', 'roll_number', 'course', 'branch', 'semester', 'admin_id', 'is_online', 'last_seen', 'jcufa_position']);

            if (error) {
                console.error('Failed to load user profile:', error.message);
                return;
            }
            if (data) {
                setUserProfile(data);
            }
        };
        void fetchProfile();
    }, [supabase, user]);
    useEffect(() => {
        const fetchTeacherVerificationRequest = async () => {
            if (!user) {
                setTeacherVerificationRequest(null);
                setTeacherVerificationError('');
                setTeacherVerificationLoading(false);
                return;
            }
            const fallbackRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : 'student';
            const profileRole = typeof userProfile?.role === 'string' ? userProfile.role : fallbackRole;
            const profileVerificationStatus = typeof userProfile?.verification_status === 'string' ? userProfile.verification_status : '';
            if (profileRole !== 'teacher') {
                setTeacherVerificationRequest(null);
                setTeacherVerificationError('');
                setTeacherVerificationLoading(false);
                return;
            }
            if (profileVerificationStatus === 'approved') {
                setTeacherVerificationRequest(null);
                setTeacherVerificationError('');
                setTeacherVerificationLoading(false);
                return;
            }
            setTeacherVerificationLoading(true);
            setTeacherVerificationError('');
            const response = await fetch('/api/auth/teacher-verification-request', {
                method: 'GET',
                credentials: 'same-origin',
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({ error: 'Failed to load teacher verification request.' }));
                const message = payload.error || 'Failed to load teacher verification request.';
                setTeacherVerificationError(message);
                console.error('Failed to load teacher verification request:', message);
                setTeacherVerificationLoading(false);
                return;
            }
            const payload = await response.json().catch(() => ({ request: null }));
            setTeacherVerificationRequest(payload.request || null);
            setTeacherVerificationError(payload.disabled ? 'Teacher verification is not available until the role panel schema is installed in Supabase.' : '');
            setTeacherVerificationLoading(false);
        };
        void fetchTeacherVerificationRequest();
    }, [supabase, user, userProfile]);

    const submitTeacherVerificationRequest = async (overrides = null) => {
        if (!user) {
            setTeacherVerificationError('You must be signed in to submit a teacher verification request.');
            return false;
        }
        const pendingTeacherSignup = readPendingTeacherSignup();
        const fullName = (typeof overrides?.fullName === 'string' && overrides.fullName.trim()) ||
            (typeof userProfile?.full_name === 'string' && userProfile.full_name.trim()) ||
            (typeof userProfile?.display_name === 'string' && userProfile.display_name.trim()) ||
            pendingTeacherSignup?.name?.trim() ||
            (typeof user.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : '') ||
            user.email?.split('@')[0] ||
            'Teacher';
        const phoneNumber = (typeof overrides?.phoneNumber === 'string' && overrides.phoneNumber.trim()) ||
            (typeof userProfile?.phone_number === 'string' && userProfile.phone_number.trim()) ||
            pendingTeacherSignup?.phoneNumber?.trim() ||
            (typeof user.user_metadata?.phoneNumber === 'string' ? user.user_metadata.phoneNumber.trim() : '');
        const employeeId = (typeof overrides?.employeeId === 'string' && overrides.employeeId.trim()) ||
            (typeof userProfile?.employee_id === 'string' && userProfile.employee_id.trim()) ||
            pendingTeacherSignup?.employeeId?.trim() ||
            (typeof user.user_metadata?.employeeId === 'string' ? user.user_metadata.employeeId.trim() : '');
        const employeeIdImageName = (typeof overrides?.employeeIdImageName === 'string' && overrides.employeeIdImageName.trim()) ||
            pendingTeacherSignup?.employeeIdImageName?.trim() ||
            (typeof user.user_metadata?.employeeIdImageName === 'string' ? user.user_metadata.employeeIdImageName.trim() : '') ||
            'employee-id';
        const employeeIdImageData = (typeof overrides?.employeeIdImageData === 'string' && overrides.employeeIdImageData.trim()) ||
            pendingTeacherSignup?.employeeIdImageData?.trim() ||
            (typeof user.user_metadata?.employeeIdImageData === 'string' ? user.user_metadata.employeeIdImageData.trim() : '');

        if (!phoneNumber || !employeeId || !employeeIdImageData) {
            setTeacherVerificationError('Missing teacher verification details. Please sign up again with phone verification and an employee ID image.');
            return false;
        }

        setTeacherVerificationLoading(true);
        setTeacherVerificationError('');
        const response = await fetch('/api/auth/teacher-verification-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                fullName,
                phoneNumber,
                employeeId,
                employeeIdImageName,
                employeeIdImageData,
            }),
        });
        const payload = await response.json().catch(() => ({ error: 'Failed to submit teacher verification request.' }));
        if (!response.ok) {
            setTeacherVerificationError(payload.error || 'Failed to submit teacher verification request.');
            setTeacherVerificationLoading(false);
            return false;
        }
        clearPendingTeacherSignup();
        setTeacherVerificationLoading(false);
        setTeacherVerificationError('');
        setTeacherVerificationRequest((current) => current ? {
            ...current,
            full_name: fullName,
            phone_number: phoneNumber,
            employee_id: employeeId,
            employee_id_image_name: employeeIdImageName,
            employee_id_image_data: employeeIdImageData,
            status: 'pending',
        } : current);
        const refreshResponse = await fetch('/api/auth/teacher-verification-request', {
            method: 'GET',
            credentials: 'same-origin',
        });
        const refreshPayload = await refreshResponse.json().catch(() => ({ request: null }));
        setTeacherVerificationRequest(refreshPayload.request || null);
        return true;
    };

    const updateUserProfile = async (updates) => {
        if (!user) {
            return { success: false, error: 'You must be signed in to update your profile.' };
        }

        setProfileUpdateLoading(true);
        try {
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(updates),
            });
            const payload = await response.json().catch(() => ({ error: 'Failed to update profile.' }));
            if (!response.ok) {
                return { success: false, error: payload.error || 'Failed to update profile.' };
            }
            if (payload.profile && typeof payload.profile === 'object') {
                setUserProfile(payload.profile);
            }
            return { success: true, profile: payload.profile || null };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update profile.',
            };
        }
        finally {
            setProfileUpdateLoading(false);
        }
    };
    useEffect(() => {
        const refreshIssueCenter = async () => {
            if (!user) {
                setReportedIssues([]);
                setIssueNotificationPreferences(DEFAULT_ISSUE_NOTIFICATION_PREFERENCES);
                setIssuesLoading(false);
                setIssueError('');
                return;
            }
            setIssuesLoading(true);
            setIssueError('');
            const response = await fetch('/api/issues/me', {
                method: 'GET',
                credentials: 'same-origin',
            });
            const payload = await response.json().catch(() => ({
                reportedIssues: [],
                notificationPreferences: DEFAULT_ISSUE_NOTIFICATION_PREFERENCES,
            }));
            if (!response.ok) {
                setIssueError(payload.error || 'Failed to load issue center.');
                setIssuesLoading(false);
                return;
            }
            setReportedIssues(Array.isArray(payload.reportedIssues) ? payload.reportedIssues : []);
            setIssueNotificationPreferences(payload.notificationPreferences && typeof payload.notificationPreferences === 'object'
                ? { ...DEFAULT_ISSUE_NOTIFICATION_PREFERENCES, ...payload.notificationPreferences }
                : DEFAULT_ISSUE_NOTIFICATION_PREFERENCES);
            setIssuesLoading(false);
        };
        void refreshIssueCenter();
    }, [user]);
    useEffect(() => {
        const fetchUserData = async () => {
            if (!user)
                return;
            setDataLoadError(null);
            try {
                const { data, error } = await supabase
                    .from('user_state')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (error) {
                    if (error.code === 'PGRST116') {
                        setEvents(getSampleEvents());
                        setClubs(getSampleClubs());
                        setDeadlines([]);
                        setReminders([]);
                        setPlannerEntries([]);
                        setTeacherWorkspace(createDefaultTeacherWorkspace());
                        setMessages([{
                                role: 'assistant',
                                content: `Hi ${user.email}! I'm your Smart Campus AI Assistant. I can help with campus tasks, reminders, deadlines, research, and study questions.`,
                            }]);
                        setIsDataLoaded(true);
                        return;
                    }
                    setDataLoadError(error.message || 'Failed to load your campus data from Supabase.');
                    setIsDataLoaded(false);
                    return;
                }
                if (data) {
                    setEvents(data.events || []);
                    setClubs(data.clubs || []);
                    setReminders(data.reminders || []);
                    setPlannerEntries(data.planner_entries || []);
                    setTeacherWorkspace(data.teacher_workspace || createDefaultTeacherWorkspace());
                    setDeadlines((data.deadlines || []).map((deadline) => ({
                        ...deadline,
                        time: deadline.time || '11:59 PM',
                    })));
                    setMessages((data.messages || [{
                            role: 'assistant',
                            content: `Welcome back ${user.email}! I'm ready to help.`,
                        }]));
                    setIsDataLoaded(true);
                    return;
                }
                setEvents(getSampleEvents());
                setClubs(getSampleClubs());
                setDeadlines([]);
                setReminders([]);
                setPlannerEntries([]);
                setTeacherWorkspace(createDefaultTeacherWorkspace());
                setMessages([{
                        role: 'assistant',
                        content: `Hi ${user.email}! I'm your Smart Campus AI Assistant. I can help with campus tasks, reminders, deadlines, research, and study questions.`,
                    }]);
                setIsDataLoaded(true);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to load your campus data from Supabase.';
                setDataLoadError(message);
                setIsDataLoaded(false);
            }
        };
        if (!authLoading && user) {
            void fetchUserData();
        }
    }, [user, authLoading, supabase]);
    const refreshIssueCenter = async () => {
        if (!user) {
            setReportedIssues([]);
            setIssueNotificationPreferences(DEFAULT_ISSUE_NOTIFICATION_PREFERENCES);
            return;
        }
        setIssuesLoading(true);
        setIssueError('');
        const response = await fetch('/api/issues/me', {
            method: 'GET',
            credentials: 'same-origin',
        });
        const payload = await response.json().catch(() => ({
            reportedIssues: [],
            notificationPreferences: DEFAULT_ISSUE_NOTIFICATION_PREFERENCES,
        }));
        if (!response.ok) {
            setIssueError(payload.error || 'Failed to load issue center.');
            setIssuesLoading(false);
            return;
        }
        setReportedIssues(Array.isArray(payload.reportedIssues) ? payload.reportedIssues : []);
        setIssueNotificationPreferences(payload.notificationPreferences && typeof payload.notificationPreferences === 'object'
            ? { ...DEFAULT_ISSUE_NOTIFICATION_PREFERENCES, ...payload.notificationPreferences }
            : DEFAULT_ISSUE_NOTIFICATION_PREFERENCES);
        setIssuesLoading(false);
    };
    const createIssueReport = async (payload) => {
        setIssuesLoading(true);
        setIssueError('');
        const response = await fetch('/api/issues/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                action: 'create',
                ...payload,
                reporterName: userProfile?.display_name || userProfile?.full_name || user?.email?.split('@')[0] || 'Student',
            }),
        });
        const data = await response.json().catch(() => ({ error: 'Failed to create issue.' }));
        if (!response.ok) {
            setIssueError(data.error || 'Failed to create issue.');
            setIssuesLoading(false);
            return false;
        }
        setReportedIssues(Array.isArray(data.reportedIssues) ? data.reportedIssues : []);
        setIssueNotificationPreferences(data.notificationPreferences && typeof data.notificationPreferences === 'object'
            ? { ...DEFAULT_ISSUE_NOTIFICATION_PREFERENCES, ...data.notificationPreferences }
            : DEFAULT_ISSUE_NOTIFICATION_PREFERENCES);
        setIssuesLoading(false);
        return true;
    };
    const updateIssuePreferences = async (nextPreferences) => {
        setIssuesLoading(true);
        setIssueError('');
        const response = await fetch('/api/issues/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                action: 'updatePreferences',
                notificationPreferences: nextPreferences,
            }),
        });
        const data = await response.json().catch(() => ({ error: 'Failed to update issue preferences.' }));
        if (!response.ok) {
            setIssueError(data.error || 'Failed to update issue preferences.');
            setIssuesLoading(false);
            return false;
        }
        setReportedIssues(Array.isArray(data.reportedIssues) ? data.reportedIssues : []);
        setIssueNotificationPreferences(data.notificationPreferences && typeof data.notificationPreferences === 'object'
            ? { ...DEFAULT_ISSUE_NOTIFICATION_PREFERENCES, ...data.notificationPreferences }
            : DEFAULT_ISSUE_NOTIFICATION_PREFERENCES);
        setIssuesLoading(false);
        return true;
    };
    const rateIssueSatisfaction = async ({ issueId, rating, comment = '' }) => {
        setIssuesLoading(true);
        setIssueError('');
        const response = await fetch('/api/issues/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                action: 'rateSatisfaction',
                issueId,
                rating,
                comment,
            }),
        });
        const data = await response.json().catch(() => ({ error: 'Failed to save satisfaction rating.' }));
        if (!response.ok) {
            setIssueError(data.error || 'Failed to save satisfaction rating.');
            setIssuesLoading(false);
            return false;
        }
        setReportedIssues(Array.isArray(data.reportedIssues) ? data.reportedIssues : []);
        setIssueNotificationPreferences(data.notificationPreferences && typeof data.notificationPreferences === 'object'
            ? { ...DEFAULT_ISSUE_NOTIFICATION_PREFERENCES, ...data.notificationPreferences }
            : DEFAULT_ISSUE_NOTIFICATION_PREFERENCES);
        setIssuesLoading(false);
        return true;
    };
    useEffect(() => {
        const saveUserData = async () => {
            if (!user || !isDataLoaded)
                return;
            const profileForSave = {
                eventsAttended: events.filter((event) => event.checkedIn).length,
                clubsJoined: clubs.filter((club) => club.joined).length,
            };
            const persistedMessages = toPersistedMessages(messages);
            const snapshot = JSON.stringify({
                events,
                clubs,
                reminders,
                deadlines,
                plannerEntries,
                teacherWorkspace,
                profile: profileForSave,
                messages: persistedMessages,
            });
            if (lastSavedSnapshotRef.current === snapshot) {
                return;
            }
            lastSavedSnapshotRef.current = snapshot;
            try {
                const savePayload = {
                    events,
                    clubs,
                    reminders,
                    deadlines,
                    plannerEntries,
                    teacherWorkspace,
                    profile: profileForSave,
                    messages: persistedMessages,
                };
                const response = await fetch('/api/user-state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify(savePayload),
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({ error: 'Failed to save your campus data to Supabase.' }));
                    lastSavedSnapshotRef.current = '';
                    console.error('SUPABASE SAVE ERROR:', payload.error, payload.hint ?? null);
                }
            }
            catch (error) {
                lastSavedSnapshotRef.current = '';
                const message = error instanceof Error ? error.message : 'Failed to save your campus data to Supabase.';
                console.error('SUPABASE SAVE ERROR:', message);
            }
        };
        const timeoutId = window.setTimeout(() => {
            void saveUserData();
        }, 1500);
        return () => window.clearTimeout(timeoutId);
    }, [clubs, deadlines, events, isDataLoaded, messages, plannerEntries, reminders, supabase, teacherWorkspace, user]);
    return {
        events,
        setEvents,
        clubs,
        setClubs,
        deadlines,
        setDeadlines,
        reminders,
        setReminders,
        plannerEntries,
        setPlannerEntries,
        teacherWorkspace,
        setTeacherWorkspace,
        messages,
        setMessages,
        userProfile,
        teacherVerificationRequest,
        teacherVerificationLoading,
        teacherVerificationError,
        submitTeacherVerificationRequest,
        profileUpdateLoading,
        updateUserProfile,
        reportedIssues,
        issueNotificationPreferences,
        issuesLoading,
        issueError,
        createIssueReport,
        updateIssuePreferences,
        rateIssueSatisfaction,
        refreshIssueCenter,
        isDataLoaded,
        dataLoadError,
    };
}
