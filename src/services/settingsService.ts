/**
 * Centre Settings Service — abstraction over /api/settings.
 * Mirrors the other services so components never fetch directly.
 */

export interface CenterSettingsRow {
  center_name: string;
  daycare_worker_name: string;
  barangay_captain_name: string;
}

export const EMPTY_SETTINGS: CenterSettingsRow = {
  center_name: 'Barangay Bacong Daycare Center',
  daycare_worker_name: '',
  barangay_captain_name: '',
};

export async function fetchSettings() {
  try {
    const res = await fetch('/api/settings', { cache: 'no-store' });
    const data = await res.json();
    return { ok: res.ok, settings: (data.settings || EMPTY_SETTINGS) as CenterSettingsRow };
  } catch {
    return { ok: false, settings: EMPTY_SETTINGS };
  }
}

export async function updateSettings(settings: CenterSettingsRow) {
  try {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}
