import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase admin client using the SERVICE ROLE KEY.
 * This client bypasses Row Level Security — use ONLY in server-side API routes.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ukzruwisvuemdjjqgoko.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrenJ1d2lzdnVlbWRqanFnb2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjM2NDU3NSwiZXhwIjoyMTAxOTQwNTc1fQ.23pGlV3_3dA5EC3p1PJwYykOkcq_2sG4VYUH-6bPgA4';

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
