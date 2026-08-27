import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const CreateUserSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(100),
  email: z.string().email('Invalid email address'),
  role: z.enum(['worker', 'official', 'barangay_admin', 'parent']),
  phone: z.string().max(20).optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['barangay_admin'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Barangay Admins can provision new system accounts.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = CreateUserSchema.parse(body);

    const adminSupabase = createAdminClient();

    // 1. Create account in Supabase Auth
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: parsed.email.toLowerCase(),
      password: parsed.password,
      email_confirm: true,
      user_metadata: {
        full_name: parsed.fullName,
        role: parsed.role,
      },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // 2. Insert profile into PostgreSQL users table
    const { error: profileError } = await adminSupabase.from('users').upsert({
      id: authData.user.id,
      email: parsed.email.toLowerCase(),
      full_name: parsed.fullName,
      role: parsed.role,
      phone: parsed.phone || null,
      status: 'active',
    });

    if (profileError) {
      // Without the profile row the account cannot sign in ("not provisioned")
      // and its email is already taken, so it can never be re-provisioned.
      // Roll the auth account back rather than report a success that isn't one.
      console.error('[Create User API] Profile insert failed, rolling back auth user:', profileError.message);
      await adminSupabase.auth.admin.deleteUser(authData.user.id).catch(() => {});
      return NextResponse.json(
        { error: 'Account could not be provisioned. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Account created successfully for ${parsed.fullName} (${parsed.role}).`,
      user: {
        id: authData.user.id,
        email: parsed.email,
        full_name: parsed.fullName,
        role: parsed.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
