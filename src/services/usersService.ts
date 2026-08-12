/**
 * Users Service — abstraction over the /api/users endpoints (admin only).
 */

export interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string | null;
  status: string;
  created_at?: string;
}

export async function fetchUsers() {
  try {
    const res = await fetch('/api/users', { cache: 'no-store' });
    const data = await res.json();
    return { ok: res.ok, users: (data.users || []) as UserRow[], warning: data.warning as string | undefined };
  } catch {
    return { ok: false, users: [] as UserRow[], warning: 'Network error' };
  }
}

export async function updateUserStatus(id: string, status: 'active' | 'disabled') {
  try {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}
