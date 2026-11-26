import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';
import { buildStudentAttendanceReportWithSubjects } from '@/lib/smart-campus/attendance.js';

// GET /api/student/dashboard
export async function GET() {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceClient = createSupabaseServiceRoleClient();
    const warnings = [];

    // Step 1: Resolve the student row (attendance uses students.id, not user_id directly)
    const { data: studentRow, error: studentRowError } = await serviceClient
      .from('students')
      .select('id, course, branch, semester')
      .eq('user_id', user.id)
      .maybeSingle();
    if (studentRowError) {
      warnings.push(`students: ${studentRowError.message}`);
    }

    let academicProfile = studentRow || null;
    if (!academicProfile) {
      const { data: profileRow, error: profileError } = await serviceClient
        .from('profiles')
        .select('course, branch, semester')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        warnings.push(`profile: ${profileError.message}`);
      }
      if (profileRow?.course && profileRow?.branch && profileRow?.semester) {
        academicProfile = profileRow;
      }
    }

    // Run attendance and events queries in parallel
    const [attendanceRes, eventsRes] = await Promise.all([
      // Attendance — only possible if student row exists
      studentRow?.id
        ? serviceClient
            .from('attendance')
            .select('status, subject_id, subjects:subject_id(name)')
            .eq('student_id', studentRow.id)
        : Promise.resolve({ data: [], error: null }),

      // Events the student has registered for
      serviceClient
        .from('event_registrations')
        .select('id, registered_at, events(title, proposed_date, time_start, status, is_published)', { count: 'exact' })
        .eq('student_id', user.id)
        .order('registered_at', { ascending: false })
        .limit(5),
    ]);
    if (attendanceRes.error) {
      warnings.push(`attendance: ${attendanceRes.error.message}`);
    }
    if (eventsRes.error) {
      warnings.push(`events: ${eventsRes.error.message}`);
    }

    // ── Tasks (reminders & deadlines) from user_state JSON blob ──────────
    // The canonical source is user_state.reminders / user_state.deadlines.
    // We also attempt the standalone tables as a secondary source.
    let plannerReminders = [];
    let plannerDeadlines = [];
    let plannerRemindersCount = null;
    let plannerDeadlinesCount = null;

    // Primary: read from user_state
    try {
      const { data: stateRow } = await serviceClient
        .from('user_state')
        .select('reminders, deadlines')
        .eq('user_id', user.id)
        .maybeSingle();

      if (stateRow) {
        const rawReminders = Array.isArray(stateRow.reminders) ? stateRow.reminders : [];
        const rawDeadlines = Array.isArray(stateRow.deadlines) ? stateRow.deadlines : [];
        const validReminders = rawReminders.filter(r => r && r.eventName);
        const openDeadlines = rawDeadlines.filter(d => d && d.title && !d.completed);
        plannerRemindersCount = validReminders.length;
        plannerDeadlinesCount = openDeadlines.length;
        plannerReminders = validReminders
          .map(r => {
            const remindAt = r.date && r.time ? new Date(`${r.date} ${r.time}`) : null;
            return { id: r.id, title: r.eventName, at: remindAt ? remindAt.toISOString() : r.date };
          })
          .slice(0, 6);
        plannerDeadlines = openDeadlines
          .map(d => {
            const dueAt = d.date && d.time ? new Date(`${d.date} ${d.time}`) : (d.date ? new Date(d.date) : null);
            return { id: d.id, title: d.title, due: dueAt ? dueAt.toISOString() : d.date };
          })
          .slice(0, 6);
      }
    } catch {
      // user_state read failed — continue with empty arrays
    }

    // Fallback: if user_state had nothing, try standalone tables
    if (plannerReminders.length === 0 && plannerDeadlines.length === 0) {
      try {
        const [remindersRes, deadlinesRes] = await Promise.all([
          supabase
            .from('reminders')
            .select('id, title, remind_at', { count: 'exact' })
            .eq('user_id', user.id)
            .eq('is_done', false)
            .gte('remind_at', new Date().toISOString())
            .order('remind_at', { ascending: true })
            .limit(4),
          supabase
            .from('deadlines')
            .select('id, title, due_date', { count: 'exact' })
            .eq('user_id', user.id)
            .eq('is_completed', false)
            .order('due_date', { ascending: true })
            .limit(4),
        ]);
        plannerReminders = (remindersRes.data || []).map(r => ({ id: r.id, title: r.title, at: r.remind_at }));
        plannerDeadlines = (deadlinesRes.data || []).map(d => ({ id: d.id, title: d.title, due: d.due_date }));
        plannerRemindersCount = remindersRes.error ? null : (remindersRes.count ?? plannerReminders.length);
        plannerDeadlinesCount = deadlinesRes.error ? null : (deadlinesRes.count ?? plannerDeadlines.length);
      } catch {
        // Standalone tables don't exist — that's fine
      }
    }

    // ── Attendance calculation ───────────────────────────────────────────
    const records = attendanceRes.data || [];

    // Fetch all mapped subjects for this student's course/branch/semester
    // so subjects with zero attendance entries still count as 0%.
    let allMappedSubjects = [];
    if (academicProfile?.course && academicProfile?.branch && academicProfile?.semester) {
        const { data: subjectRows, error: subjectRowsError } = await serviceClient
          .from('subjects')
          .select('id, name')
          .eq('course', academicProfile.course)
          .eq('branch', academicProfile.branch)
          .eq('semester', Number(academicProfile.semester));
        if (subjectRowsError) {
          warnings.push(`subjects: ${subjectRowsError.message}`);
        }
        allMappedSubjects = subjectRows || [];
    }

    const attendanceReport = buildStudentAttendanceReportWithSubjects(
      records.map(record => ({
        ...record,
        subject_name: record.subjects?.name || 'Unknown',
      })),
      allMappedSubjects
    );
    const totalRecords = attendanceReport.overall.totalSessions;
    const presentRecords = attendanceReport.overall.presentSessions;
    const bySubject = attendanceReport.subjects
      .map(subject => ({
        name: subject.subjectName,
        total: subject.summary.totalSessions,
        present: subject.summary.presentSessions,
        pct: subject.summary.percentage,
      }))
      .sort((left, right) => {
        const leftHasRecords = left.total > 0;
        const rightHasRecords = right.total > 0;
        return Number(rightHasRecords) - Number(leftHasRecords)
          || left.pct - right.pct
          || left.name.localeCompare(right.name);
      })
      .slice(0, 5);
    const overallPct = totalRecords > 0 ? attendanceReport.overall.percentage : null;

    // ── Clubs — primary source is user_state.clubs JSON blob ────────────
    // The app stores joined clubs in user_state.clubs[] (club.joined === true),
    // NOT in a club_memberships DB table. Read that first.
    let clubRows = [];
    let clubsCount = null;
    try {
      const { data: stateClubs } = await serviceClient
        .from('user_state')
        .select('clubs')
        .eq('user_id', user.id)
        .maybeSingle();

      const joinedFromState = Array.isArray(stateClubs?.clubs)
        ? stateClubs.clubs.filter(c => c.joined)
        : [];

      if (joinedFromState.length > 0) {
        clubsCount = joinedFromState.length;
        clubRows = joinedFromState.map(c => ({ id: c.id, name: c.name || c.club_name || c.id }));
      } else {
        // Fallback: try club_memberships table (for future DB-backed join flow)
        const { data: joinedClubs, error: clubError, count } = await serviceClient
          .from('club_memberships')
          .select('club_id, clubs(club_name)', { count: 'exact' })
          .eq('user_id', user.id)
          .limit(10);

        if (!clubError) {
          clubsCount = count ?? joinedClubs?.length ?? 0;
          if (joinedClubs?.length) {
            clubRows = joinedClubs.map(m => ({ id: m.club_id, name: m.clubs?.club_name || m.club_id }));
          }
        }
      }
    } catch {
      clubRows = [];
    }

    return NextResponse.json({
      attendance: {
        overall: overallPct,
        present: presentRecords,
        total: totalRecords,
        bySubject,
        noStudentRecord: !studentRow?.id,
      },
      eventsCount: eventsRes.error ? null : (eventsRes.count ?? eventsRes.data?.length ?? 0),
      events: (eventsRes.error ? [] : eventsRes.data || []).map(r => ({
        title: r.events?.title,
        date: r.events?.proposed_date,
        time: r.events?.time_start,
        isPublished: r.events?.is_published,
      })),
      planner: {
        reminders: plannerReminders,
        deadlines: plannerDeadlines,
        remindersCount: plannerRemindersCount,
        deadlinesCount: plannerDeadlinesCount,
      },
      clubs: (clubRows || []).map(m => ({ id: m.id || m.club_id, name: m.name || m.clubs?.club_name || m.id || m.club_id })),
      clubsCount,
      warnings,
    });
  } catch (err) {
    console.error('Student dashboard error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
