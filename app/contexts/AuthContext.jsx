'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resolveAccountRole, resolveVerificationStatus } from '@/lib/smart-campus/roles.js';
import { isMissingSchemaTableError, withMissingColumnFallback } from '@/lib/supabase/schema-compat.js';
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
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (error) {
                    console.error('Failed to check profile:', error.message);
                    return;
                }
                if (!data) {
                    const profileInsert = {
                        user_id: user.id,
                        username: fallbackUsername,
                        display_name: displayName,
                        full_name: metadataName || null,
                        age: typeof user.user_metadata?.age === 'number' ? user.user_metadata.age : null,
                        email: email || null,
                        role,
                        verification_status: verificationStatus,
                        phone_number: phoneNumber,
                        phone_verified: phoneVerified,
                        employee_id: employeeId,
                        roll_number: rollNumber,
                        course,
                        branch,
                        semester,
                        admin_id: readUserMetadataString(user, 'adminId') || null,
                        is_online: false,
                    };
                    const { error: insertError } = await withMissingColumnFallback((nextProfileInsert) => supabase.from('profiles').insert(nextProfileInsert), profileInsert, ['age', 'roll_number', 'course', 'branch', 'semester']);
                    if (insertError && insertError.code !== '23505') {
                        console.error('Failed to create profile:', insertError.message);
                    }
                }
                if (data) {
                    const currentProfile = data;
                    const nextUsername = currentProfile.username?.trim() ? currentProfile.username : fallbackUsername;
                    const nextDisplayName = currentProfile.display_name?.trim() ? currentProfile.display_name : displayName;
                    const nextRole = currentProfile.role?.trim() ? currentProfile.role : role;
                    const nextVerificationStatus = currentProfile.verification_status?.trim() ? currentProfile.verification_status : verificationStatus;
                    const needsUpdate = currentProfile.username !== nextUsername ||
                        currentProfile.display_name !== nextDisplayName ||
                        currentProfile.role !== nextRole ||
                        currentProfile.verification_status !== nextVerificationStatus ||
                        currentProfile.phone_number !== phoneNumber ||
                        currentProfile.employee_id !== employeeId ||
                        currentProfile.roll_number !== rollNumber ||
                        currentProfile.course !== course ||
                        currentProfile.branch !== branch ||
                        currentProfile.semester !== semester ||
                        currentProfile.admin_id !== (readUserMetadataString(user, 'adminId') || null);
                    if (needsUpdate) {
                        const profileUpdate = {
                            username: nextUsername,
                            display_name: nextDisplayName,
                            role: nextRole,
                            verification_status: nextVerificationStatus,
                            phone_number: phoneNumber,
                            phone_verified: phoneVerified,
                            employee_id: employeeId,
                            roll_number: rollNumber,
                            course,
                            branch,
                            semester,
                            admin_id: readUserMetadataString(user, 'adminId') || null,
                        };
                        const { error: updateError } = await withMissingColumnFallback((nextProfileUpdate) => supabase
                            .from('profiles')
                            .update(nextProfileUpdate)
                            .eq('user_id', user.id), profileUpdate, ['roll_number', 'course', 'branch', 'semester']);
                        if (updateError) {
                            console.error('Failed to update profile:', updateError.message);
                        }
                    }
                }
                if (role === 'student' && rollNumber && course && branch && semester) {
                    const { error: studentUpsertError } = await supabase
                        .from('students')
                        .upsert({
                        user_id: user.id,
                        name: displayName,
                        roll_number: rollNumber,
                        course,
                        branch,
                        semester,
                    }, { onConflict: 'user_id' });
                    if (studentUpsertError) {
                        if (!isMissingSchemaTableError(studentUpsertError, 'students')) {
                            console.error('Failed to sync student record:', studentUpsertError.message);
                        }
                    }
                }
                const effectiveProfileRole = data?.role?.trim() ? data.role : role;
                const effectiveVerificationStatus = data?.verification_status?.trim() ? data.verification_status : verificationStatus;
                if (effectiveProfileRole === 'teacher' && effectiveVerificationStatus !== 'approved' && employeeId && employeeIdImageData) {
                    const response = await fetch('/api/auth/teacher-verification-request', {
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
                    if (!response.ok) {
                        const payload = await response.json().catch(() => ({ error: 'Failed to sync teacher verification request.' }));
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
                    employeeIdImageData: employeeIdImageData || null,
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
    return (<AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
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
