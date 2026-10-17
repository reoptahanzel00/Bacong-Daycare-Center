import { redirect } from 'next/navigation';
import AppShell from './AppShell';
import { loadInitialAppData } from '@/lib/initialData';
import { parentNeedsConsent } from '@/lib/auth';

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
    : { role: null, userName: null, pupils: [], attendance: [], progress: [] };

  // The middleware already redirects unauthenticated visitors; this is the
  // server-side backstop for a session that resolves to no provisioned role.
  if (isConfigured && !initial.role) redirect('/login');

  // RA 10173: a parent who agreed to an older privacy notice reads and agrees
  // to the current one before the portal opens.
  if (isConfigured && initial.role === 'parent' && (await parentNeedsConsent())) {
    redirect('/privacy?consent=required');
  }

  return <AppShell initial={initial} />;
}
