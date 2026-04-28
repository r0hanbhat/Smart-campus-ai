export const ISSUE_CATEGORIES = [
    'WiFi',
    'Classroom',
    'Cleanliness',
    'Transport',
    'Parking',
    'Cafeteria',
    'Library',
    'Hostel',
    'Security',
    'Medical',
    'Equipment',
    'Other',
];

export const ISSUE_PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];
export const ISSUE_STATUS_OPTIONS = ['submitted', 'triaged', 'assigned', 'in_progress', 'awaiting_student', 'resolved', 'closed'];

export const DEFAULT_ISSUE_NOTIFICATION_PREFERENCES = {
    inApp: true,
    email: true,
    sms: false,
};

export const ISSUE_CATEGORY_KEYWORDS = {
    WiFi: ['wifi', 'wi-fi', 'internet', 'network', 'router', 'connectivity', 'bandwidth'],
    Classroom: ['classroom', 'projector', 'board', 'bench', 'fan', 'ac', 'lecture', 'seat'],
    Cleanliness: ['clean', 'dirty', 'garbage', 'trash', 'washroom', 'restroom', 'hygiene', 'sanitation'],
    Transport: ['bus', 'transport', 'shuttle', 'pickup', 'drop', 'driver', 'route'],
    Parking: ['parking', 'car', 'bike', 'vehicle', 'slot', 'tow', 'traffic'],
    Cafeteria: ['cafeteria', 'canteen', 'food', 'meal', 'snack', 'kitchen', 'juice'],
    Library: ['library', 'book', 'reading', 'catalog', 'librarian', 'study hall'],
    Hostel: ['hostel', 'dorm', 'roommate', 'warden', 'mess', 'residence'],
    Security: ['security', 'guard', 'gate', 'theft', 'safety', 'harassment', 'trespass'],
    Medical: ['medical', 'doctor', 'clinic', 'dispensary', 'injury', 'ambulance', 'health'],
    Equipment: ['computer', 'printer', 'lab', 'equipment', 'device', 'monitor', 'keyboard', 'machine'],
    Other: [],
};

export const ISSUE_DEPARTMENT_BY_CATEGORY = {
    WiFi: 'IT Services',
    Classroom: 'Academic Operations',
    Cleanliness: 'Housekeeping',
    Transport: 'Transport Office',
    Parking: 'Security Operations',
    Cafeteria: 'Food Services',
    Library: 'Library Services',
    Hostel: 'Hostel Administration',
    Security: 'Campus Security',
    Medical: 'Health Center',
    Equipment: 'Lab Support',
    Other: 'General Administration',
};

const ISSUE_PRIORITY_RANK = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
};

const ISSUE_SLA_HOURS = {
    critical: 4,
    high: 12,
    medium: 24,
    low: 72,
};

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function trimString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeEvidenceItem(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }
    const type = trimString(item.type).toLowerCase() === 'video' ? 'video' : 'image';
    const dataUrl = trimString(item.dataUrl);
    if (!dataUrl) {
        return null;
    }
    return {
        id: trimString(item.id) || createId(type),
        type,
        name: trimString(item.name) || `${type}-evidence`,
        mimeType: trimString(item.mimeType) || (type === 'video' ? 'video/mp4' : 'image/jpeg'),
        dataUrl,
        createdAt: trimString(item.createdAt) || new Date().toISOString(),
    };
}

export function getIssueSlaHours(priority) {
    return ISSUE_SLA_HOURS[priority] || ISSUE_SLA_HOURS.medium;
}

export function getIssueDepartment(category) {
    return ISSUE_DEPARTMENT_BY_CATEGORY[category] || ISSUE_DEPARTMENT_BY_CATEGORY.Other;
}

export function smartCategorizeIssue(title, description, selectedCategory = '') {
    if (selectedCategory && selectedCategory !== 'Other') {
        return {
            category: selectedCategory,
            confidence: 1,
            department: getIssueDepartment(selectedCategory),
        };
    }

    const haystack = `${trimString(title)} ${trimString(description)}`.toLowerCase();
    let bestCategory = selectedCategory || 'Other';
    let bestScore = 0;

    ISSUE_CATEGORIES.forEach((category) => {
        const score = (ISSUE_CATEGORY_KEYWORDS[category] || []).reduce((sum, keyword) => sum + (haystack.includes(keyword) ? 1 : 0), 0);
        if (score > bestScore) {
            bestCategory = category;
            bestScore = score;
        }
    });

    return {
        category: bestCategory || 'Other',
        confidence: bestScore > 0 ? Math.min(1, 0.45 + bestScore * 0.18) : 0.3,
        department: getIssueDepartment(bestCategory || 'Other'),
    };
}

