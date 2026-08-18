import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole, type AuthSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const NoteField = z.string().max(2000, 'Max 2000 characters').trim().optional().nullable();

const SaveBackgroundSchema = z.object({
  pupil_id: z.string().min(1, 'Pupil ID is required'),
  child_background: NoteField,
  family_environment: NoteField,
  stimulating_activities: NoteField,
  home_environment: NoteField,
  others: NoteField,
});

/** Parents may only touch pupils linked to their account via guardians. */
async function parentOwnsPupil(admin: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>, session: AuthSession, pupilId: string) {
  const { data } = await admin
    .from('guardians')
    .select('pupil_id')
    .eq('user_id', session.userId)
    .eq('pupil_id', pupilId)
    .maybeSingle();
  return !!data;
}

/** GET ?pupil_id= — the child & family background record (one per pupil). */
export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pupilId = searchParams.get('pupil_id');
    if (!pupilId) {
      return NextResponse.json({ error: 'pupil_id query parameter is required.' }, { status: 400 });
    }

    // RLS-bound session client: parents read linked children only; staff read
    // all (policies in schema.sql). No service role needed for this read.
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('child_backgrounds')
      .select('*')
      .eq('pupil_id', pupilId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ background: null, warning: error.message });
    }
    return NextResponse.json({ background: data || null });
  } catch {
    return NextResponse.json({ background: null, warning: 'Background unavailable.' });
  }
}

/**
 * POST — create/update the child & family background record.
 * Parents may write only their own linked children; workers/admins any pupil;
 * officials are read-only.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['parent', 'worker', 'barangay_admin'])) {
      return NextResponse.json(
        { error: 'Unauthorized: only Parents, Daycare Workers, or Admins can save background info.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = SaveBackgroundSchema.parse(body);

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    if (session.role === 'parent' && !(await parentOwnsPupil(admin, session, parsed.pupil_id))) {
      return NextResponse.json({ error: 'Unauthorized: this pupil is not linked to your account.' }, { status: 403 });
    }

    const row = {
      pupil_id: parsed.pupil_id,
      child_background: parsed.child_background ?? null,
      family_environment: parsed.family_environment ?? null,
      stimulating_activities: parsed.stimulating_activities ?? null,
      home_environment: parsed.home_environment ?? null,
      others: parsed.others ?? null,
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from('child_backgrounds')
      .upsert(row, { onConflict: 'pupil_id' })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, background: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
