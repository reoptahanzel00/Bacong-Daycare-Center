import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const CreateUserSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(100),
  email: z.string().email('Invalid email address'),
  role: z.enum(['worker', 'official', 'barangay_admin', 'parent']),
  phone: z.string().max(20).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').default('Password123!'),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (session.isAuthenticated && !authorizeRole(session.role, ['barangay_admin'])) {
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
      email: parsed.email,
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
      email: parsed.email,
      full_name: parsed.fullName,
      role: parsed.role,
      phone: parsed.phone || null,
      status: 'active',
    });

    if (profileError) {
      console.warn('[Create User API] Profile insert warning:', profileError.message);
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
