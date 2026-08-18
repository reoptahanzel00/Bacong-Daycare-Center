import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';

const PupilSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, 'First name is required').max(100).trim(),
  lastName: z.string().min(1, 'Last name is required').max(100).trim(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be YYYY-MM-DD'),
  sex: z.enum(['Male', 'Female']),
  address: z.string().max(300).trim(),
  enrollmentStatus: z.enum(['enrolled', 'archived']).default('enrolled'),
  guardianName: z.string().min(1, 'Guardian name is required').max(150).trim(),
  relationship: z.enum(['Mother', 'Father', 'Grandmother', 'Grandfather', 'Legal Guardian']),
  guardianPhone: z.string().max(20).trim(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get('status') || 'enrolled';
  const statuses = rawStatus
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is 'pending' | 'enrolled' | 'rejected' | 'archived' =>
      ['pending', 'enrolled', 'rejected', 'archived'].includes(s)
    );

  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    let query = supabase
      .from('pupils')
      .select('*, guardian:guardians(*), sociodemographic:sociodemographic_profiles(*)');
    if (statuses.length > 0) {
      query = query.in('enrollment_status', statuses);
    }
    const { data, error } = await query.order('created_at', { ascending: false }).limit(500);

    if (error) {
      return NextResponse.json({ pupils: [], warning: error.message });
    }

    return NextResponse.json({ pupils: data || [] });
  } catch {
    // Database not configured — callers fall back to localStorage
    return NextResponse.json({ pupils: [], warning: 'Database not connected — using local data.' });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker', 'barangay_admin'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers or Admins can enroll or modify pupil records.' },
        { status: 403 }
      );
    }
    const body = await request.json();
    const parsed = PupilSchema.parse(body);

    // Use secure UUID-based IDs — never Math.random()
    const pupilId = parsed.id || `PUP-${new Date().getFullYear()}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;

    // Attempt to persist to Supabase
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();

      const dbRecord = {
        id: pupilId,
        first_name: parsed.firstName,
        last_name: parsed.lastName,
        birth_date: parsed.birthDate,
        sex: parsed.sex,
        address: parsed.address,
        enrollment_status: parsed.enrollmentStatus,
        enrollment_date: new Date().toISOString().split('T')[0],
        consecutive_absences: 0,
      };

      const { error: pupilError } = await supabase.from('pupils').upsert([dbRecord]);
      if (pupilError) {
        console.warn('[Pupils API] DB write warning:', pupilError.message);
      } else {
        // Update-or-insert the primary guardian so re-saves on an existing pupil
        // do not create duplicate guardian rows every edit.
        const { data: existingGuardian } = await supabase
          .from('guardians')
          .select('id')
          .eq('pupil_id', pupilId)
          .eq('is_primary_contact', true)
          .maybeSingle();

        if (existingGuardian) {
          const { error: gError } = await supabase
            .from('guardians')
            .update({
              full_name: parsed.guardianName,
              relationship: parsed.relationship,
              phone: parsed.guardianPhone,
            })
            .eq('id', existingGuardian.id);
          if (gError) console.warn('[Pupils API] Guardian update warning:', gError.message);
        } else {
          const { error: gError } = await supabase.from('guardians').insert([{
            pupil_id: pupilId,
            full_name: parsed.guardianName,
            relationship: parsed.relationship,
            phone: parsed.guardianPhone,
            is_primary_contact: true,
          }]);
          if (gError) console.warn('[Pupils API] Guardian insert warning:', gError.message);
        }
      }
    } catch {
      // Database not configured — local state only
      console.warn('[Pupils API] Database not available, using local state.');
    }

    return NextResponse.json({
      success: true,
      pupil: {
        id: pupilId,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        birthDate: parsed.birthDate,
        sex: parsed.sex,
        address: parsed.address,
        enrollmentStatus: parsed.enrollmentStatus,
        enrollmentDate: new Date().toISOString().split('T')[0],
        consecutiveAbsences: 0,
        guardian: {
          fullName: parsed.guardianName,
          relationship: parsed.relationship,
          phone: parsed.guardianPhone,
          isPrimary: true,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
