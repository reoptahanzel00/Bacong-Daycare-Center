import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';

const VerifySchema = z.object({
  pupil_id: z.string().min(1, 'Pupil ID is required'),
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).trim().optional().nullable(),
});

/**
 * POST /api/pupils/verify — Daycare Workers approve or reject a parent-submitted
 * enrollment (sociodemographic profile). Approval flips the pupil to 'enrolled'
 * and notifies the parent; rejection records a reason the parent can see.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker', 'barangay_admin'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers or Barangay Admins can verify enrollments.' },
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
    const { error: updateError } = await admin
      .from('pupils')
      .update({
        enrollment_status: status,
        rejection_reason: parsed.action === 'reject' ? parsed.reason : null,
      })
      .eq('id', parsed.pupil_id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const guardians = Array.isArray(pupil.guardian) ? pupil.guardian : [];
    const parentUserId = guardians.find((g: { user_id?: string | null }) => g.user_id)?.user_id || null;
    if (parentUserId) {
      const { error: notifError } = await admin.from('notifications').insert({
        recipient_user_id: parentUserId,
        pupil_id: parsed.pupil_id,
        type: 'enrollment',
        title: parsed.action === 'approve' ? 'Enrollment approved' : 'Enrollment needs attention',
        message:
          parsed.action === 'approve'
            ? `${pupil.first_name} ${pupil.last_name}'s enrollment has been approved by the Daycare Worker.`
            : `The Daycare Worker could not approve ${pupil.first_name} ${pupil.last_name}'s enrollment: ${parsed.reason}`,
        channel: 'PORTAL',
        severity: parsed.action === 'approve' ? 'info' : 'medium',
      });
      if (notifError) {
        console.warn('[Verify API] Notification insert warning:', notifError.message);
      }
    }

    // Audit trail (immutable RA 10173 record).
    const { error: auditError } = await admin.from('audit_log').insert({
      user_id: session.userId,
      user_name: session.email || 'unknown',
      role: session.role,
      action: `Enrollment ${parsed.action === 'approve' ? 'Approved' : 'Rejected'}`,
      target: parsed.pupil_id,
      details: parsed.reason || `${pupil.first_name} ${pupil.last_name}`,
    });
    if (auditError) {
      console.warn('[Verify API] Audit insert warning:', auditError.message);
    }

    return NextResponse.json({
      success: true,
      pupil: { id: parsed.pupil_id, enrollmentStatus: status, rejectionReason: parsed.reason || null },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
