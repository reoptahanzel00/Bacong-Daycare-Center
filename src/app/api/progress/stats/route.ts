import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET â€” aggregate ECCD milestone counts for oversight dashboards.
 * Returns counts ONLY (no individual observation notes), so officials can see
 * program-wide progress without exposing the private per-pupil notes that RLS
 * deliberately keeps from non-staff roles per RA 10173.
 *
 * - Parents: counts scoped to their linked children.
 * - Officials/Workers/Admins: program-wide counts.
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
      const { data, error } = await admin
        .from('progress_observations')
        .select('domain_id')
        .in('pupil_id', pupilIds);
      if (error) {
        return NextResponse.json({ total: 0, byDomain: {}, warning: error.message });
      }
      const rows = data || [];
      const byDomain: Record<string, number> = {};
      rows.forEach((r) => { byDomain[r.domain_id] = (byDomain[r.domain_id] || 0) + 1; });
      return NextResponse.json({ total: rows.length, byDomain });
    }

    const { data, error } = await admin
      .from('progress_observations')
      .select('domain_id');
    if (error) {
      return NextResponse.json({ total: 0, byDomain: {}, warning: error.message });
    }
    const rows = data || [];
    const byDomain: Record<string, number> = {};
    rows.forEach((r) => { byDomain[r.domain_id] = (byDomain[r.domain_id] || 0) + 1; });
    return NextResponse.json({ total: rows.length, byDomain });
  } catch {
    return NextResponse.json({ total: 0, byDomain: {}, warning: 'Stats unavailable.' });
  }
}
