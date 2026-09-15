/**
 * Audit Service — reads the audit trail via GET /api/audit-log.
 * Entries are written by the server routes that make each change
 * (src/lib/audit.ts), never by the browser.
 */

export interface AuditLogRow {
  id: string;
  user_id?: string | null;
  user_name: string;
  role: string;
  action: string;
  target: string;
  details?: string | null;
  created_at?: string;
}

export async function fetchAuditLogs() {
  try {
    const res = await fetch('/api/audit-log', { cache: 'no-store' });
    const data = await res.json();
    return { ok: res.ok, logs: (data.logs || []) as AuditLogRow[], warning: data.warning as string | undefined };
  } catch {
    return { ok: false, logs: [] as AuditLogRow[], warning: 'Network error' };
  }
}
