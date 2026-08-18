/** Announcements via /api/announcements. */

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  posted_by?: string | null;
  /** Resolved author display name (may be null for staff/non-admin sessions). */
  author_name?: string | null;
  created_at?: string;
}

export async function fetchAnnouncements() {
  try {
    const res = await fetch('/api/announcements', { cache: 'no-store' });
    const data = await res.json();
    return { ok: res.ok, announcements: (data.announcements || []) as AnnouncementRow[], warning: data.warning as string | undefined };
  } catch {
    return { ok: false, announcements: [] as AnnouncementRow[], warning: 'Network error' };
  }
}

export async function publishAnnouncement(title: string, body: string) {
  try {
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}
