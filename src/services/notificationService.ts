/**
 * Notification Service — abstraction over the /api/notifications endpoint.
 */

export interface Notification {
  id: string;
  recipient_id: string;
  pupil_id?: string;
  type: 'consecutive_absences' | 'milestone' | 'enrollment' | 'announcement';
  title: string;
  message: string;
  channel: string;
  severity: 'high' | 'medium' | 'info';
  read: boolean;
  timestamp: string;
}

/**
 * The caller's feed, or null when it could not be loaded. Null rather than an
 * empty list so the bell keeps what it already shows on a failed refresh
 * instead of announcing "No notifications" during a network blip.
 */
export async function fetchNotifications(): Promise<Notification[] | null> {
  try {
    const res = await fetch('/api/notifications', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.warning) return null;
    return data.notifications || [];
  } catch {
    return null;
  }
}

export async function markAllRead() {
  try {
    const res = await fetch('/api/notifications/read-all', {
      method: 'POST',
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}

/** Marks a single notification read (when it is opened from the bell). */
export async function markRead(id: string) {
  try {
    const res = await fetch(`/api/notifications/${encodeURIComponent(id)}`, { method: 'PATCH' });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}

/**
 * The tab a notification is about, so opening it takes the reader to the thing
 * that needs doing. The database type list predates excuse letters, which are
 * stored as 'enrollment' and told apart by title.
 */
export function notificationTab(n: Pick<Notification, 'type' | 'title'>, role: string): string | null {
  const isExcuse = /excuse/i.test(n.title);
  if (role === 'worker') {
    if (n.type === 'consecutive_absences') return 'dashboard';
    if (isExcuse) return 'parent_notes_inbox';
    if (n.type === 'enrollment') return 'verify';
    return null;
  }
  if (role === 'parent') {
    if (isExcuse) return 'parent_notes';
    return 'child';
  }
  return null;
}
