export const ACCOUNT_ROLES = [
    { id: 'student', label: 'Student' },
    { id: 'teacher', label: 'Teacher' },
    { id: 'admin', label: 'Admin' },
    { id: 'club', label: 'Club' },
];

const PUBLIC_EMAIL_DOMAINS = new Set([
    'gmail.com',
    'outlook.com',
    'hotmail.com',
    'yahoo.com',
    'icloud.com',
    'proton.me',
    'protonmail.com',
]);

export function isUniversityEmail(email) {
    const normalizedEmail = `${email || ''}`.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
        return false;
    }
    const [, domain = ''] = normalizedEmail.split('@');
    const configuredDomain = `${process.env.NEXT_PUBLIC_UNIVERSITY_EMAIL_DOMAIN || ''}`.trim().toLowerCase();
    if (configuredDomain) {
        return domain === configuredDomain || domain.endsWith(`.${configuredDomain}`);
    }
    return Boolean(domain) && !PUBLIC_EMAIL_DOMAINS.has(domain) && /\.(edu|ac\.in|edu\.in)$/i.test(domain);
}

export function resolveAccountRole(profile, user) {
    const profileRole = typeof profile?.role === 'string' ? profile.role : '';
    const metadataRole = typeof user?.user_metadata?.role === 'string' ? user.user_metadata.role : '';
    return profileRole || metadataRole || 'student';
}

export function resolveVerificationStatus(profile, user) {
    const profileStatus = typeof profile?.verification_status === 'string' ? profile.verification_status : '';
    const metadataStatus = typeof user?.user_metadata?.verification_status === 'string' ? user.user_metadata.verification_status : '';
    return profileStatus || metadataStatus || (resolveAccountRole(profile, user) === 'teacher' ? 'pending' : 'approved');
}

export function isTeacherApproved(profile, user) {
    return resolveAccountRole(profile, user) === 'teacher' && resolveVerificationStatus(profile, user) === 'approved';
}

export function isAdminAccount(profile, user) {
    return resolveAccountRole(profile, user) === 'admin';
}
