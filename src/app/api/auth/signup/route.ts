import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimited, clientIp } from '@/lib/rateLimit';

const SignupSchema = z.object({
  role: z.enum(['worker', 'official', 'barangay_admin', 'parent']).default('parent'),
  fullName: z.string().min(2, 'Full name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  phone: z.string().max(20).optional(),
});

/** Per-child sociodemographic profile (ECCD Form Section 1) at signup. */
const ChildProfileSchema = z.object({
  firstName: z.string().min(1, "Child's first name is required").max(100).trim(),
  lastName: z.string().min(1, "Child's last name is required").max(100).trim(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be YYYY-MM-DD'),
  sex: z.enum(['Male', 'Female']),
  barangay: z.string().max(100).trim(),
  municipality: z.string().max(100).trim(),
  province: z.string().max(100).trim(),
  region: z.string().max(100).trim(),
  handedness: z.enum(['right', 'left', 'both', 'not_yet_established']),
  currentlyStudying: z.boolean().default(false),
  schoolName: z.string().max(150).trim().optional().nullable(),
  relationship: z.enum(['Mother', 'Father', 'Grandmother', 'Grandfather', 'Legal Guardian']),
  fatherName: z.string().max(100).trim().optional().nullable(),
  fatherAge: z.number().int().min(0).max(120).optional().nullable(),
  fatherOccupation: z.string().max(100).trim().optional().nullable(),
  fatherEducation: z.string().max(100).trim().optional().nullable(),
  motherName: z.string().max(100).trim().optional().nullable(),
  motherAge: z.number().int().min(0).max(120).optional().nullable(),
  motherOccupation: z.string().max(100).trim().optional().nullable(),
  motherEducation: z.string().max(100).trim().optional().nullable(),
  siblingsCount: z.number().int().min(0).max(50).optional().nullable(),
  birthOrder: z.string().max(50).trim().optional().nullable(),
});

// Parents must submit at least one child profile at signup (max 5).
const ChildrenSchema = z
  .array(ChildProfileSchema)
  .min(1, 'Please provide your child\'s sociodemographic profile.')
  .max(5, 'You can register up to 5 children at a time.')
  .optional();

const SignupBodySchema = SignupSchema.extend({ children: ChildrenSchema });

const RATE_LIMIT = 5; // per window
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * POST — parent self-registration. Creates the auth account + parent profile,
 * then auto-links the account to a guardian record when the supplied phone
 * matches. Unlinked accounts are visible to admins for manual linking.
 */
export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (rateLimited(ip, 'signup', RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = SignupBodySchema.parse(body);
    const email = parsed.email.toLowerCase();

    // Public self-registration is for parents only. Worker/Official/Admin
    // accounts must be provisioned by a Barangay Admin — never self-assignable.
    if (parsed.role !== 'parent') {
      return NextResponse.json(
        { error: `${parsed.role} accounts are created by the Barangay Admin. Please contact the IT Administration.` },
        { status: 403 }
      );
    }
    if (!parsed.children || parsed.children.length === 0) {
      return NextResponse.json(
        { error: 'Please provide your child\'s sociodemographic profile to create a parent account.' },
        { status: 400 }
      );
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    // 1. Create the auth account.
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: parsed.password,
      email_confirm: true,
      user_metadata: {
        full_name: parsed.fullName,
        role: 'parent',
      },
    });
    if (authError) {
      // Return a generic message on any auth failure so we do not reveal
      // whether an email address is already registered (account enumeration).
      console.warn('[Signup API] Auth error:', authError.message);
      return NextResponse.json(
        { error: 'Unable to create the account. Please check your details or contact the Barangay Admin.' },
        { status: 400 }
      );
    }

    // 2. Insert the parent profile.
    const { error: profileError } = await admin.from('users').insert({
      id: authData.user.id,
      email,
      full_name: parsed.fullName,
      role: 'parent',
      phone: parsed.phone || null,
      status: 'active',
    });
    if (profileError) {
      // The profile row is what makes an account usable: without it sign-in is
      // rejected as "not provisioned" AND the email is taken, so the parent can
      // neither log in nor register again. Roll the auth account back instead
      // of leaving an unrecoverable orphan. Everything below also depends on
      // this row through the guardians.user_id foreign key.
      console.error('[Signup API] Profile insert failed, rolling back auth user:', profileError.message);
      await admin.auth.admin.deleteUser(authData.user.id).catch(() => {});
      return NextResponse.json(
        { error: 'Unable to create the account. Please try again or contact the Barangay Admin.' },
        { status: 500 }
      );
    }

    // 3. Create a pending pupil + guardian + sociodemographic profile for each
    //    submitted child. A Daycare Worker verifies before the child is
    //    officially enrolled.
    const createdPupilIds: string[] = [];
    let pupilCreateError: string | null = null;
    for (const child of parsed.children) {
      const pupilId = `PUP-${new Date().getFullYear()}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
      const address = [
        child.barangay.trim(),
        child.municipality.trim(),
        child.province.trim(),
        child.region.trim(),
      ]
        .filter((part) => part.length > 0)
        .join(', ');

      // Tracks whether the pupil row landed, so a failure in the guardian or
      // profile insert below can be unwound instead of leaving a half-built
      // child record that the worker can neither verify nor reject.
      const { error: pupilError } = await admin.from('pupils').insert({
        id: pupilId,
        first_name: child.firstName,
        last_name: child.lastName,
        birth_date: child.birthDate,
        sex: child.sex,
        address,
        enrollment_status: 'pending',
        enrollment_date: new Date().toISOString().split('T')[0],
        consecutive_absences: 0,
        created_by: authData.user.id,
      });
      if (pupilError) {
        pupilCreateError = pupilError.message;
        break;
      }

      const rollbackPupil = async () => {
        // ON DELETE CASCADE removes the guardian and sociodemographic rows.
        await admin.from('pupils').delete().eq('id', pupilId);
      };

      const { error: guardianError } = await admin.from('guardians').insert({
        pupil_id: pupilId,
        user_id: authData.user.id,
        full_name: parsed.fullName,
        relationship: child.relationship,
        phone: parsed.phone || 'Not provided',
        is_primary_contact: true,
      });
      if (guardianError) {
        pupilCreateError = guardianError.message;
        await rollbackPupil();
        break;
      }

      const { error: profileError } = await admin.from('sociodemographic_profiles').insert({
        pupil_id: pupilId,
        handedness: child.handedness,
        currently_studying: child.currentlyStudying,
        school_name: child.schoolName || null,
        barangay: child.barangay,
        municipality: child.municipality,
        province: child.province,
        region: child.region,
        father_name: child.fatherName || null,
        father_age: child.fatherAge ?? null,
        father_occupation: child.fatherOccupation || null,
        father_education: child.fatherEducation || null,
        mother_name: child.motherName || null,
        mother_age: child.motherAge ?? null,
        mother_occupation: child.motherOccupation || null,
        mother_education: child.motherEducation || null,
        siblings_count: child.siblingsCount ?? null,
        birth_order: child.birthOrder || null,
        updated_by: authData.user.id,
      });
      if (profileError) {
        pupilCreateError = profileError.message;
        await rollbackPupil();
        break;
      }
      createdPupilIds.push(pupilId);
    }

    if (pupilCreateError) {
      console.warn('[Signup API] Child profile insert warning:', pupilCreateError);
    }

    return NextResponse.json({
      success: true,
      message:
        createdPupilIds.length > 0
          ? `Account created. ${createdPupilIds.length} child profile(s) submitted for verification by the Daycare Worker.`
          : 'Account created, but your child profile could not be saved. Please contact the Barangay Admin.',
      linked: createdPupilIds.length > 0,
      pupilIds: createdPupilIds,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
