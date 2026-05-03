'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createSupabaseAuthHeaders } from '@/lib/supabase/auth-fetch.js';
import { resolveAccountRole, resolveVerificationStatus } from '@/lib/smart-campus/roles.js';
const AuthContext = createContext(undefined);
const ACTIVE_TAB_IDS_KEY = 'smart-campus-active-tab-ids';
const LAST_TAB_CLOSED_AT_KEY = 'smart-campus-last-tab-closed-at';
const CURRENT_TAB_ID_KEY = 'smart-campus-current-tab-id';
const PENDING_TEACHER_SIGNUP_KEY = 'smart-campus-pending-teacher-signup';
function buildFallbackUsername(email, userId) {
    const base = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'student';
    return `${base}-${userId.slice(0, 4)}`;
}
function readUserMetadataString(user, key) {
    const value = user.user_metadata?.[key];
    return typeof value === 'string' ? value.trim() : '';
}
function readUserMetadataInteger(user, key) {
    const value = user.user_metadata?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
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
function isReloadNavigation() {
    if (typeof window === 'undefined' || typeof performance === 'undefined')
        return false;
    const navigationEntries = performance.getEntriesByType('navigation');
    const navigationEntry = navigationEntries[0];
    if (navigationEntry) {
        return navigationEntry.type === 'reload';
    }
    return false;
}
function readActiveTabIds() {
    if (typeof window === 'undefined')
        return [];
    try {
        const rawValue = window.localStorage.getItem(ACTIVE_TAB_IDS_KEY);
        if (!rawValue)
            return [];
        const parsedValue = JSON.parse(rawValue);
        return Array.isArray(parsedValue) ? parsedValue.filter((value) => typeof value === 'string') : [];
    }
    catch {
        return [];
    }
}
function writeActiveTabIds(tabIds) {
    if (typeof window === 'undefined')
        return;
    window.localStorage.setItem(ACTIVE_TAB_IDS_KEY, JSON.stringify(Array.from(new Set(tabIds))));
}
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [supabase] = useState(() => createClient());
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        const tabId = window.sessionStorage.getItem(CURRENT_TAB_ID_KEY) || crypto.randomUUID();
        window.sessionStorage.setItem(CURRENT_TAB_ID_KEY, tabId);
        const activeTabIds = readActiveTabIds();
        writeActiveTabIds([...activeTabIds, tabId]);
        const unregisterTab = () => {
            const remainingTabIds = readActiveTabIds().filter((id) => id !== tabId);
            writeActiveTabIds(remainingTabIds);
            if (remainingTabIds.length === 0) {
                window.localStorage.setItem(LAST_TAB_CLOSED_AT_KEY, String(Date.now()));
            }
        };
        window.addEventListener('pagehide', unregisterTab);
        return () => {
            window.removeEventListener('pagehide', unregisterTab);
            unregisterTab();
        };
    }, []);
    useEffect(() => {
        let isActive = true;
        const finalizeSession = async (session) => {
            if (!isActive)
                return;
            const lastTabClosedAt = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_TAB_CLOSED_AT_KEY) : null;
            const shouldClearSession = Boolean(lastTabClosedAt) &&
                !isReloadNavigation() &&
                readActiveTabIds().length <= 1;
            if (shouldClearSession && session) {
                window.localStorage.removeItem(LAST_TAB_CLOSED_AT_KEY);
                try {
                    await supabase.auth.signOut();
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown sign out error.';
                    console.error('Failed to clear recovered auth session:', message);
                }
                if (!isActive)
                    return;
                setUser(null);
                setLoading(false);
                return;
            }
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(LAST_TAB_CLOSED_AT_KEY);
            }
            setUser(session?.user ?? null);
            setLoading(false);
        };
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION') {
                void finalizeSession(session);
                return;
            }
            if (!isActive)
                return;
            const nextUser = session?.user ?? null;
            setUser(nextUser);
            setLoading(false);
            if (typeof window !== 'undefined' && nextUser) {
                window.localStorage.removeItem(LAST_TAB_CLOSED_AT_KEY);
            }
        });
        return () => {
            isActive = false;
            subscription.unsubscribe();
        };
    }, [supabase]);
    useEffect(() => {
        const ensureProfile = async () => {
            if (!user)
                return;
            const email = user.email || '';
            const pendingTeacherSignup = readPendingTeacherSignup();
            const matchingPendingTeacherSignup = pendingTeacherSignup &&
                pendingTeacherSignup.role === 'teacher' &&
                (pendingTeacherSignup.userId === user.id || pendingTeacherSignup.email === email)
                ? pendingTeacherSignup
                : null;
            const fallbackUsername = buildFallbackUsername(email, user.id);
            const metadataName = readUserMetadataString(user, 'name');
            const displayName = matchingPendingTeacherSignup?.name?.trim() || metadataName || email.split('@')[0] || fallbackUsername;
            const role = resolveAccountRole(null, user);
            const verificationStatus = resolveVerificationStatus(null, user);
            const phoneNumber = matchingPendingTeacherSignup?.phoneNumber?.trim() || readUserMetadataString(user, 'phoneNumber') || null;
            const phoneVerified = matchingPendingTeacherSignup
                ? Boolean(matchingPendingTeacherSignup.phoneVerified)
                : Boolean(user.user_metadata?.phoneVerified);
            const employeeId = matchingPendingTeacherSignup?.employeeId?.trim() || readUserMetadataString(user, 'employeeId') || null;
            const employeeIdImageName = matchingPendingTeacherSignup?.employeeIdImageName?.trim() || readUserMetadataString(user, 'employeeIdImageName') || 'employee-id';
            const employeeIdImageData = matchingPendingTeacherSignup?.employeeIdImageData?.trim() || readUserMetadataString(user, 'employeeIdImageData') || null;
            const rollNumber = readUserMetadataString(user, 'rollNumber') || null;
            const course = readUserMetadataString(user, 'course') || null;
            const branch = readUserMetadataString(user, 'branch') || null;
            const semester = readUserMetadataInteger(user, 'semester');
            try {
                const authHeaders = await createSupabaseAuthHeaders(supabase);
                const response = await fetch('/api/profile/provision', {
                    method: 'POST',
                    headers: {
                        ...Object.fromEntries(authHeaders.entries()),
                        'Content-Type': 'application/json',
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        email,
                        fallbackUsername,
                        displayName,
                        fullName: metadataName || null,
                        age: typeof user.user_metadata?.age === 'number' ? user.user_metadata.age : null,
                        role,
                        verificationStatus,
                        phoneNumber,
                        phoneVerified,
                        employeeId,
                        rollNumber,
                        course,
                        branch,
                        semester,
                        adminId: readUserMetadataString(user, 'adminId') || null,
                        isOnline: false,
                    }),
                });
                const payload = await response.json();
                if (!response.ok) {
                    console.error('Failed to sync profile:', payload.error || 'Failed to provision profile.');
                    return;
                }
                
                const finalVerificationStatus = payload.profile?.verification_status || verificationStatus;

                if (role === 'teacher' && finalVerificationStatus !== 'approved' && employeeId) {
                    const verificationResponse = await fetch('/api/auth/teacher-verification-request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                            fullName: displayName,
                            phoneNumber,
                            employeeId,
                            employeeIdImageName,
                            employeeIdImageData,
                        }),
                    });
                    if (!verificationResponse.ok) {
                        const payload = await verificationResponse.json().catch(() => ({ error: 'Failed to sync teacher verification request.' }));
                        console.error('Failed to sync teacher verification request:', payload.error || 'Request failed.');
                    }
                    else {
                        clearPendingTeacherSignup();
                    }
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown profile sync error.';
                console.error('Failed to sync profile:', message);
            }
        };
        void ensureProfile();
    }, [supabase, user]);
    const signUp = async ({ name, age, email, password, role, phoneNumber, phoneVerified, employeeId, employeeIdImageData, employeeIdImageName, rollNumber, course, branch, semester }) => {
        return await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: name.trim(),
                    age,
                    role,
                    phoneNumber: phoneNumber || null,
                    phoneVerified: Boolean(phoneVerified),
                    employeeId: employeeId || null,
                    employeeIdImageName: employeeIdImageName || null,
                    rollNumber: rollNumber || null,
                    course: course || null,
                    branch: branch || null,
                    semester: semester || null,
                    verification_status: role === 'teacher' ? 'pending' : 'approved',
                },
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };
    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { data, error };
    };
    const signOut = async () => {
        await supabase.auth.signOut();
    };
    const resendConfirmation = async (email) => {
        return await supabase.auth.resend({
            type: 'signup',
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };
    return (<AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, resendConfirmation }}>
      {children}
    </AuthContext.Provider>);
}
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