export function createIssueTimelineEntry({ status, title, notes = '', actorName = 'System', actorRole = 'system', createdAt = new Date().toISOString() }) {
    return {
        id: createId('timeline'),
        status: trimString(status) || 'submitted',
        title: trimString(title) || 'Issue updated',
        notes: trimString(notes),
        actorName: trimString(actorName) || 'System',
        actorRole: trimString(actorRole) || 'system',
        createdAt,
    };
}

export function createIssueRecord({ title, description, category, priority, location, evidence, reporter, notificationPreferences }) {
    const createdAt = new Date().toISOString();
    const categorization = smartCategorizeIssue(title, description, category);
    const normalizedEvidence = Array.isArray(evidence)
        ? evidence.map(normalizeEvidenceItem).filter(Boolean).slice(0, 5)
        : [];
    const resolvedCategory = category && ISSUE_CATEGORIES.includes(category) ? category : categorization.category;
    const slaHours = getIssueSlaHours(priority);

    return {
        id: createId('issue'),
        title: trimString(title),
        description: trimString(description),
        category: resolvedCategory,
        smartCategory: categorization.category,
        categoryConfidence: categorization.confidence,
        priority: ISSUE_PRIORITY_OPTIONS.includes(priority) ? priority : 'medium',
        status: 'submitted',
        department: categorization.department,
        location: {
            building: trimString(location?.building),
            floor: trimString(location?.floor),
            room: trimString(location?.room),
            gpsLabel: trimString(location?.gpsLabel),
            latitude: trimString(location?.latitude),
            longitude: trimString(location?.longitude),
        },
        evidence: normalizedEvidence,
        beforeAfter: {
            before: normalizedEvidence.filter((item) => item.type === 'image'),
            after: [],
        },
        timeline: [
            createIssueTimelineEntry({
                status: 'submitted',
                title: 'Issue reported by student',
                notes: 'Initial report created and sent to the admin queue.',
                actorName: trimString(reporter?.name) || 'Student',
                actorRole: 'student',
                createdAt,
            }),
        ],
        adminNotes: [],
        reporter: {
            userId: trimString(reporter?.userId),
            name: trimString(reporter?.name) || 'Student',
            email: trimString(reporter?.email),
        },
        notificationPreferences: {
            ...DEFAULT_ISSUE_NOTIFICATION_PREFERENCES,
            ...(notificationPreferences && typeof notificationPreferences === 'object' ? notificationPreferences : {}),
        },
        satisfaction: {
            rating: null,
            comment: '',
            submittedAt: '',
        },
        resolutionSummary: '',
        slaHours,
        slaDueAt: new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString(),
        createdAt,
        updatedAt: createdAt,
        resolvedAt: '',
        closedAt: '',
    };
}

