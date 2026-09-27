/** Parent absence notes via /api/parent-notes. */

export interface ParentNoteRow {
  id: string;
  pupil_id: string;
  user_id?: string | null;
  note_date: string;
  reason: string;
  notes: string;
  phone?: string | null;
  status: 'pending' | 'approved' | 'declined';
  /** Per-child sequence: "Excuse 1", "Excuse 2", ... */
  excuse_no?: number | null;
  reviewed_at?: string | null;
  submitted_at?: string;
}

export async function fetchParentNotes() {
  try {
    const res = await fetch('/api/parent-notes', { cache: 'no-store' });
    const data = await res.json();
    return { ok: res.ok, notes: (data.notes || []) as ParentNoteRow[], warning: data.warning as string | undefined };
  } catch {
    return { ok: false, notes: [] as ParentNoteRow[], warning: 'Network error' };
  }
}

export async function submitParentNote(payload: {
  pupil_id: string;
  date: string;
  reason: string;
  notes: string;
  phone?: string;
}) {
  try {
    const res = await fetch('/api/parent-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}

/** "Excuse 3" — the label parent and worker both see for a letter. */
export function excuseLabel(note: Pick<ParentNoteRow, 'excuse_no'>): string {
  return note.excuse_no ? `Excuse ${note.excuse_no}` : 'Excuse';
}

export async function reviewParentNote(id: string, status: 'approved' | 'declined') {
  try {
    const res = await fetch(`/api/parent-notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}
