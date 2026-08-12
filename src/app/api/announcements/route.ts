import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';

const AnnouncementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().min(1, 'Content is required').max(2000),
});

/** GET — the public-to-authenticated announcements feed. */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('announcements')
      .select('id, title, body, posted_by, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ announcements: [], warning: error.message });
    }
    return NextResponse.json({ announcements: data || [] });
  } catch {
    return NextResponse.json({ announcements: [], warning: 'Announcements unavailable.' });
  }
}

/** POST — workers/admins publish a notice. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker', 'barangay_admin'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers or Admins can publish notices.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = AnnouncementSchema.parse(body);

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('announcements')
      .insert({
        title: parsed.title,
        body: parsed.body,
        posted_by: session.userId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, announcement: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
