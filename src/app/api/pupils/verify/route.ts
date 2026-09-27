import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';

const VerifySchema = z.object({
  pupil_id: z.string().min(1, 'Pupil ID is required'),
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).trim().optional().nullable(),
});

/**
 * POST /api/pupils/verify — Daycare Workers approve or reject a parent-submitted
 * enrollment (sociodemographic profile). Approval flips the pupil to 'enrolled'
 * and notifies the parent; a return ('rejected' in the database) records a
 * reason the parent can see, keeps their account, and lets them resubmit via
 * /api/pupils/resubmit. Parents are shown it as PENDING, never "rejected".
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers can verify enrollments.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = VerifySchema.parse(body);
    if (parsed.action === 'reject' && !parsed.reason?.trim()) {
      return NextResponse.json({ error: 'A reason is required when rejecting an enrollment.' }, { status: 400 });
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    // Load the pupil + its guardian (for the parent notification).
    const { data: pupil, error: pupilError } = await admin
      .from('pupils')
      .select('id, first_name, last_name, enrollment_status, guardian:guardians(user_id)')
      .eq('id', parsed.pupil_id)
      .maybeSingle();

    if (pupilError || !pupil) {
      return NextResponse.json({ error: 'Pupil not found.' }, { status: 404 });
    }
    if (pupil.enrollment_status !== 'pending') {
      return NextResponse.json(
        { error: `This enrollment is already ${pupil.enrollment_status}; only pending enrollments can be verified.` },
        { status: 409 }
      );
    }

    const status = parsed.action === 'approve' ? 'enrolled' : 'rejected';
    const verifiedAt = new Date().toISOString();
    // Conditional on still being pending, so a double-click or two workers
    // deciding at once cannot approve twice (and notify the parent twice).
    const { data: updated, error: updateError } = await admin
      .from('pupils')
      .update({
        enrollment_status: status,
        rejection_reason: parsed.action === 'reject' ? parsed.reason : null,
        verified_at: verifiedAt,
      })
      .eq('id', parsed.pupil_id)
      .eq('enrollment_status', 'pending')
      .select('id');
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'This enrollment was already decided.' }, { status: 409 });
    }

    const guardians = Array.isArray(pupil.guardian) ? pupil.guardian : [];
    const parentUserId = guardians.find((g: { user_id?: string | null }) => g.user_id)?.user_id || null;
    if (parentUserId) {
      const { error: notifError } = await admin.from('notifications').insert({
        recipient_user_id: parentUserId,
        pupil_id: parsed.pupil_id,
        type: 'enrollment',
        // Upper-case so an approval stands out in the parent's feed; a returned
        // enrollment is presented as still pending, never as "rejected".
        title: parsed.action === 'approve' ? 'ENROLLMENT APPROVED' : 'ENROLLMENT PENDING – ACTION NEEDED',
        message:
          parsed.action === 'approve'
            ? `${pupil.first_name} ${pupil.last_name}'s enrollment has been approved by the Daycare Worker. Student ID: ${parsed.pupil_id} — you can also sign in with it.`
            : `${pupil.first_name} ${pupil.last_name}'s enrollment is still pending. Please correct the following and resubmit from your portal: ${parsed.reason}`,
        channel: 'PORTAL',
        severity: parsed.action === 'approve' ? 'info' : 'medium',
      });
      if (notifError) {
        console.warn('[Verify API] Notification insert warning:', notifError.message);
      }
    }

    // Audit trail (immutable RA 10173 record).
    await recordAudit(admin, session, `Enrollment ${parsed.action === 'approve' ? 'approved' : 'rejected'}`, parsed.pupil_id, parsed.reason || null);

    return NextResponse.json({
      success: true,
      pupil: { id: parsed.pupil_id, enrollmentStatus: status, rejectionReason: parsed.reason || null, verifiedAt },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
