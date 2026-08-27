import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationType = 'consecutive_absences' | 'announcement' | 'milestone';
export type NotificationSeverity = 'high' | 'medium' | 'info';
export type NotificationChannel = 'PORTAL' | 'EMAIL' | 'SMS';

interface NotifyTarget {
  user_id: string;
  pupil_id?: string;
}

interface NotifyPayload {
  type: NotificationType;
  title: string;
  message: string;
  channel?: NotificationChannel;
  severity?: NotificationSeverity;
}

/**
 * Best-effort server-side notification insert. Runs as the service role so it
 * bypasses RLS; failures are logged and never break the calling flow.
 * SMS/EMAIL channels are stored for future dispatch — PORTAL is delivered now.
 */
export async function notifyUsers(targets: NotifyTarget[], payload: NotifyPayload): Promise<void> {
  if (targets.length === 0) return;
  try {
    const admin = createAdminClient();
    const rows = targets.map((t) => ({
      recipient_user_id: t.user_id,
      pupil_id: t.pupil_id || null,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      channel: payload.channel || 'PORTAL',
      severity: payload.severity || 'info',
    }));
    const { error } = await admin.from('notifications').insert(rows);
    if (error) console.warn('[Notify] insert warning:', error.message);

    // Email dispatch (best-effort): resolved from the users table, only when
    // the EMAIL channel is requested and a provider is configured.
    if (payload.channel === 'EMAIL') {
      const { data: profiles } = await admin
        .from('users')
        .select('id, email')
        .in('id', targets.map((t) => t.user_id));
      // Dispatch in parallel: a class-wide alert is a handful of addresses, and
      // awaiting each in turn made the total wait the sum of every round trip.
      // allSettled so one bad address cannot stop the rest.
      await Promise.allSettled(
        (profiles || [])
          .filter((p) => p.email)
          .map((p) =>
            sendEmail({
              to: p.email as string,
              subject: payload.title,
              text: `${payload.message}\n\n— Barangay Bacong Daycare Center`,
            })
          )
      );
    }
  } catch (e) {
    console.warn('[Notify] skipped:', e);
  }
}

/** Auth user ids of the guardians linked to the given pupils (user_id set). */
export async function guardianUserIdsForPupils(
  admin: SupabaseClient,
  pupilIds: string[]
): Promise<NotifyTarget[]> {
  if (pupilIds.length === 0) return [];
  const { data, error } = await admin
    .from('guardians')
    .select('user_id, pupil_id')
    .in('pupil_id', pupilIds)
    .not('user_id', 'is', null);
  if (error) {
    console.warn('[Notify] guardian lookup warning:', error.message);
    return [];
  }
  return (data || []).map((g) => ({
    user_id: g.user_id as string,
    pupil_id: g.pupil_id,
  }));
}
