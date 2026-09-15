import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
// A route handler may only export HTTP methods, so the shape and its fallback
// live with the service that both sides already import.
import { EMPTY_SETTINGS } from '@/services/settingsService';
import { recordAudit } from '@/lib/audit';

/**
 * Centre settings — the names that appear on DSWD Form 1 and across the portals.
 *
 * These were hardcoded, so every generated copy of an official, signed document
 * credited the same two people regardless of who produced it and who currently
 * holds the office. The barangay captain changes with elections, so this has to
 * be editable without a deploy.
 */

const UpdateSettingsSchema = z.object({
  center_name: z.string().min(1, 'Centre name is required').max(150).trim(),
  daycare_worker_name: z.string().max(150).trim(),
  barangay_captain_name: z.string().max(150).trim(),
});

/** GET — any signed-in user; the report and the portals all read these. */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    // RLS allows every authenticated role to read this row, so the session
    // client is enough — no service role needed.
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('center_settings')
      .select('center_name, daycare_worker_name, barangay_captain_name')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ settings: EMPTY_SETTINGS, warning: error.message });
    }
    return NextResponse.json({ settings: data || EMPTY_SETTINGS });
  } catch {
    return NextResponse.json({ settings: EMPTY_SETTINGS, warning: 'Settings unavailable.' });
  }
}

/** PATCH — admin only. Writes go through the service role; RLS has no write policy. */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers can change centre settings.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = UpdateSettingsSchema.parse(body);

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('center_settings')
      .update({ ...parsed, updated_by: session.userId, updated_at: new Date().toISOString() })
      .eq('id', true)
      .select('center_name, daycare_worker_name, barangay_captain_name')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Who signs the barangay's official reports is worth an audit entry.
    await recordAudit(admin, session, 'Updated centre settings', parsed.center_name,
      `Daycare worker: ${parsed.daycare_worker_name || 'not set'}; Barangay captain: ${parsed.barangay_captain_name || 'not set'}.`);

    return NextResponse.json({ success: true, settings: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
