import { redirect } from 'next/navigation';
import AppShell from './AppShell';
import { loadInitialAppData } from '@/lib/initialData';

/**
 * Root page — a server component.
 *
 * Resolves the session and the first screen's data before any HTML is sent, so
 * the browser paints the real roster instead of booting an empty client shell
 * and then issuing a waterfall of requests from an effect. Every query runs
 * through the RLS-bound session client, so each role still receives exactly
 * the rows its policies allow.
 */
export default async function Home() {
  // Offline/demo mode: with no Supabase project configured there is no session
  // to resolve, and the client hydrates a role from local storage instead.
  // Redirecting here would make the app unreachable without a backend, which
  // is the mode the E2E suite and local demos run in.
  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const initial = isConfigured
    ? await loadInitialAppData()
    : { role: null, userName: null, pupils: [], attendance: [], progress: [], announcements: [] };

  // The middleware already redirects unauthenticated visitors; this is the
  // server-side backstop for a session that resolves to no provisioned role.
  if (isConfigured && !initial.role) redirect('/login');

  return <AppShell initial={initial} />;
}
