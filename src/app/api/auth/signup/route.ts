import { NextResponse } from 'next/server';
import { z } from 'zod';

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

/**
 * Lightweight in-memory rate limiter (per IP). Best-effort protection for the
 * public signup surface; not a substitute for a full gateway-level limiter.
 */
const signupAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5; // per window
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = signupAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    signupAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

/**
 * POST — parent self-registration. Creates the auth account + parent profile,
 * then auto-links the account to a guardian record when the supplied phone
 * matches. Unlinked accounts are visible to admins for manual linking.
 */
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    if (rateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = SignupSchema.parse(body);
    const email = parsed.email.toLowerCase();

    // Public self-registration is for parents only. Worker/Official/Admin
    // accounts must be provisioned by a Barangay Admin — never self-assignable.
    if (parsed.role !== 'parent') {
      return NextResponse.json(
        { error: `${parsed.role} accounts are created by the Barangay Admin. Please contact the IT Administration.` },
        { status: 403 }
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
      return NextResponse.json({ error: authError.message }, { status: 400 });
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
      console.warn('[Signup API] Profile insert warning:', profileError.message);
    }

    // 3. Auto-link when the guardian phone matches an existing record.
    let linked = false;
    if (parsed.phone) {
      const { data: guardian } = await admin
        .from('guardians')
        .select('id, full_name')
        .eq('phone', parsed.phone)
        .maybeSingle();
      if (guardian) {
        const { error: linkError } = await admin
          .from('guardians')
          .update({ user_id: authData.user.id })
          .eq('id', guardian.id);
        if (!linkError) linked = true;
      }
    }

    return NextResponse.json({
      success: true,
      message: linked
        ? 'Account created and linked to your child! You can sign in now.'
        : 'Account created. A Barangay Admin will connect you to your child shortly.',
      linked,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
