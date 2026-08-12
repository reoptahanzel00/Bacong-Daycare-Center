/**
 * Notification Service — abstraction over the /api/notifications endpoint.
 */

export interface Notification {
  id: string;
  recipient_id: string;
  pupil_id?: string;
  type: 'consecutive_absences' | 'announcement' | 'milestone';
  title: string;
  message: string;
  channel: string;
  severity: 'high' | 'medium' | 'info';
  read: boolean;
  timestamp: string;
}

export async function fetchNotifications(): Promise<Notification[]> {
  try {
    const res = await fetch('/api/notifications', { cache: 'no-store' });
    const data = await res.json();
    return data.notifications || [];
  } catch {
    return [];
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

export async function markRead(id: string) {
  try {
    const res = await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}
