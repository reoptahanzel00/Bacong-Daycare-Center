import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth';

/**
 * PATCH — marks one of the caller's notifications as read, when it is opened
 * from the bell. Runs as the caller, so RLS and the column grant (only `read`
 * is writable) still decide what changes; the recipient filter makes another
 * user's id a no-op rather than an error that confirms the id exists.
 */
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Unknown notification.' }, { status: 400 });
    }

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('recipient_user_id', session.userId);

    if (error) {
      console.error('[API notifications/:id] write failed:', error.message);
      return NextResponse.json({ error: 'Could not save the change. Please try again.' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
