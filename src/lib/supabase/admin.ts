import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase admin client using the SERVICE ROLE KEY.
 * This client bypasses Row Level Security — use ONLY in server-side API routes.
 *
 * The key MUST come from the environment (SUPABASE_SERVICE_ROLE_KEY).
 * There is intentionally NO fallback value: a missing key fails loudly instead
 * of silently falling back to a committed credential that bypasses RLS.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      '[AdminClient] SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
      'Admin operations (user provisioning, password resets) are disabled until ' +
      'SUPABASE_SERVICE_ROLE_KEY is set in the server environment. ' +
      'This key must never be committed to source control or exposed to the client.'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
