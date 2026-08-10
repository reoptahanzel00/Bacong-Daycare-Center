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

    let role = profile?.role || user.user_metadata?.role;
    if (!role) {
      const email = (user.email || '').toLowerCase();
      if (email.includes('official')) role = 'official';
      else if (email.includes('admin')) role = 'barangay_admin';
      else if (email.includes('parent')) role = 'parent';
      else role = 'worker';
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role,
        name: profile?.full_name || user.user_metadata?.full_name || 'System User',
      },
    });
  } catch (err) {
    return NextResponse.json({ authenticated: false, user: null });
  }
}
