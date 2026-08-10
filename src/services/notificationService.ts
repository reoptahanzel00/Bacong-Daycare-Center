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

export async function fetchNotifications(recipientId?: string): Promise<Notification[]> {
  try {
    const url = recipientId
      ? `/api/notifications?recipient_id=${recipientId}`
      : '/api/notifications';
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    return data.notifications || [];
  } catch {
    return [];
  }
}

export async function sendNotification(payload: Omit<Notification, 'id' | 'read' | 'timestamp'>) {
  try {
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}
