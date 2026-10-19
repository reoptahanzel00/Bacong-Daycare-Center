import { createBrowserClient } from '@supabase/ssr';
import { createClient as createPlainClient } from '@supabase/supabase-js';

// The Supabase URL and anon key MUST come from the environment.
// There is no committed fallback: if they are missing we emit an inert
// placeholder so the app degrades to local/demo mode instead of touching a
// real backend with hard-coded credentials.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key-not-configured';

/**
 * Only for asking Supabase to email a password-reset link.
 *
 * The app's normal client uses PKCE, which ties an emailed link to a verifier
 * cookie in the browser that asked for it. A parent who asks on the laptop and
 * taps the link in the Gmail app or on their phone has no such cookie, and the
 * reset fails as "expired or already used". This client uses the implicit
 * flow, so the link carries the recovery session in its URL fragment and works
 * on any device; /reset-password picks it up. It keeps no session of its own.
 */
export function createRecoveryRequestClient() {
  return createPlainClient(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createClient() {

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn(
      '[Supabase Client] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
      'Database calls will fail and the app will use local demo data.'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
