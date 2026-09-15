import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { loadEccdRecord } from '@/lib/eccdRecordLoader';
import { fillEccdDocx } from '@/lib/eccdDocx';
import { recordFileName } from '@/lib/eccdRecord';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Bundled with this route by outputFileTracingIncludes in next.config.mjs; kept
// out of public/ so the form is only ever served filled, behind a session.
const TEMPLATE_PATH = path.join(process.cwd(), 'src', 'templates', 'eccd-child-record-2.docx');

/**
 * GET ?pupil_id=[&format=json] — the pupil's ECCD Checklist, Child's Record 2.
 *
 * By default, the centre's official Word form filled with all three rounds.
 * With format=json, the same record as data, which the report modal previews.
 * Staff may open any pupil; parents only children linked to their account.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pupilId = searchParams.get('pupil_id');
    if (!pupilId) {
      return NextResponse.json({ error: 'pupil_id query parameter is required.' }, { status: 400 });
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    if (session.role === 'parent') {
      const { data: link } = await admin
        .from('guardians')
        .select('pupil_id')
        .eq('user_id', session.userId)
        .eq('pupil_id', pupilId)
        .maybeSingle();
      if (!link) {
        return NextResponse.json({ error: 'You can only view records of your own children.' }, { status: 403 });
      }
    }

    const record = await loadEccdRecord(admin, pupilId);
    if (!record) {
      return NextResponse.json({ error: 'Pupil not found.' }, { status: 404 });
    }

    const noStore = { 'Cache-Control': 'private, no-store' };
    if (searchParams.get('format') === 'json') {
      return NextResponse.json({ record }, { headers: noStore });
    }

    const docx = await fillEccdDocx(await readFile(TEMPLATE_PATH), record);
    const fileName = recordFileName(record);
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, '_');
    return new NextResponse(new Uint8Array(docx), {
      headers: {
        ...noStore,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    console.error('ECCD record generation failed:', error);
    return NextResponse.json({ error: 'Could not generate the ECCD record.' }, { status: 500 });
  }
}
