/**
 * Audit Service — abstraction over the /api/audit-log endpoint.
 * Entries are immutable: the server derives the actor from the verified
 * session, so client payloads only carry action/target/details.
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

export async function logAuditEntry(action: string, target: string, details?: string) {
  try {
    const res = await fetch('/api/audit-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, target, details }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
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
