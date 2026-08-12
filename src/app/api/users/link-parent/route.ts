import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';

const LinkParentSchema = z.object({
  pupil_id: z.string().min(1, 'Pupil ID is required'),
  guardian_id: z.string().uuid('Guardian ID must be a valid UUID'),
  mode: z.enum(['existing', 'create']),
  // existing mode
  email: z.string().email('Invalid email address').optional(),
  // create mode
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['barangay_admin'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Barangay Admins can link parent accounts.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = LinkParentSchema.parse(body);

    if (parsed.mode === 'existing' && !parsed.email) {
      return NextResponse.json({ error: 'Email is required to link an existing account.' }, { status: 400 });
    }
    if (parsed.mode === 'create' && (!parsed.email || !parsed.password)) {
      return NextResponse.json({ error: 'Email and password are required to create a parent account.' }, { status: 400 });
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    // 1. Verify the guardian belongs to the given pupil.
    const { data: guardian, error: guardianError } = await admin
      .from('guardians')
      .select('id, pupil_id, full_name, user_id')
      .eq('id', parsed.guardian_id)
      .single();

    if (guardianError || !guardian || guardian.pupil_id !== parsed.pupil_id) {
      return NextResponse.json({ error: 'Guardian record not found for this pupil.' }, { status: 400 });
    }

    let parentUserId: string;

    if (parsed.mode === 'existing') {
      // Resolve the account by email (users table is the profile source of truth).
      const { data: profile, error: profileError } = await admin
        .from('users')
        .select('id, email, role')
        .eq('email', (parsed.email as string).toLowerCase())
        .maybeSingle();

      if (profileError || !profile) {
        return NextResponse.json({ error: `No account found for ${parsed.email}. Create the parent account instead.` }, { status: 404 });
      }
      parentUserId = profile.id;
    } else {
      // Create the auth account, then the profile row, then link.
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: parsed.email as string,
        password: parsed.password as string,
        email_confirm: true,
        user_metadata: {
          full_name: guardian.full_name,
          role: 'parent',
        },
      });

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      const { error: profileError } = await admin.from('users').upsert({
        id: authData.user.id,
        email: (parsed.email as string).toLowerCase(),
        full_name: guardian.full_name,
        role: 'parent',
        status: 'active',
      });

      if (profileError) {
        console.warn('[Link Parent API] Profile insert warning:', profileError.message);
      }
      parentUserId = authData.user.id;
    }

    // 2. Link the parent account to the guardian row.
    const { error: linkError } = await admin
      .from('guardians')
      .update({ user_id: parentUserId })
      .eq('id', guardian.id);

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `${guardian.full_name} linked to ${parsed.email}.`,
      guardian_id: guardian.id,
      user_id: parentUserId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
