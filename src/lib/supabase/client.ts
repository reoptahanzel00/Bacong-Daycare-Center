import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ukzruwisvuemdjjqgoko.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrenJ1d2lzdnVlbWRqanFnb2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjQ1NzUsImV4cCI6MjEwMTk0MDU3NX0.VniHsPm82LUq01gWic0QS29ptKSfef3hr94sVtjUhvs';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
