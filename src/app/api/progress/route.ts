import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getServerSession, authorizeRole } from '@/lib/auth';

import {
  DOMAIN_LABEL_TO_ID,
  RATING_TO_STATUS,
  toClientObservation,
} from '@/lib/progressMapping';

const ProgressSchema = z.object({
  pupil_id: z.string().min(1, 'Pupil ID is required'),
  domain: z.enum([
    'Motor Skills',
    'Language & Communication',
    'Socio-Emotional',
    'Self-Help & Cognitive',
  ]),
  title: z.string().min(1, 'Title is required').max(200).optional(),
  note: z.string().min(1, 'Observation note is required').max(1000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  rating: z.string().max(100).optional(),
  recordedBy: z.string().max(100).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pupilId = searchParams.get('pupil_id');

  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const supabase = await createClient();
    let query = supabase.from('progress_observations').select('*').order('observation_date', { ascending: false });

    if (pupilId) {
      query = query.eq('pupil_id', pupilId);
    }

    const { data, error } = await query.limit(200);

    if (error) {
      return NextResponse.json({ observations: [], warning: error.message });
    }

    // Map DB columns back to the client contract (domain/date/rating) so the
    // UI shape stays stable regardless of storage layout.
    const observations = (data || []).map(toClientObservation);

    return NextResponse.json({ observations });
  } catch {
    return NextResponse.json({ observations: [], warning: 'Database not connected — using local data.' });
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
        { error: 'Unauthorized: Only Daycare Workers or Admins can record ECCD observations.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = ProgressSchema.parse(body);

    const record = {
      pupil_id: parsed.pupil_id,
      domain_id: DOMAIN_LABEL_TO_ID[parsed.domain] || parsed.domain,
      title: parsed.title || `${parsed.rating || 'Milestone'} observation`,
      note: parsed.note,
      observation_date: parsed.date,
      status_rating: parsed.rating ? RATING_TO_STATUS[parsed.rating] || null : null,
      // recorded_by is the verified user UUID from the session, never client input.
      recorded_by: session.userId,
    };

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('progress_observations')
        .insert([record])
        .select()
        .single();

      if (error) {
        // 🔴 DO NOT silently return success=true on DB error — caller must know
        console.error('[Progress API] Supabase insert error:', error);
        return NextResponse.json(
          { error: 'Database write failed. The observation was not saved permanently. Please try again.' },
          { status: 503 }
        );
      }

      // Notify the pupil's linked guardians about the new milestone (best-effort).
      try {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const { notifyUsers, guardianUserIdsForPupils } = await import('@/lib/notify');
        const admin = createAdminClient();
        const targets = await guardianUserIdsForPupils(admin, [parsed.pupil_id]);
        await notifyUsers(targets, {
          type: 'milestone',
          title: 'Milestone Update',
          message: `A new ECCD milestone observation (${parsed.domain}) was recorded for your child.`,
          severity: 'info',
        });
      } catch (notifyError) {
        console.warn('[Progress API] Milestone notification skipped:', notifyError);
      }

      return NextResponse.json({ success: true, observation: data });
    } catch {
      // Database not configured — return optimistic local record with warning
      console.warn('[Progress API] Database not available. Returning local record.');
      return NextResponse.json({
        success: true,
        observation: record,
        warning: 'Saved locally only. Database not connected.',
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
