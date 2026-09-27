import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth';
import {
  birthCertDownloadUrl,
  createBirthCertUploadUrl,
  pupilsWithBirthCert,
} from '@/lib/enrollmentDocs';

const PupilIdSchema = z.string().regex(/^PUP-\d{4}-[A-Z0-9]{4,12}$/, 'Invalid pupil ID');

/** Whether the signed-in parent is a linked guardian of the pupil. */
async function isGuardianOf(
  admin: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  userId: string,
  pupilId: string
): Promise<boolean> {
  const { data } = await admin
    .from('guardians')
    .select('id')
    .eq('pupil_id', pupilId)
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * GET /api/pupils/documents
 *   ?pupil_id=X  → { hasBirthCert, url } (worker, or the child's guardian)
 *   ?pupil_ids=A,B,C → { withBirthCert: [...] } (worker only; verify queue flags)
 */
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session.isAuthenticated || !session.userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();

  const many = searchParams.get('pupil_ids');
  if (many !== null) {
    if (session.role !== 'worker') {
      return NextResponse.json({ error: 'Only the Daycare Worker can list documents.' }, { status: 403 });
    }
    const ids = many.split(',').map((s) => s.trim()).filter((s) => PupilIdSchema.safeParse(s).success);
    const found = await pupilsWithBirthCert(admin, ids);
    return NextResponse.json({ withBirthCert: [...found] });
  }

  const parsed = PupilIdSchema.safeParse(searchParams.get('pupil_id'));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid pupil ID.' }, { status: 400 });
  const pupilId = parsed.data;

  if (session.role !== 'worker' && !(await isGuardianOf(admin, session.userId, pupilId))) {
    return NextResponse.json({ error: 'Not your child.' }, { status: 403 });
  }
  const url = await birthCertDownloadUrl(admin, pupilId);
  return NextResponse.json({ hasBirthCert: Boolean(url), url });
}

/**
 * POST /api/pupils/documents { pupil_id } → { path, token }
 * A single-use signed upload URL for the child's birth certificate. Parents
 * may upload for their own child while the enrollment is pending or returned;
 * the worker may upload for any child.
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session.isAuthenticated || !session.userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const parsed = PupilIdSchema.safeParse((body as { pupil_id?: unknown })?.pupil_id);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid pupil ID.' }, { status: 400 });
  const pupilId = parsed.data;

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();

  if (session.role !== 'worker') {
    if (!(await isGuardianOf(admin, session.userId, pupilId))) {
      return NextResponse.json({ error: 'Not your child.' }, { status: 403 });
    }
    const { data: pupil } = await admin
      .from('pupils')
      .select('enrollment_status')
      .eq('id', pupilId)
      .maybeSingle();
    if (!pupil || !['pending', 'rejected'].includes(pupil.enrollment_status)) {
      return NextResponse.json(
        { error: 'Documents can only be changed while the enrollment is pending.' },
        { status: 409 }
      );
    }
  }

  const upload = await createBirthCertUploadUrl(admin, pupilId);
  if (!upload) {
    return NextResponse.json({ error: 'Document upload is unavailable right now.' }, { status: 503 });
  }
  return NextResponse.json(upload);
}
