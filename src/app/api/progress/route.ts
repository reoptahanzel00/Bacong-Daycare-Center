import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const ProgressSchema = z.object({
  pupil_id: z.string().min(1, 'Pupil ID is required'),
  domain: z.enum([
    'Motor Skills',
    'Language & Communication',
    'Socio-Emotional',
    'Self-Help & Cognitive',
  ]),
  title: z.string().min(1, 'Title is required').max(200),
  note: z.string().min(1, 'Observation note is required').max(1000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  recordedBy: z.string().max(100).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pupilId = searchParams.get('pupil_id');

  try {
    const supabase = await createClient();
    let query = supabase.from('progress_observations').select('*').order('date', { ascending: false });

    if (pupilId) {
      query = query.eq('pupil_id', pupilId);
    }

    const { data, error } = await query.limit(200);

    if (error) {
      return NextResponse.json({ observations: [], warning: error.message });
    }

    return NextResponse.json({ observations: data || [] });
  } catch (err) {
    return NextResponse.json({ observations: [], warning: 'Database not connected — using local data.' });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ProgressSchema.parse(body);

    const record = {
      id: `PROG-${crypto.randomUUID().split('-')[0].toUpperCase()}`,
      pupil_id: parsed.pupil_id,
      domain: parsed.domain,
      title: parsed.title,
      note: parsed.note,
      date: parsed.date,
      recorded_by: parsed.recordedBy || 'Daycare Worker',
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

      return NextResponse.json({ success: true, observation: data });
    } catch (dbConnectionErr) {
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
