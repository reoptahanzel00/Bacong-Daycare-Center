import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';
import { passwordSchema } from '@/lib/password';
import { rateLimited, clientIp } from '@/lib/rateLimit';
import { recordAudit } from '@/lib/audit';

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordSchema,
  })
  .refine((b) => b.newPassword !== b.currentPassword, {
    message: 'The new password must be different from the current one.',
    path: ['newPassword'],
  });

// Each attempt checks the current password, so this is a password-guessing
// surface for anyone holding an unlocked, signed-in device.
const RATE_LIMIT = 5; // per window
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * POST — a signed-in user changes their own password.
 *
 * The current password is required: a phone left signed in at the centre must
 * not let whoever picks it up lock the owner out. It is checked with a
 * throwaway client that keeps no session and sets no cookies, so the check
 * neither signs the caller in again nor touches the session they are using.
 * The forgotten-password path (no current password) stays the emailed or
 * worker-issued recovery link.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId || !session.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (await rateLimited(clientIp(request), 'change-password', RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait 15 minutes and try again.' },
        { status: 429 }
      );
    }

    const parsed = ChangePasswordSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Check the passwords and try again.' },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
    }
    const verifier = createSupabaseClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: verifyError } = await verifier.auth.signInWithPassword({
      email: session.email,
      password: parsed.data.currentPassword,
    });
    if (verifyError) {
      return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 400 });
    }
    // 'local' ends only the throwaway session; the default would end them all.
    await verifier.auth.signOut({ scope: 'local' }).catch(() => {});

    // Through the caller's own session, not the admin API: Supabase then keeps
    // this session and signs the account out everywhere else, whereas an admin
    // password update ends every session, including the one making the change.
    const { createClient: createSessionClient } = await import('@/lib/supabase/server');
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
    if (error) {
      console.warn('[Change Password API] update failed:', error.message);
      return NextResponse.json(
        { error: 'Could not change the password. Please try again.' },
        { status: 400 }
      );
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    await recordAudit(createAdminClient(), session, 'Changed own password', `User ${session.userId}`);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
