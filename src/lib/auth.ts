import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/contexts/DaycareContext';

export interface AuthSession {
  userId: string | null;
  email: string | null;
  role: UserRole;
  isAuthenticated: boolean;
}

/**
 * Server-side helper to retrieve and verify the current user's session and role.
 * Queries Supabase auth session and users profile table.
 */
export async function getServerSession(): Promise<AuthSession> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        userId: null,
        email: null,
        role: 'worker', // Fallback role for local unauthenticated demo mode
        isAuthenticated: false,
      };
    }

    // Retrieve verified role from users table or metadata / email fallback
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    let role: UserRole = (profile?.role as UserRole) || (user.user_metadata?.role as UserRole);
    if (!role) {
      const email = (user.email || '').toLowerCase();
      if (email.includes('official')) role = 'official';
      else if (email.includes('admin')) role = 'barangay_admin';
      else if (email.includes('parent')) role = 'parent';
      else role = 'worker';
    }

    return {
      userId: user.id,
      email: user.email || null,
      role,
      isAuthenticated: true,
    };
  } catch {
    // If Supabase environment is unavailable, allow local demo mode fallback
    return {
      userId: null,
      email: null,
      role: 'worker',
      isAuthenticated: false,
    };
  }
}

/**
 * Enforces role-based access control (RBAC) in server API handlers.
 * Returns true if allowed, false if rejected.
 */
export function authorizeRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}
