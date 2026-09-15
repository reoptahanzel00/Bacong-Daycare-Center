import 'server-only';
import type { createAdminClient } from '@/lib/supabase/admin';
import type { AuthSession } from '@/lib/auth';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Appends an entry to the audit trail from inside the route that made the
 * change.
 *
 * The capstone paper's Security criterion includes "maintenance of an accurate
 * audit trail". The trail used to be written by the browser after the fact, so
 * an action taken through the API directly — or a follow-up request that never
 * arrived — left no record (audit finding M1). Writing it here, from the
 * verified session, means every change that reaches the database is recorded
 * and attributed to the person who made it.
 *
 * Entries name records by ID (pupil ID, user ID, register date), not by a
 * child's name, so the trail itself holds as little personal data as possible.
 * A failure to write the entry is logged but never fails the action it records.
 */
export async function recordAudit(
  admin: AdminClient,
  actor: Pick<AuthSession, 'userId' | 'email' | 'role'>,
  action: string,
  target: string,
  details?: string | null
): Promise<void> {
  try {
    let userName = actor.email || 'unknown';
    if (actor.userId) {
      const { data } = await admin.from('users').select('full_name').eq('id', actor.userId).maybeSingle();
      if (data?.full_name) userName = data.full_name;
    }
    const { error } = await admin.from('audit_log').insert({
      user_id: actor.userId,
      user_name: userName,
      role: actor.role ?? 'unknown',
      action,
      target,
      details: details || null,
    });
    if (error) console.warn('[Audit] insert failed:', error.message);
  } catch (e) {
    console.warn('[Audit] insert failed:', e instanceof Error ? e.message : e);
  }
}
