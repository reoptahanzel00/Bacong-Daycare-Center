import { NextResponse } from 'next/server';
import { getServerSession, authorizeRole } from '@/lib/auth';
import { todayLocalISO } from '@/lib/dates';
import { computeAgeYMD } from '@/lib/eccdRecord';
import { ABSENCE_ALERT_THRESHOLD } from '@/lib/absences';

export const dynamic = 'force-dynamic';


const AGE_BRACKETS: Array<{ label: string; min: number; max: number }> = [
  { label: 'Under 3', min: 0, max: 2 },
  { label: '3 years', min: 3, max: 3 },
  { label: '4 years', min: 4, max: 4 },
  { label: '5 years and over', min: 5, max: 99 },
];

/**
 * GET — the Barangay Executive Dashboard's figures.
 *
 * The capstone paper gives barangay officials "summarized enrollment and
 * attendance reports" and "high-level graphical summaries and enrollment
 * metrics", not children's records. So this returns counts only: no names, no
 * pupil IDs, nothing that identifies a child. It reads with the service role
 * because officials no longer hold row-level access to child tables.
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['official', 'worker'])) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const today = todayLocalISO();

    const [pupilsRes, schoolYearRes, evaluationsRes] = await Promise.all([
      admin.from('pupils').select('id, sex, birth_date, enrollment_status, consecutive_absences'),
      admin.from('school_years').select('label, start_date, end_date').eq('is_current', true).maybeSingle(),
      admin.from('eccd_evaluations').select('pupil_id, evaluation_round'),
    ]);
    if (pupilsRes.error) throw new Error(pupilsRes.error.message);

    const pupils = pupilsRes.data || [];
    const enrolled = pupils.filter((p) => p.enrollment_status === 'enrolled');
    const enrolledIds = new Set(enrolled.map((p) => p.id));

    const ageBrackets = AGE_BRACKETS.map((b) => ({
      label: b.label,
      count: enrolled.filter((p) => {
        const age = computeAgeYMD(p.birth_date, today);
        return age !== null && age.y >= b.min && age.y <= b.max;
      }).length,
    }));

    // Attendance of currently enrolled children, over the current school year
    // when one is set (otherwise everything on record).
    const year = schoolYearRes.data;
    let attendanceQuery = admin.from('attendance').select('pupil_id, date, status');
    if (year?.start_date) attendanceQuery = attendanceQuery.gte('date', year.start_date);
    if (year?.end_date) attendanceQuery = attendanceQuery.lte('date', year.end_date);
    const { data: attendanceRows, error: attendanceError } = await attendanceQuery.limit(50000);
    if (attendanceError) throw new Error(attendanceError.message);

    const tally = (rows: Array<{ status: string }>) => ({
      present: rows.filter((r) => r.status === 'present').length,
      late: rows.filter((r) => r.status === 'late').length,
      absent: rows.filter((r) => r.status === 'absent').length,
    });
    const yearRows = (attendanceRows || []).filter((r) => enrolledIds.has(r.pupil_id));
    const yearTally = tally(yearRows);
    const total = yearRows.length;

    const assessed = (round: number) =>
      new Set(
        (evaluationsRes.data || [])
          .filter((e) => e.evaluation_round === round && enrolledIds.has(e.pupil_id))
          .map((e) => e.pupil_id)
      ).size;

    return NextResponse.json(
      {
        enrollment: {
          enrolled: enrolled.length,
          pending: pupils.filter((p) => p.enrollment_status === 'pending').length,
          archived: pupils.filter((p) => p.enrollment_status === 'archived').length,
          male: enrolled.filter((p) => p.sex === 'Male').length,
          female: enrolled.filter((p) => p.sex === 'Female').length,
          ageBrackets,
        },
        attendance: {
          schoolYear: year?.label ?? null,
          ...yearTally,
          rate: total ? Math.round(((yearTally.present + yearTally.late) / total) * 100) : null,
          today: { date: today, ...tally(yearRows.filter((r) => r.date === today)) },
        },
        absences: {
          threshold: ABSENCE_ALERT_THRESHOLD,
          frequent: enrolled.filter((p) => (p.consecutive_absences || 0) >= ABSENCE_ALERT_THRESHOLD).length,
        },
        eccd: { round1: assessed(1), round2: assessed(2), round3: assessed(3) },
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('[Summary API] failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Summary unavailable.' }, { status: 503 });
  }
}
