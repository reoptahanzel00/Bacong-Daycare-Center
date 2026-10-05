import { NextResponse } from 'next/server';
import { z } from 'zod';
import { passwordSchema } from '@/lib/password';
import { rateLimited, clientIp } from '@/lib/rateLimit';
import { todayLocalISO, currentYearLocal } from '@/lib/dates';
import { recordAudit } from '@/lib/audit';
import { sendVerificationEmail, appOrigin } from '@/lib/emailVerification';
import { enrollmentAgeError, formatFullName } from '@/lib/enrollment';
import { createBirthCertUploadUrl } from '@/lib/enrollmentDocs';

const SignupSchema = z.object({
  role: z.enum(['worker', 'parent']).default('parent'),
  lastName: z.string().trim().min(1, 'Guardian last name is required').max(100),
  firstName: z.string().trim().min(1, 'Guardian first name is required').max(100),
  middleName: z.string().trim().max(100).optional().nullable(),
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  phone: z.string().max(20).optional(),
  // RA 10173: consent is a precondition, not a preference. The client hides the
  // submit button until it is ticked, but the API is the boundary that counts.
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Consent to the Privacy Notice is required to create an account.' }),
  }),
  consentVersion: z.string().min(1).max(60),
});

/** Per-child sociodemographic profile (ECCD Form Section 1) at signup. */
const ChildProfileSchema = z.object({
  // Asked first on the form: health and special needs.
  healthConditions: z.string().max(500).trim().optional().nullable(),
  hasSpecialNeeds: z.boolean().default(false),
  specialNeedsDetails: z.string().max(500).trim().optional().nullable(),
  firstName: z.string().min(1, "Child's first name is required").max(100).trim(),
  middleName: z.string().max(100).trim().optional().nullable(),
  lastName: z.string().min(1, "Child's last name is required").max(100).trim(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be YYYY-MM-DD'),
  sex: z.enum(['Male', 'Female']),
  // Bacong is pre-filled; a family from elsewhere picks "Other" and types it.
  barangay: z.string().trim().min(1, 'Barangay is required').max(100),
  municipality: z.string().trim().min(1, 'Municipality is required').max(100),
  province: z.string().trim().min(1, 'Province is required').max(100),
  region: z.string().trim().min(1, 'Region is required').max(100),
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
    if (await rateLimited(ip, 'signup', RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Checked before the body is validated. Public self-registration is for
    // parents only; worker accounts are provisioned by a
    // Daycare Worker and are never self-assignable. An attempt to claim one is
    // a refusal, not a validation problem — answering 400 because some other
    // field was also malformed would report privilege escalation as a typo.
    const requestedRole = (body as { role?: unknown })?.role;
    if (typeof requestedRole === 'string' && requestedRole !== 'parent') {
      return NextResponse.json(
        { error: `${requestedRole} accounts are created by the Daycare Worker.` },
        { status: 403 }
      );
    }

    const parsed = SignupBodySchema.parse(body);
    const email = parsed.email.toLowerCase();
    const fullName = formatFullName(parsed.lastName, parsed.firstName, parsed.middleName);

    if (parsed.role !== 'parent') {
      return NextResponse.json(
        { error: 'Only parent accounts can be self-registered.' },
        { status: 403 }
      );
    }
    if (!parsed.children || parsed.children.length === 0) {
      return NextResponse.json(
        { error: 'Please provide your child\'s sociodemographic profile to create a parent account.' },
        { status: 400 }
      );
    }

    // Enrollment is for children 3 years 1 month to 5 years (ECCD form).
    // Checked before any account exists so a refusal leaves nothing behind.
    const today = todayLocalISO();
    for (const [i, child] of parsed.children.entries()) {
      const ageError = enrollmentAgeError(child.birthDate, today);
      if (ageError) {
        return NextResponse.json({ error: `Child #${i + 1}: ${ageError}` }, { status: 400 });
      }
      if (child.hasSpecialNeeds && !child.specialNeedsDetails?.trim()) {
        return NextResponse.json(
          { error: `Child #${i + 1}: please describe the child's special needs.` },
          { status: 400 }
        );
      }
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    // 1. Create the auth account, confirmed.
    //
    // This used to pass email_confirm: false, on the belief that "Supabase sends
    // a verification link". It does not: admin.createUser() creates the account
    // directly and sends nothing — a confirmation mail only goes out through the
    // public signUp() flow, inviteUserByEmail() or generateLink(), none of which
    // this app calls. So a parent who registered got an account that was never
    // confirmed and never received a link, and on a project with email
    // confirmation enabled every later sign-in failed with "Email not confirmed"
    // — which the sign-in route reports, deliberately, as "Invalid email, Student
    // ID or password". Registration said success and the account was dead on
    // arrival, telling the parent their password was wrong.
    //
    // Confirming here matches the two paths that already work (users/create and
    // users/link-parent both pass true). It costs nothing in exposure: a
    // self-registered account can only ever see children a Daycare Worker has
    // since approved, and the pupil rows it submits start as 'pending'.
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: parsed.password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'parent',
      },
    });
    if (authError) {
      // Return a generic message on any auth failure so we do not reveal
      // whether an email address is already registered (account enumeration).
      console.warn('[Signup API] Auth error:', authError.message);
      return NextResponse.json(
        { error: 'Unable to create the account. Please check your details or contact the Daycare Worker.' },
        { status: 400 }
      );
    }

    // 2. Insert the parent profile.
    const { error: profileError } = await admin.from('users').insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      last_name: parsed.lastName,
      first_name: parsed.firstName,
      middle_name: parsed.middleName || null,
      role: 'parent',
      phone: parsed.phone || null,
      status: 'active',
      // Stored with the version so a later revision of the notice can require
      // re-consent instead of silently inheriting the old agreement.
      privacy_consent_at: new Date().toISOString(),
      privacy_consent_version: parsed.consentVersion,
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
        { error: 'Unable to create the account. Please try again or contact the Daycare Worker.' },
        { status: 500 }
      );
    }

    // 3. Create a pending pupil + guardian + sociodemographic profile for each
    //    submitted child. A Daycare Worker verifies before the child is
    //    officially enrolled.
    const createdPupilIds: string[] = [];
    let pupilCreateError: string | null = null;
    for (const child of parsed.children) {
      const pupilId = `PUP-${currentYearLocal()}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
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
        middle_name: child.middleName || null,
        last_name: child.lastName,
        birth_date: child.birthDate,
        sex: child.sex,
        address,
        health_conditions: child.healthConditions || null,
        has_special_needs: child.hasSpecialNeeds,
        special_needs_details: child.hasSpecialNeeds ? child.specialNeedsDetails || null : null,
        enrollment_status: 'pending',
        enrollment_date: today,
        submitted_at: new Date().toISOString(),
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
        full_name: fullName,
        last_name: parsed.lastName,
        first_name: parsed.firstName,
        middle_name: parsed.middleName || null,
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
      console.error('[Signup API] Child profile insert failed:', pupilCreateError);
    }

    // Prove the address. This does not gate sign-in — the account above is
    // already usable — it gates outbound email, because absence alerts name the
    // child and a typo at sign-up would send that to a stranger. Best effort: a
    // provider outage must not fail a registration that otherwise succeeded, so
    // the response says what actually happened instead of promising an email.
    const verification = await sendVerificationEmail(
      admin,
      authData.user.id,
      email,
      fullName,
      appOrigin(request)
    );

    // One single-use signed upload URL per child for the birth certificate.
    // The browser sends the file straight to private Storage; nothing else is
    // exposed. A child whose upload never lands shows the worker a
    // "Missing birth certificate" flag and can be completed on resubmission.
    const uploads: Array<{ pupilId: string; path: string; token: string }> = [];
    for (const pupilId of createdPupilIds) {
      const u = await createBirthCertUploadUrl(admin, pupilId);
      if (u) uploads.push({ pupilId, ...u });
    }

    await recordAudit(admin, { userId: authData.user.id, email, role: 'parent' }, 'Registered parent account', createdPupilIds.join(', ') || 'No child profile saved');

    // Saving stops at the first child that fails, so every child after it is
    // unsaved too. Say how many, rather than reporting the account as linked
    // and letting a parent of two believe both were submitted.
    const childrenNotSaved = parsed.children.length - createdPupilIds.length;
    const childMessage =
      createdPupilIds.length === 0
        ? 'Account created, but your child profile could not be saved. Please contact the Daycare Worker.'
        : childrenNotSaved > 0
          ? `Account created. ${createdPupilIds.length} of ${parsed.children.length} child profiles were submitted for verification; ${childrenNotSaved} could not be saved. Please contact the Daycare Worker to add ${childrenNotSaved === 1 ? 'that child' : 'those children'}.`
          : `Account created. ${createdPupilIds.length} child profile(s) submitted for verification by the Daycare Worker.`;

    // Only claim a confirmation email when one was actually handed to the
    // provider. Telling a parent to check an inbox nothing was sent to is the
    // same class of mistake as the confirmation link that was never sent.
    const verificationMessage = verification.sent
      ? ' Please check your email and confirm your address so we can send you absence alerts.'
      : '';

    return NextResponse.json({
      success: true,
      message: `${childMessage}${verificationMessage}`,
      linked: createdPupilIds.length > 0,
      childrenNotSaved,
      pupilIds: createdPupilIds,
      uploads,
      verificationEmailSent: verification.sent,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
