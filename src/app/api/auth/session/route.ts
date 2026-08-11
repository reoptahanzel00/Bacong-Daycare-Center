import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // The users table is the single source of truth. user_metadata is
    // user-editable and must never be trusted for authorization.
    const role = profile?.role ?? null;

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role,
        name: profile?.full_name || 'System User',
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false, user: null });
  }
}
