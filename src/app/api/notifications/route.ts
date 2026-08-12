import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

/** GET — the authenticated user's own notification feed (newest first). */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ notifications: [], warning: error.message });
    }

    const notifications = (data || []).map((n) => ({
      id: n.id,
      recipient_id: n.recipient_user_id,
      pupil_id: n.pupil_id,
      type: n.type,
      title: n.title,
      message: n.message,
      channel: n.channel,
      severity: n.severity,
      read: n.read,
      timestamp: n.created_at,
    }));

    return NextResponse.json({ notifications });
  } catch {
    return NextResponse.json({ notifications: [], warning: 'Notifications unavailable.' });
  }
}
