import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * The caller's session, judged by the same rules every API route applies
 * (getServerSession): a disabled or unprovisioned account is reported as not
 * authenticated, rather than as signed in with a null role.
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ authenticated: false, user: null }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', session.userId)
      .maybeSingle();

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: session.userId,
          email: session.email,
          role: session.role,
          name: profile?.full_name || 'System User',
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return NextResponse.json({ authenticated: false, user: null });
  }
}
