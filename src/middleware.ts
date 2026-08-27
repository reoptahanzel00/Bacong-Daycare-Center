import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Reachable without a session: sign-in and registration, the auth callback
  // that exchanges a recovery code, the page that then sets the new password,
  // and the privacy notice a prospective parent reads before consenting.
  const { pathname } = request.nextUrl;
  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/privacy');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail loudly if environment is misconfigured — never silently use a placeholder
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      '[Middleware] CRITICAL: Missing Supabase environment variables.\n' +
      'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local\n' +
      'Copy .env.example → .env.local and fill in your project credentials.'
    );
    // Allow pass-through so the app can render a config-error UI instead of a blank crash
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // This call also refreshes the session cookie, which is why it stays on the
  // page path even though the root page verifies the session again server-side:
  // without it a signed-in user is quietly logged out when the token expires.
  const { data: { user } } = await supabase.auth.getUser();

  // Enforce authentication in BOTH development and production — no NODE_ENV bypass
  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  // API routes verify the session inside each handler and never rely on a
  // cookie refreshed here, so they are excluded from the matcher entirely
  // rather than entering the middleware and returning early - that removes a
  // middleware invocation from every API call the app makes.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
