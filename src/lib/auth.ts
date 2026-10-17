import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/contexts/DaycareContext';
import { PRIVACY_NOTICE_VERSION } from '@/lib/privacyNotice';

const VALID_ROLES: UserRole[] = ['worker', 'parent'];

export interface AuthSession {
  userId: string | null;
  email: string | null;
  role: UserRole | null; // null when unauthenticated or role is not provisioned
  isAuthenticated: boolean;
}

/**
 * Server-side helper to retrieve and verify the current user's session and role.
 * Queries Supabase auth session and the users profile table.
 *
 * Security notes:
 * - The `users` table is the single source of truth for roles. It is only
 *   written by an admin through the service role client, so a role read from it
 *   cannot be self-assigned. `user_metadata` is user-editable and MUST NOT be
 *   trusted for authorization.
 * - Fails CLOSED: any missing/errored session, missing profile, or unknown role
 *   results in an unauthenticated session.
 */
export async function getServerSession(): Promise<AuthSession> {
  const unauthenticated = (): AuthSession => ({
    userId: null,
    email: null,
    role: null,
    isAuthenticated: false,
  });

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return unauthenticated();

    const { data: profile } = await supabase
      .from('users')
      .select('role, status')
      .eq('id', user.id)
      .single();

    const role = profile?.role;
    if (!role || !VALID_ROLES.includes(role)) return unauthenticated();

    // Disabled accounts are rejected server-side, regardless of any client state.
    if (profile.status === 'disabled') return unauthenticated();

    return {
      userId: user.id,
      email: user.email || null,
      role,
      isAuthenticated: true,
    };
  } catch {
    // Supabase unavailable or query failed: fail closed. Never authorize a
    // request without a verified session and role.
    return unauthenticated();
  }
}

/**
 * True when the signed-in parent has not agreed to the current privacy notice:
 * either they consented to an older version, or there is no record of consent.
 *
 * RA 10173 consent has to be informed, so when the notice changes materially
 * (PRIVACY_NOTICE_VERSION is bumped) a parent who agreed to the old wording is
 * shown the new one before the portal opens. Staff are not asked; the notice is
 * addressed to parents. Fails closed: if the record cannot be read, consent is
 * treated as missing rather than assumed.
 */
export async function parentNeedsConsent(): Promise<boolean> {
  const session = await getServerSession();
  if (!session.isAuthenticated || session.role !== 'parent' || !session.userId) return false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('users')
      .select('privacy_consent_version')
      .eq('id', session.userId)
      .maybeSingle();
    if (error) return true;
    return data?.privacy_consent_version !== PRIVACY_NOTICE_VERSION;
  } catch {
    return true;
  }
}

/**
 * Enforces role-based access control (RBAC) in server API handlers.
 * Returns true if allowed, false if rejected.
 */
export function authorizeRole(userRole: UserRole | null, allowedRoles: UserRole[]): boolean {
  return userRole !== null && allowedRoles.includes(userRole);
}
