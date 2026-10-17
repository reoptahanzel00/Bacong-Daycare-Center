import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { PRIVACY_NOTICE_VERSION } from '@/lib/privacyNotice';

// Only the notice currently published at /privacy can be agreed to. A page left
// open across a release would otherwise record consent to wording the parent
// never saw.
const ConsentSchema = z.object({
  consentVersion: z.literal(PRIVACY_NOTICE_VERSION),
});

/**
 * POST — records a parent's consent to the current privacy notice.
 *
 * Reached from /privacy?consent=required, where a parent who agreed to an older
 * version is sent before the portal opens (see parentNeedsConsent). The users
 * table has no client write policy, so the update goes through the service role
 * after the session is verified here.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (session.role !== 'parent') {
      return NextResponse.json({ error: 'Only parent accounts record consent here.' }, { status: 403 });
    }

    const parsed = ConsentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'The privacy notice has changed. Reload the page and review it again.' },
        { status: 400 }
      );
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { error } = await admin
      .from('users')
      .update({ privacy_consent_at: new Date().toISOString(), privacy_consent_version: PRIVACY_NOTICE_VERSION })
      .eq('id', session.userId);
    if (error) {
      console.error('[Consent API] update failed:', error.message);
      return NextResponse.json({ error: 'Your consent could not be saved. Please try again.' }, { status: 503 });
    }

    await recordAudit(admin, session, 'Accepted privacy notice', 'Privacy notice', PRIVACY_NOTICE_VERSION);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
