import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimited, clientIp } from '@/lib/rateLimit';
import { createClient } from '@/lib/supabase/server';
import { recordAudit } from '@/lib/audit';

const LoginSchema = z
  .object({
    // Email, or a pupil's Student ID (the paper: "Student ID/User ID and password").
    identifier: z.string().trim().min(1, 'Email or Student ID is required').max(254).optional(),
    // Older clients still send `email`.
    email: z.string().trim().max(254).optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .refine((b) => Boolean(b.identifier || b.email), { message: 'Email or Student ID is required' });

const STUDENT_ID = /^PUP-\d{4}-[A-Z0-9]+$/i;
const EMAIL = z.string().email();

const RATE_LIMIT = 10; // per window
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const INVALID = 'Invalid email, Student ID or password. Please check your credentials.';

/**
 * The emails a sign-in identifier can stand for: itself if it is an email, or
 * the accounts linked as guardians of the pupil it names if it is a Student ID.
 * Read with the service role because the visitor has no session yet; nothing
 * about the lookup is returned to them.
 */
async function candidateEmails(identifier: string): Promise<string[]> {
  if (STUDENT_ID.test(identifier)) {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { data: guardians } = await admin
      .from('guardians')
      .select('user_id')
      .eq('pupil_id', identifier.toUpperCase())
      .not('user_id', 'is', null);
    const userIds = [...new Set((guardians || []).map((g) => g.user_id as string))];
    if (userIds.length === 0) return [];
    const { data: users } = await admin
      .from('users')
      .select('email')
      .in('id', userIds)
      .eq('role', 'parent');
    return (users || []).map((u) => u.email.toLowerCase());
  }
  return EMAIL.safeParse(identifier).success ? [identifier.toLowerCase()] : [];
}

/**
 * POST — server-side sign-in with rate limiting.
 * Accepts an email, or a pupil's Student ID for the parents linked to that
 * pupil. Authenticates through the SSR client (which sets the session cookies
 * on the response) and returns the verified profile so the UI can route by
 * role. Every failure returns the same message, so the response never reveals
 * whether an email or Student ID exists.
 */
export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (await rateLimited(ip, 'login', RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = LoginSchema.parse(body);
    const identifier = (parsed.identifier || parsed.email || '').trim();

    const supabase = await createClient();
    let signedInUser: { id: string; email?: string } | null = null;

    // A pupil can have more than one linked parent account (mother and father);
    // the password decides which one is signing in.
    for (const email of await candidateEmails(identifier)) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.password });
      if (!error && data.user) {
        signedInUser = data.user;
        break;
      }
      // The client is told the same thing for every failure, on purpose, so the
      // response cannot be used to discover which addresses exist. That also
      // meant a whole class of accounts could be unable to sign in for a reason
      // nobody could see: "Email not confirmed" looked exactly like a wrong
      // password. Log the reason — never the address — so the runtime log can
      // tell a bad password from a broken account.
      if (error) console.warn('[Login API] Sign-in rejected:', error.message);
    }

    if (!signedInUser) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role, status')
      .eq('id', signedInUser.id)
      .single();

    if (!profile?.role) {
      // Authenticated in Supabase but not provisioned — fail closed; sign out.
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: 'This account is not provisioned for the daycare system. Please contact the Daycare Worker.' },
        { status: 403 }
      );
    }

    if (profile.status === 'disabled') {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: 'This account has been disabled. Please contact the Daycare Worker.' },
        { status: 403 }
      );
    }

    {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      await recordAudit(createAdminClient(), { userId: signedInUser.id, email: signedInUser.email ?? null, role: profile.role }, 'Signed in', 'Session');
    }

    return NextResponse.json({
      success: true,
      user: {
        id: signedInUser.id,
        email: signedInUser.email || null,
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
