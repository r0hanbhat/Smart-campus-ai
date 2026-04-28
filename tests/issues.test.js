import test from 'node:test';
import assert from 'node:assert/strict';
import {
    applyAdminIssueUpdate,
    calculateIssueAnalytics,
    createIssueRecord,
    isIssueSlaBreached,
    matchesIssueSearch,
    smartCategorizeIssue,
} from '../lib/smart-campus/issues.js';

test('smartCategorizeIssue maps common keywords to a campus issue category', () => {
    const result = smartCategorizeIssue('WiFi is down in library', 'The internet is not working on the second floor.', 'Other');
    assert.equal(result.category, 'WiFi');
    assert.equal(result.department, 'IT Services');
});

test('createIssueRecord builds a routed issue with timeline and SLA', () => {
    const issue = createIssueRecord({
        title: 'Projector not working',
        description: 'Classroom projector stays black during lectures.',
        category: 'Classroom',
        priority: 'high',
        location: { building: 'Academic Block', room: '201' },
        evidence: [{ type: 'image', name: 'projector.jpg', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AAA' }],
        reporter: { userId: 'student-1', name: 'Asha', email: 'asha@example.edu' },
    });
    assert.equal(issue.department, 'Academic Operations');
    assert.equal(issue.timeline.length, 1);
    assert.equal(issue.beforeAfter.before.length, 1);
});

test('applyAdminIssueUpdate appends notes and status changes', () => {
    const issue = createIssueRecord({
        title: 'Broken lab PC',
        description: 'The machine does not start.',
        category: 'Equipment',
        priority: 'medium',
        location: {},
        evidence: [],
        reporter: { userId: 'student-2', name: 'Ravi', email: 'ravi@example.edu' },
    });
    const updated = applyAdminIssueUpdate(issue, {
        updates: { status: 'resolved', department: 'Lab Support', resolutionSummary: 'Replaced the power supply.' },
        note: 'The hardware team resolved the failure.',
        actorName: 'Admin',
        actorRole: 'admin',
    });
    assert.equal(updated.status, 'resolved');
    assert.equal(updated.adminNotes.length, 1);
    assert.equal(updated.timeline[0].title, 'Status changed to resolved');
});

test('calculateIssueAnalytics counts breaches and issue states', () => {
    const baseIssue = createIssueRecord({
        title: 'Medical emergency response',
        description: 'Delayed ambulance support near the hostel.',
        category: 'Medical',
        priority: 'critical',
        location: {},
        evidence: [],
        reporter: { userId: 'student-3', name: 'Mina', email: 'mina@example.edu' },
    });
    const breached = { ...baseIssue, slaDueAt: '2000-01-01T00:00:00.000Z' };
    const closed = { ...baseIssue, id: 'issue-closed', status: 'closed', satisfaction: { rating: 4, comment: '', submittedAt: '2026-01-01T00:00:00.000Z' } };
    const analytics = calculateIssueAnalytics([breached, closed]);
    assert.equal(analytics.total, 2);
    assert.equal(analytics.breached, 1);
    assert.equal(analytics.closed, 1);
    assert.equal(analytics.averageSatisfaction, 4);
    assert.equal(isIssueSlaBreached(breached), true);
});

test('matchesIssueSearch scans reporter, location, and issue text', () => {
    const issue = createIssueRecord({
        title: 'Parking congestion',
        description: 'Cars block the bike lane near the main gate.',
        category: 'Parking',
        priority: 'low',
        location: { building: 'Main Gate', floor: '', room: '' },
        evidence: [],
        reporter: { userId: 'student-4', name: 'Karan', email: 'karan@example.edu' },
    });
    assert.equal(matchesIssueSearch(issue, 'bike lane'), true);
    assert.equal(matchesIssueSearch(issue, 'karan'), true);
    assert.equal(matchesIssueSearch(issue, 'library'), false);
});
