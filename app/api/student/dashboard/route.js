import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createSupabaseServiceRoleClient } from '@/lib/server/supabase';

// GET /api/student/dashboard
export async function GET() {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceClient = createSupabaseServiceRoleClient();

    // Step 1: Resolve the student row (attendance uses students.id, not user_id directly)
    const { data: studentRow } = await serviceClient
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    // Run all queries in parallel
    const [attendanceRes, eventsRes, remindersRes, deadlinesRes] = await Promise.all([
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
        .select('id, registered_at, events(title, proposed_date, time_start, status, is_published)')
        .eq('student_id', user.id)
        .order('registered_at', { ascending: false })
        .limit(5),

      // Upcoming reminders
      supabase
        .from('reminders')
        .select('id, title, remind_at')
        .eq('user_id', user.id)
        .eq('is_done', false)
        .gte('remind_at', new Date().toISOString())
        .order('remind_at', { ascending: true })
        .limit(4),

      // Open deadlines
      supabase
        .from('deadlines')
        .select('id, title, due_date')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .order('due_date', { ascending: true })
        .limit(4),
    ]);

    // ── Attendance calculation ───────────────────────────────────────────
    const records = attendanceRes.data || [];
    const totalRecords = records.length;
    const presentRecords = records.filter(r => r.status === 'present').length;
    const overallPct = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : null;

    // Per-subject breakdown — show weakest subjects first
    const subjectMap = {};
    for (const r of records) {
      const key = r.subject_id;
      if (!subjectMap[key]) subjectMap[key] = { name: r.subjects?.name || 'Unknown', total: 0, present: 0 };
      subjectMap[key].total++;
      if (r.status === 'present') subjectMap[key].present++;
    }
    const bySubject = Object.values(subjectMap)
      .map(s => ({ name: s.name, total: s.total, present: s.present, pct: Math.round((s.present / s.total) * 100) }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 5);

    // ── Clubs — query club_memberships or joined_clubs table ─────────────
    const { data: clubRows } = await serviceClient
      .from('club_memberships')
      .select('club_id, clubs(club_name)')
      .eq('user_id', user.id)
      .limit(10)
      .catch ? await serviceClient.from('club_memberships').select('club_id').eq('user_id', user.id).limit(10) : { data: [] };

    return NextResponse.json({
      attendance: {
        overall: overallPct,
        present: presentRecords,
        total: totalRecords,
        bySubject,
        noStudentRecord: !studentRow?.id,
      },
      events: (eventsRes.data || []).map(r => ({
        title: r.events?.title,
        date: r.events?.proposed_date,
        time: r.events?.time_start,
        isPublished: r.events?.is_published,
      })),
      planner: {
        reminders: (remindersRes.data || []).map(r => ({ id: r.id, title: r.title, at: r.remind_at })),
        deadlines: (deadlinesRes.data || []).map(d => ({ id: d.id, title: d.title, due: d.due_date })),
      },
      clubs: (clubRows || []).map(m => ({ id: m.club_id, name: m.clubs?.club_name || m.club_id })),
    });
  } catch (err) {
    console.error('Student dashboard error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