export function normalizeIssueRecord(issue) {
    if (!issue || typeof issue !== 'object') {
        return null;
    }
    const createdAt = trimString(issue.createdAt) || new Date().toISOString();
    const updatedAt = trimString(issue.updatedAt) || createdAt;
    const category = ISSUE_CATEGORIES.includes(issue.category) ? issue.category : 'Other';
    const priority = ISSUE_PRIORITY_OPTIONS.includes(issue.priority) ? issue.priority : 'medium';
    const status = ISSUE_STATUS_OPTIONS.includes(issue.status) ? issue.status : 'submitted';
    return {
        id: trimString(issue.id) || createId('issue'),
        title: trimString(issue.title) || 'Campus issue',
        description: trimString(issue.description),
        category,
        smartCategory: ISSUE_CATEGORIES.includes(issue.smartCategory) ? issue.smartCategory : category,
        categoryConfidence: typeof issue.categoryConfidence === 'number' ? issue.categoryConfidence : 0.5,
        priority,
        status,
        department: trimString(issue.department) || getIssueDepartment(category),
        location: {
            building: trimString(issue.location?.building),
            floor: trimString(issue.location?.floor),
            room: trimString(issue.location?.room),
            gpsLabel: trimString(issue.location?.gpsLabel),
            latitude: trimString(issue.location?.latitude),
            longitude: trimString(issue.location?.longitude),
        },
        evidence: Array.isArray(issue.evidence) ? issue.evidence.map(normalizeEvidenceItem).filter(Boolean).slice(0, 5) : [],
        beforeAfter: {
            before: Array.isArray(issue.beforeAfter?.before) ? issue.beforeAfter.before.map(normalizeEvidenceItem).filter(Boolean).slice(0, 5) : [],
            after: Array.isArray(issue.beforeAfter?.after) ? issue.beforeAfter.after.map(normalizeEvidenceItem).filter(Boolean).slice(0, 5) : [],
        },
        timeline: Array.isArray(issue.timeline) ? issue.timeline.filter(Boolean) : [],
        adminNotes: Array.isArray(issue.adminNotes) ? issue.adminNotes.filter(Boolean) : [],
        reporter: {
            userId: trimString(issue.reporter?.userId),
            name: trimString(issue.reporter?.name) || 'Student',
            email: trimString(issue.reporter?.email),
        },
        notificationPreferences: {
            ...DEFAULT_ISSUE_NOTIFICATION_PREFERENCES,
            ...(issue.notificationPreferences && typeof issue.notificationPreferences === 'object' ? issue.notificationPreferences : {}),
        },
        satisfaction: {
            rating: typeof issue.satisfaction?.rating === 'number' ? issue.satisfaction.rating : null,
            comment: trimString(issue.satisfaction?.comment),
            submittedAt: trimString(issue.satisfaction?.submittedAt),
        },
        resolutionSummary: trimString(issue.resolutionSummary),
        slaHours: typeof issue.slaHours === 'number' ? issue.slaHours : getIssueSlaHours(priority),
        slaDueAt: trimString(issue.slaDueAt) || new Date(new Date(createdAt).getTime() + getIssueSlaHours(priority) * 60 * 60 * 1000).toISOString(),
        createdAt,
        updatedAt,
        resolvedAt: trimString(issue.resolvedAt),
        closedAt: trimString(issue.closedAt),
    };
}

export function normalizeIssueCenter(center) {
    return {
        reportedIssues: Array.isArray(center?.reportedIssues) ? center.reportedIssues.map(normalizeIssueRecord).filter(Boolean) : [],
        notificationPreferences: {
            ...DEFAULT_ISSUE_NOTIFICATION_PREFERENCES,
            ...(center?.notificationPreferences && typeof center.notificationPreferences === 'object' ? center.notificationPreferences : {}),
        },
    };
}

export function applyAdminIssueUpdate(issue, { updates = {}, note = '', actorName = 'Admin', actorRole = 'admin' }) {
    const currentIssue = normalizeIssueRecord(issue);
    if (!currentIssue) {
        return null;
    }

    const now = new Date().toISOString();
    const nextStatus = ISSUE_STATUS_OPTIONS.includes(updates.status) ? updates.status : currentIssue.status;
    const department = trimString(updates.department) || currentIssue.department;
    const resolutionSummary = trimString(updates.resolutionSummary) || currentIssue.resolutionSummary;
    const afterEvidence = Array.isArray(updates.afterEvidence)
        ? updates.afterEvidence.map(normalizeEvidenceItem).filter(Boolean).slice(0, 5)
        : currentIssue.beforeAfter.after;

    const nextIssue = {
        ...currentIssue,
        status: nextStatus,
        department,
        resolutionSummary,
        beforeAfter: {
            before: currentIssue.beforeAfter.before,
            after: afterEvidence,
        },
        updatedAt: now,
        resolvedAt: nextStatus === 'resolved' && !currentIssue.resolvedAt ? now : currentIssue.resolvedAt,
        closedAt: nextStatus === 'closed' ? now : currentIssue.closedAt,
    };

    const nextTimeline = [...currentIssue.timeline];
    const statusChanged = nextStatus !== currentIssue.status;
    if (statusChanged) {
        nextTimeline.unshift(createIssueTimelineEntry({
            status: nextStatus,
            title: `Status changed to ${nextStatus.replace(/_/g, ' ')}`,
            notes: trimString(note) || `Issue moved into ${nextStatus.replace(/_/g, ' ')} state.`,
            actorName,
            actorRole,
            createdAt: now,
        }));
    }
    else if (trimString(note)) {
        nextTimeline.unshift(createIssueTimelineEntry({
            status: nextStatus,
            title: 'Admin note added',
            notes: note,
            actorName,
            actorRole,
            createdAt: now,
        }));
    }

    const nextAdminNotes = trimString(note)
        ? [{
            id: createId('note'),
            body: trimString(note),
            actorName,
            actorRole,
            createdAt: now,
        }, ...currentIssue.adminNotes]
        : currentIssue.adminNotes;

    return {
        ...nextIssue,
        timeline: nextTimeline,
        adminNotes: nextAdminNotes,
    };
}

