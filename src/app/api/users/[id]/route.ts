import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';

const UpdateUserSchema = z.object({
  status: z.enum(['active', 'disabled']),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['barangay_admin'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Barangay Admins can manage system accounts.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateUserSchema.parse(body);

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('users')
      .update({ status: parsed.status })
      .eq('id', id)
      .select('id, email, full_name, role, phone, status, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
