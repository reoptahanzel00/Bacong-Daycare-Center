import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimited, clientIp } from '@/lib/rateLimit';
import { createClient } from '@/lib/supabase/server';

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const RATE_LIMIT = 10; // per window
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * POST â€” server-side sign-in with rate limiting.
 * Authenticates through the SSR client (which sets the session cookies on the
 * response) and returns the verified profile so the UI can route by role.
 * Failures return a generic message to avoid leaking account existence.
 */
export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (rateLimited(ip, 'login', RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = LoginSchema.parse(body);
    const email = parsed.email.trim().toLowerCase();

    const supabase = await createClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.password,
    });

    if (signInError || !signInData.user) {
      // Generic message â€” never reveal whether the email exists or the password
      // shape. The disabled-account case is handled below once a user resolves.
      return NextResponse.json(
        { error: 'Invalid email or password. Please check your credentials.' },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role, status')
      .eq('id', signInData.user.id)
      .single();

    if (!profile?.role) {
      // Authenticated in Supabase but not provisioned â€” fail closed; sign out.
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: 'This account is not provisioned for the daycare system. Please contact the Barangay Admin.' },
        { status: 403 }
      );
    }

    if (profile.status === 'disabled') {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: 'This account has been disabled. Please contact the Barangay Admin.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: signInData.user.id,
        email: signInData.user.email || email,
        role: profile.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Unable to connect to authentication server.' }, { status: 500 });
  }
}
