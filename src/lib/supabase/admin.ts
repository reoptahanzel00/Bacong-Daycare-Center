import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase admin client using the SERVICE ROLE KEY.
 * This client bypasses Row Level Security — use ONLY in server-side API routes.
 *
 * ⚠️ NEVER import or expose this in browser/client components.
 * ⚠️ NEVER send the service role key to the client.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY.\n' +
      'This key is required for admin operations (user provisioning, audit writes).\n' +
      'Set it in .env.local — NEVER commit this key to source control.'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
