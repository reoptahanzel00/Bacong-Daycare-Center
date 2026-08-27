import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth';
import type { UserRole } from '@/contexts/DaycareContext';
import type { PupilRow } from '@/services/pupilService';
import type { AttendanceRow } from '@/services/attendanceService';
import type { ProgressRow } from '@/services/progressService';
import type { AnnouncementRow } from '@/services/announcementsService';
import { toClientObservation } from '@/lib/progressMapping';
import { EMPTY_SETTINGS, type CenterSettingsRow } from '@/services/settingsService';

/**
 * The payload the root page hands to the client provider.
 *
 * Everything here is fetched on the server through the RLS-bound session
 * client, so each role receives exactly the rows its policies allow — the
 * scoping is identical to the API routes the client used to call on mount.
 */
export interface InitialAppData {
  role: UserRole | null;
  userName: string | null;
  pupils: PupilRow[];
  attendance: AttendanceRow[];
  progress: ProgressRow[];
  announcements: AnnouncementRow[];
  settings: CenterSettingsRow;
}

const EMPTY: InitialAppData = {
  role: null,
  userName: null,
  pupils: [],
  attendance: [],
  progress: [],
  announcements: [],
  settings: EMPTY_SETTINGS,
};

/**
 * Resolves the session and the first screen's data in one server round trip
 * set, so the browser renders the roster on first paint instead of booting an
 * empty shell and then firing six requests from an effect.
 *
 * The admin-only directory and audit trail are deliberately excluded: they
 * belong to one role, are not needed for first paint, and the client still
 * fetches them on demand.
 */
export async function loadInitialAppData(): Promise<InitialAppData> {
  const session = await getServerSession();
  if (!session.isAuthenticated || !session.role) return EMPTY;

  try {
    const supabase = await createClient();

    const [profileRes, pupilsRes, attendanceRes, progressRes, settingsRes, announcementsRes] =
      await Promise.all([
        supabase.from('users').select('full_name').eq('id', session.userId).maybeSingle(),
        supabase
          .from('pupils')
          .select('*, guardian:guardians(*), sociodemographic:sociodemographic_profiles(*)')
          .in('enrollment_status', ['pending', 'enrolled', 'rejected'])
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('attendance').select('*').order('date', { ascending: false }).limit(500),
        supabase
          .from('progress_observations')
          .select('*')
          .order('observation_date', { ascending: false })
          .limit(200),
        supabase
          .from('center_settings')
          .select('center_name, daycare_worker_name, barangay_captain_name')
          .maybeSingle(),
        supabase
          .from('announcements')
          .select('id, title, body, posted_by, created_at, author:posted_by(full_name)')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

    return {
      role: session.role,
      userName: profileRes.data?.full_name ?? null,
      pupils: (pupilsRes.data as PupilRow[] | null) ?? [],
      attendance: (attendanceRes.data as AttendanceRow[] | null) ?? [],
      // Same column-to-contract mapping the API routes apply, so the client
      // cannot tell whether a row arrived through SSR or through fetch.
      progress: ((progressRes.data as unknown[] | null) ?? []).map(
        (row) => toClientObservation(row as Record<string, unknown>) as ProgressRow
      ),
      settings: (settingsRes.data as CenterSettingsRow | null) ?? EMPTY_SETTINGS,
      announcements: ((announcementsRes.data as unknown[] | null) ?? []).map((row) => {
        const a = row as Record<string, unknown>;
        const author = a.author as { full_name?: string } | null | undefined;
        return {
          id: a.id,
          title: a.title,
          body: a.body,
          posted_by: a.posted_by,
          created_at: a.created_at,
          author_name: author && typeof author === 'object' ? author.full_name ?? null : null,
        } as unknown as AnnouncementRow;
      }),
    };
  } catch {
    // Database unreachable: fall back to the role alone so the shell still
    // renders and the client can retry. Never block first paint on data.
    return { ...EMPTY, role: session.role };
  }
}
