import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');
  const isRegisterPage = request.nextUrl.pathname.startsWith('/register');
  const isStaticAsset =
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/sw.js') ||
    request.nextUrl.pathname.startsWith('/manifest.json');

  // API routes perform their own session verification per handler — resolve
  // them here without an extra Supabase round-trip in the middleware.
  if (isApiRoute) return response;

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

  const { data: { user } } = await supabase.auth.getUser();

  // Enforce authentication in BOTH development and production — no NODE_ENV bypass
  if (!user && !isLoginPage && !isRegisterPage && !isApiRoute && !isStaticAsset) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
