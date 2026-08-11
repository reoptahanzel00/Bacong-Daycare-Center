import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // The Supabase URL and anon key MUST come from the environment.
  // There is no committed fallback: if they are missing we emit an inert
  // placeholder so the app degrades to local/demo mode instead of touching a
  // real backend with hard-coded credentials.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key-not-configured';

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn(
      '[Supabase Client] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
      'Database calls will fail and the app will use local demo data.'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
