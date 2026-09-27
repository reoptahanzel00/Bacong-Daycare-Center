import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';
import { enrollmentAgeError } from '@/lib/enrollment';
import { todayLocalISO } from '@/lib/dates';
import { recordAudit } from '@/lib/audit';
import { notifyUsers } from '@/lib/notify';

const ResubmitSchema = z.object({
  pupil_id: z.string().regex(/^PUP-\d{4}-[A-Z0-9]{4,12}$/, 'Invalid pupil ID'),
  firstName: z.string().trim().min(1, "Child's first name is required").max(100),
  middleName: z.string().trim().max(100).optional().nullable(),
  lastName: z.string().trim().min(1, "Child's last name is required").max(100),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be YYYY-MM-DD'),
  sex: z.enum(['Male', 'Female']),
  healthConditions: z.string().trim().max(500).optional().nullable(),
  hasSpecialNeeds: z.boolean().default(false),
  specialNeedsDetails: z.string().trim().max(500).optional().nullable(),
  barangay: z.string().trim().min(1, 'Barangay is required').max(100),
  municipality: z.string().trim().min(1, 'Municipality is required').max(100),
  province: z.string().trim().min(1, 'Province is required').max(100),
  region: z.string().trim().min(1, 'Region is required').max(100),
});

/**
 * POST /api/pupils/resubmit — a parent corrects an enrollment the Daycare
 * Worker returned and sends it back for verification.
 *
 * A return is not the end of an enrollment: the parent's account stays active,
 * they see the child as PENDING with the worker's reason, fix what was asked
 * (details here, the birth certificate through /api/pupils/documents), and the
 * record goes back into the worker's queue as `pending`. This is the ONLY path
 * out of `rejected`; /api/pupils keeps it sticky.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['parent'])) {
      return NextResponse.json({ error: 'Only the child\'s parent or guardian can resubmit.' }, { status: 403 });
    }

    const parsed = ResubmitSchema.parse(await request.json());
    const ageError = enrollmentAgeError(parsed.birthDate, todayLocalISO());
    if (ageError) return NextResponse.json({ error: ageError }, { status: 400 });
    if (parsed.hasSpecialNeeds && !parsed.specialNeedsDetails?.trim()) {
      return NextResponse.json({ error: "Please describe the child's special needs." }, { status: 400 });
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const { data: link } = await admin
      .from('guardians')
      .select('id')
      .eq('pupil_id', parsed.pupil_id)
      .eq('user_id', session.userId)
      .maybeSingle();
    if (!link) return NextResponse.json({ error: 'Not your child.' }, { status: 403 });

    const { data: pupil } = await admin
      .from('pupils')
      .select('enrollment_status, resubmission_count')
      .eq('id', parsed.pupil_id)
      .maybeSingle();
    if (!pupil) return NextResponse.json({ error: 'Pupil not found.' }, { status: 404 });
    if (pupil.enrollment_status !== 'rejected') {
      return NextResponse.json(
        { error: 'Only an enrollment returned by the Daycare Worker can be resubmitted.' },
        { status: 409 }
      );
    }

    const address = [parsed.barangay, parsed.municipality, parsed.province, parsed.region].join(', ');
    const { data: updated, error: updateError } = await admin
      .from('pupils')
      .update({
        first_name: parsed.firstName,
        middle_name: parsed.middleName || null,
        last_name: parsed.lastName,
        birth_date: parsed.birthDate,
        sex: parsed.sex,
        address,
        health_conditions: parsed.healthConditions || null,
        has_special_needs: parsed.hasSpecialNeeds,
        special_needs_details: parsed.hasSpecialNeeds ? parsed.specialNeedsDetails || null : null,
        enrollment_status: 'pending',
        rejection_reason: null,
        verified_at: null,
        submitted_at: new Date().toISOString(),
        resubmission_count: (pupil.resubmission_count ?? 0) + 1,
      })
      .eq('id', parsed.pupil_id)
      .eq('enrollment_status', 'rejected')
      .select('id');
    if (updateError || !updated || updated.length === 0) {
      return NextResponse.json({ error: 'The enrollment could not be resubmitted. Please try again.' }, { status: 409 });
    }

    const { error: profileError } = await admin
      .from('sociodemographic_profiles')
      .update({
        barangay: parsed.barangay,
        municipality: parsed.municipality,
        province: parsed.province,
        region: parsed.region,
        updated_by: session.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('pupil_id', parsed.pupil_id);
    if (profileError) console.warn('[Resubmit API] profile update warning:', profileError.message);

    const { data: workers } = await admin
      .from('users')
      .select('id')
      .eq('role', 'worker')
      .eq('status', 'active');
    await notifyUsers(
      (workers || []).map((w) => ({ user_id: w.id, pupil_id: parsed.pupil_id })),
      {
        type: 'enrollment',
        title: 'Enrollment resubmitted',
        message: `${parsed.firstName} ${parsed.lastName}'s enrollment was corrected by the parent and is back in the Verify Enrollments queue.`,
        severity: 'medium',
      }
    );

    await recordAudit(admin, session, 'Enrollment resubmitted', parsed.pupil_id, null);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
