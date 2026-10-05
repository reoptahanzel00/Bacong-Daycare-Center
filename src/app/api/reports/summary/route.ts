import { NextResponse } from 'next/server';
import { getServerSession, authorizeRole } from '@/lib/auth';
import { todayLocalISO } from '@/lib/dates';
import { computeAgeYMD } from '@/lib/eccdRecord';
import { ABSENCE_ALERT_THRESHOLD } from '@/lib/absences';
import { fetchAllRows } from '@/lib/supabase/paginate';

export const dynamic = 'force-dynamic';


const AGE_BRACKETS: Array<{ label: string; min: number; max: number }> = [
  { label: 'Under 3', min: 0, max: 2 },
  { label: '3 years', min: 3, max: 3 },
  { label: '4 years', min: 4, max: 4 },
  { label: '5 years and over', min: 5, max: 99 },
];

/** 'SY 2026-2027' -> 2026, or null when the label is not in that shape. */
function schoolYearStart(label: string | null): number | null {
  const m = label?.match(/^SY (\d{4})-(\d{4})$/);
  if (!m) return null;
  const start = Number(m[1]);
  return Number(m[2]) === start + 1 ? start : null;
}

/**
 * GET — summary figures for the Daycare Worker's dashboard and DSWD report:
 * enrolled boys, girls and children with special needs, age brackets,
 * attendance and ECCD coverage. Counts only: no names, no pupil IDs.
 *
 * `?schoolYear=SY 2026-2027` scopes attendance to that school year (the
 * school_years row when one exists, otherwise June 1 – May 31). Without it,
 * the current school year is used when one is set.
 *
 * Every table is read in pages: Supabase returns at most 1000 rows per
 * request, and a year of attendance for one class is several thousand.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker'])) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const today = todayLocalISO();

    const requestedYear = new URL(request.url).searchParams.get('schoolYear');
    const requestedStart = schoolYearStart(requestedYear);
    if (requestedYear && requestedStart === null) {
      return NextResponse.json({ error: 'schoolYear must look like "SY 2026-2027".' }, { status: 400 });
    }

    const yearQuery = admin.from('school_years').select('label, start_date, end_date');
    const [pupilsRes, schoolYearRes, evaluationsRes] = await Promise.all([
      fetchAllRows<{ id: string; sex: string; birth_date: string; enrollment_status: string; consecutive_absences: number | null; has_special_needs: boolean | null }>((from, to) =>
        admin.from('pupils')
          .select('id, sex, birth_date, enrollment_status, consecutive_absences, has_special_needs')
          .order('id')
          .range(from, to)
      ),
      requestedYear
        ? yearQuery.eq('label', requestedYear).maybeSingle()
        : yearQuery.eq('is_current', true).maybeSingle(),
      fetchAllRows<{ pupil_id: string; evaluation_round: number }>((from, to) =>
        admin.from('eccd_evaluations')
          .select('pupil_id, evaluation_round')
          .order('pupil_id')
          .order('evaluation_round')
          .range(from, to)
      ),
    ]);
    if (pupilsRes.error) throw new Error(pupilsRes.error.message);
    if (evaluationsRes.error) throw new Error(evaluationsRes.error.message);

    const pupils = pupilsRes.data;
    const enrolled = pupils.filter((p) => p.enrollment_status === 'enrolled');
    const enrolledIds = new Set(enrolled.map((p) => p.id));

    const ageBrackets = AGE_BRACKETS.map((b) => ({
      label: b.label,
      count: enrolled.filter((p) => {
        const age = computeAgeYMD(p.birth_date, today);
        return age !== null && age.y >= b.min && age.y <= b.max;
      }).length,
    }));

    // Attendance of currently enrolled children over the chosen school year:
    // the requested one, else the current one, else everything on record.
    const year = schoolYearRes.data
      ?? (requestedStart !== null
        ? { label: requestedYear, start_date: `${requestedStart}-06-01`, end_date: `${requestedStart + 1}-05-31` }
        : null);
    const { data: attendanceRows, error: attendanceError } = await fetchAllRows<{ pupil_id: string; date: string; status: string }>((from, to) => {
      let q = admin.from('attendance').select('pupil_id, date, status');
      if (year?.start_date) q = q.gte('date', year.start_date);
      if (year?.end_date) q = q.lte('date', year.end_date);
      return q.order('pupil_id').order('date').range(from, to);
    });
    if (attendanceError) throw new Error(attendanceError.message);

    const tally = (rows: Array<{ status: string }>) => ({
      present: rows.filter((r) => r.status === 'present').length,
      late: rows.filter((r) => r.status === 'late').length,
      absent: rows.filter((r) => r.status === 'absent').length,
    });
    const yearRows = attendanceRows.filter((r) => enrolledIds.has(r.pupil_id));
    const yearTally = tally(yearRows);
    const total = yearRows.length;

    const assessed = (round?: number) =>
      new Set(
        evaluationsRes.data
          .filter((e) => (round === undefined || e.evaluation_round === round) && enrolledIds.has(e.pupil_id))
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
          specialNeeds: enrolled.filter((p) => p.has_special_needs).length,
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
        eccd: { round1: assessed(1), round2: assessed(2), round3: assessed(3), anyRound: assessed() },
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('[Summary API] failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Summary unavailable.' }, { status: 503 });
  }
}
