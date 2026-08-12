import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

/** POST — marks all of the caller's notifications as read. */
export async function POST() {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_user_id', session.userId)
      .eq('read', false)
      .select('id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, marked: data?.length || 0 });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