export function applyIssueSatisfaction(issue, rating, comment = '') {
    const currentIssue = normalizeIssueRecord(issue);
    if (!currentIssue) {
        return null;
    }
    const nextRating = Math.max(1, Math.min(5, Number(rating)));
    const now = new Date().toISOString();
    return {
        ...currentIssue,
        updatedAt: now,
        satisfaction: {
            rating: Number.isFinite(nextRating) ? nextRating : currentIssue.satisfaction.rating,
            comment: trimString(comment),
            submittedAt: now,
        },
        timeline: [
            createIssueTimelineEntry({
                status: currentIssue.status,
                title: 'Student satisfaction submitted',
                notes: `Rating: ${Number.isFinite(nextRating) ? nextRating : currentIssue.satisfaction.rating}/5${trimString(comment) ? ` - ${trimString(comment)}` : ''}`,
                actorName: currentIssue.reporter.name || 'Student',
                actorRole: 'student',
                createdAt: now,
            }),
            ...currentIssue.timeline,
        ],
    };
}

export function isIssueSlaBreached(issue, now = new Date()) {
    const normalized = normalizeIssueRecord(issue);
    if (!normalized) {
        return false;
    }
    if (normalized.status === 'resolved' || normalized.status === 'closed') {
        return false;
    }
    return new Date(normalized.slaDueAt).getTime() < now.getTime();
}

export function calculateIssueAnalytics(issues) {
    const normalizedIssues = Array.isArray(issues) ? issues.map(normalizeIssueRecord).filter(Boolean) : [];
    const openIssues = normalizedIssues.filter((issue) => !['resolved', 'closed'].includes(issue.status));
    const satisfactionRatings = normalizedIssues
        .map((issue) => issue.satisfaction.rating)
        .filter((rating) => typeof rating === 'number');
    const averageSatisfaction = satisfactionRatings.length > 0
        ? Number((satisfactionRatings.reduce((sum, rating) => sum + rating, 0) / satisfactionRatings.length).toFixed(1))
        : 0;

    const byCategory = ISSUE_CATEGORIES.map((category) => ({
        category,
        count: normalizedIssues.filter((issue) => issue.category === category).length,
    })).filter((item) => item.count > 0);

    return {
        total: normalizedIssues.length,
        open: openIssues.length,
        critical: normalizedIssues.filter((issue) => issue.priority === 'critical').length,
        breached: normalizedIssues.filter((issue) => isIssueSlaBreached(issue)).length,
        resolved: normalizedIssues.filter((issue) => issue.status === 'resolved').length,
        closed: normalizedIssues.filter((issue) => issue.status === 'closed').length,
        averageSatisfaction,
        byCategory,
    };
}

export function sortIssuesForAdmin(issues, sortBy = 'priority') {
    const normalizedIssues = Array.isArray(issues) ? issues.map(normalizeIssueRecord).filter(Boolean) : [];
    return normalizedIssues.sort((left, right) => {
        if (sortBy === 'newest') {
            return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        }
        if (sortBy === 'oldest') {
            return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        }
        if (sortBy === 'sla') {
            return new Date(left.slaDueAt).getTime() - new Date(right.slaDueAt).getTime();
        }
        const priorityDelta = (ISSUE_PRIORITY_RANK[right.priority] || 0) - (ISSUE_PRIORITY_RANK[left.priority] || 0);
        if (priorityDelta !== 0) {
            return priorityDelta;
        }
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
}

export function matchesIssueSearch(issue, searchTerm) {
    const normalized = normalizeIssueRecord(issue);
    const query = trimString(searchTerm).toLowerCase();
    if (!normalized || !query) {
        return true;
    }
    const locationText = [normalized.location.building, normalized.location.floor, normalized.location.room, normalized.location.gpsLabel].filter(Boolean).join(' ');
    const haystack = [
        normalized.title,
        normalized.description,
        normalized.category,
        normalized.department,
        normalized.priority,
        normalized.status,
        normalized.reporter.name,
        normalized.reporter.email,
        locationText,
        ...normalized.adminNotes.map((note) => note.body || ''),
    ].join(' ').toLowerCase();
    return haystack.includes(query);
}
