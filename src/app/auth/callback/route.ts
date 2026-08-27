import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Exchanges a Supabase auth code for a session.
 *
 * The browser client uses the PKCE flow, so a password-recovery email arrives as
 * a link carrying a `code` that has to be exchanged server-side before the user
 * has a session. Nothing consumed that code before this route existed: the link
 * landed on a page that ignored it, so "reset your password" quietly did nothing
 * and a locked-out parent had no way back in.
 */

/**
 * Only internal paths are accepted as a destination. An open redirect here would
 * turn a link we send by email into one that forwards to somebody else's site
 * with the user's trust already attached.
 */
function safeNext(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('That link is missing its security code. Please request a new one.')}`
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // Recovery links are single-use and time-limited, so an expired or
      // already-used link is the common case rather than an exceptional one.
      // Say so plainly instead of surfacing the raw Supabase message.
      console.warn('[Auth callback] Code exchange failed:', error.message);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('That link has expired or was already used. Please request a new one.')}`
      );
    }

    return NextResponse.redirect(`${origin}${next}`);
  } catch (e) {
    console.error('[Auth callback] Unexpected failure:', e);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Could not complete sign-in. Please try again.')}`
    );
  }
}
