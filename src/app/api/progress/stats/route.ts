import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/paginate';

/**
 * GET — aggregate ECCD milestone counts for oversight dashboards.
 * Returns counts ONLY (no individual observation notes), so dashboards can show
 * program-wide progress without exposing the private per-pupil notes that RLS
 * deliberately keeps from non-staff roles per RA 10173.
 *
 * - Parents: counts scoped to their linked children.
 * - Workers: program-wide counts.
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const admin = createAdminClient();

    if (session.role === 'parent') {
      const { data: guardians } = await admin
        .from('guardians')
        .select('pupil_id')
        .eq('user_id', session.userId);
      const pupilIds = (guardians || []).map((g) => g.pupil_id);
      if (pupilIds.length === 0) {
        return NextResponse.json({ total: 0, byDomain: {} });
      }
      const { data, error } = await fetchAllRows<{ domain_id: string }>((from, to) =>
        admin
          .from('progress_observations')
          .select('domain_id')
          .in('pupil_id', pupilIds)
          .order('id')
          .range(from, to)
      );
      if (error) {
        console.error('[Progress Stats API] read failed:', error.message);
        return NextResponse.json({ total: 0, byDomain: {}, warning: 'Stats unavailable.' });
      }
      const rows = data || [];
      const byDomain: Record<string, number> = {};
      rows.forEach((r) => { byDomain[r.domain_id] = (byDomain[r.domain_id] || 0) + 1; });
      return NextResponse.json({ total: rows.length, byDomain });
    }

    // Paged: one fully assessed class passes Supabase's 1000-row response cap.
    const { data, error } = await fetchAllRows<{ domain_id: string }>((from, to) =>
      admin.from('progress_observations').select('domain_id').order('id').range(from, to)
    );
    if (error) {
      console.error('[Progress Stats API] read failed:', error.message);
        return NextResponse.json({ total: 0, byDomain: {}, warning: 'Stats unavailable.' });
    }
    const rows = data || [];
    const byDomain: Record<string, number> = {};
    rows.forEach((r) => { byDomain[r.domain_id] = (byDomain[r.domain_id] || 0) + 1; });
    return NextResponse.json({ total: rows.length, byDomain });
  } catch {
    return NextResponse.json({ total: 0, byDomain: {}, warning: 'Stats unavailable.' });
  }
}
