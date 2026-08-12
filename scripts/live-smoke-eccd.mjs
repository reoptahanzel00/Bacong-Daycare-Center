// One-off live smoke test for the ECCD rounds + scores feature.
// Reads .env.local for Supabase credentials; logs in as worker and parent,
// exercises /api/eccd and /api/eccd/scores on the deployed app, and verifies
// the DB migration via PostgREST. Run: node scripts/live-smoke-eccd.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnv(file) {
  const out = {};
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = loadEnv(path.join(root, '.env.local'));
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
// .env.local's NEXT_PUBLIC_APP_URL points at localhost for local dev; the
// smoke test must target the deployed app. Override with APP_URL if needed.
const appUrl = (process.env.APP_URL || 'https://bacong-daycare-center.vercel.app').replace(/\/$/, '');
const ref = new URL(supabaseUrl).hostname.split('.')[0];

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error('Missing Supabase env config in .env.local');
  process.exit(1);
}

let failures = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
  if (!ok) failures += 1;
};

async function supabaseAuth(email, password) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${email} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function cookieFor(session) {
  const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');
  return { name: `sb-${ref}-auth-token`, value };
}

async function api(ck, pathname, method = 'GET', body) {
  const res = await fetch(`${appUrl}${pathname}`, {
    method,
    headers: {
      Cookie: `${ck.name}=${ck.value}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

// ---- Phase 0: migration check via PostgREST (service role) ----
console.log('--- Phase 0: DB migration ---');
{
  const hdrs = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const scores = await fetch(`${supabaseUrl}/rest/v1/eccd_scores?select=*&limit=1`, { headers: hdrs });
  check('eccd_scores table exists', scores.status === 200, `HTTP ${scores.status}`);
  const obs = await fetch(
    `${supabaseUrl}/rest/v1/progress_observations?select=pupil_id,evaluation_round&limit=1`,
    { headers: hdrs }
  );
  check('progress_observations has evaluation_round column', obs.status === 200, `HTTP ${obs.status}`);
  const socio = await fetch(`${supabaseUrl}/rest/v1/sociodemographic_profiles?select=pupil_id&limit=1`, { headers: hdrs });
  check('sociodemographic_profiles table exists', socio.status === 200, `HTTP ${socio.status}`);
}

// ---- Phase 1: unauthenticated + worker flow ----
console.log('--- Phase 1: worker flow on deployed app ---');
{
  const unauth = await fetch(`${appUrl}/api/eccd/scores`);
  check('unauthenticated GET /api/eccd/scores -> 401', unauth.status === 401, `HTTP ${unauth.status}`);

  const session = await supabaseAuth('worker@bacong.gov.ph', 'Password123!');
  const ck = cookieFor(session);
  check('worker login', !!session.access_token);

  const before = await api(ck, '/api/eccd?round=2');
  check('GET /api/eccd?round=2 as worker -> 200', before.status === 200, `HTTP ${before.status}`);

  const ratings = [
    { milestone_code: 'GM-01', domain_id: 'gross_motor', present: true },
    { milestone_code: 'GM-02', domain_id: 'gross_motor', present: true },
    { milestone_code: 'GM-03', domain_id: 'gross_motor', present: true },
    { milestone_code: 'GM-04', domain_id: 'gross_motor', present: true },
    { milestone_code: 'GM-05', domain_id: 'gross_motor', present: false },
    { milestone_code: 'FM-01', domain_id: 'fine_motor', present: true },
  ];
  const saved = await api(ck, '/api/eccd', 'POST', {
    pupil_id: 'PUP-2026-001', round: 2, ratings,
  });
  check('POST /api/eccd (round 2, 6 ratings) -> success', saved.status === 200 && saved.json?.saved === 5, `HTTP ${saved.status} saved=${saved.json?.saved}`);

  const after = await api(ck, '/api/eccd?round=2');
  const mine = (after.json?.ratings || []).filter((r) => r.pupil_id === 'PUP-2026-001');
  check('GET round 2 shows 5 present rows for PUP-2026-001', mine.length === 5, `rows=${mine.length}`);

  const scoresSaved = await api(ck, '/api/eccd/scores', 'POST', {
    pupil_id: 'PUP-2026-001', round: 2,
    scores: [
      { domain_id: 'gross_motor', raw_score: 4, scaled_score: 4 },
      { domain_id: 'fine_motor', raw_score: 1, scaled_score: null },
    ],
  });
  check('POST /api/eccd/scores -> success', scoresSaved.status === 200 && scoresSaved.json?.saved === 2, `HTTP ${scoresSaved.status}`);

  const scoresGet = await api(ck, '/api/eccd/scores?round=2');
  const myScores = (scoresGet.json?.scores || []).filter((s) => s.pupil_id === 'PUP-2026-001');
  const gm = myScores.find((s) => s.domain_id === 'gross_motor');
  check('GET /api/eccd/scores round 2 -> 2 rows, raw=4 scaled=4', myScores.length === 2 && gm?.raw_score === 4 && gm?.scaled_score === 4, JSON.stringify(myScores));

  // Re-save with fewer items to verify delete+insert replacement semantics.
  const resaved = await api(ck, '/api/eccd', 'POST', {
    pupil_id: 'PUP-2026-001', round: 2,
    ratings: ratings.map((r) => ({ ...r, present: r.milestone_code === 'FM-01' ? false : r.present })),
  });
  const afterResave = await api(ck, '/api/eccd?round=2');
  const mine2 = (afterResave.json?.ratings || []).filter((r) => r.pupil_id === 'PUP-2026-001');
  check('re-save replaces rows (FM-01 removed)', resaved.status === 200 && mine2.length === 4, `rows=${mine2.length}`);

  // Child & Family Background (ECCD Form Section 2)
  const bgSaved = await api(ck, '/api/eccd/background', 'POST', {
    pupil_id: 'PUP-2026-001',
    child_background: 'Cheerful and active during play.',
    family_environment: 'Lives with both parents.',
    stimulating_activities: 'Parent reads Tagalog storybooks nightly.',
  });
  check('POST /api/eccd/background -> success', bgSaved.status === 200 && bgSaved.json?.success === true, `HTTP ${bgSaved.status}`);

  const bgGet = await api(ck, '/api/eccd/background?pupil_id=PUP-2026-001');
  const bg = bgGet.json?.background;
  check(
    'GET /api/eccd/background -> saved fields',
    bgGet.status === 200 && bg?.child_background?.includes('Cheerful') && bg?.family_environment?.includes('both parents'),
    `HTTP ${bgGet.status}`
  );
}

// ---- Phase 2: parent scoping ----
console.log('--- Phase 2: parent scoping ---');
{
  const session = await supabaseAuth('parent@bacong.gov.ph', 'Password123!');
  const ck = cookieFor(session);
  check('parent login', !!session.access_token);

  const gres = await fetch(
    `${supabaseUrl}/rest/v1/guardians?select=pupil_id&user_id=eq.${session.user.id}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  const guardians = await gres.json();
  const allowed = new Set((guardians || []).map((g) => g.pupil_id));
  check('parent has linked pupil(s)', allowed.size > 0, [...allowed].join(', '));

  const got = await api(ck, '/api/eccd?round=2');
  const pupilsSeen = new Set((got.json?.ratings || []).map((r) => r.pupil_id));
  const leak = [...pupilsSeen].filter((p) => !allowed.has(p));
  check('parent sees ONLY linked pupils (no IDOR leak)', got.status === 200 && leak.length === 0, `seen=${[...pupilsSeen].join(',') || 'none'}`);

  const denied = await api(ck, '/api/eccd', 'POST', {
    pupil_id: 'PUP-2026-001', round: 2, ratings: [],
  });
  check('parent POST /api/eccd -> 403', denied.status === 403, `HTTP ${denied.status}`);

  const deniedScores = await api(ck, '/api/eccd/scores', 'POST', {
    pupil_id: 'PUP-2026-001', round: 2, scores: [],
  });
  check('parent POST /api/eccd/scores -> 403', deniedScores.status === 403, `HTTP ${deniedScores.status}`);

  const bgParent = await api(ck, '/api/eccd/background?pupil_id=PUP-2026-001');
  check('parent reads own child background', bgParent.status === 200 && !!bgParent.json?.background, `HTTP ${bgParent.status}`);

  const bgDenied = await api(ck, '/api/eccd/background', 'POST', {
    pupil_id: 'PUP-2026-002',
    child_background: 'sneaky edit',
  });
  check('parent POST background for non-linked pupil -> 403', bgDenied.status === 403, `HTTP ${bgDenied.status}`);
}

// ---- Phase 4: parent-initiated enrollment with sociodemographic profile ----
console.log('--- Phase 4: parent signup -> worker verify ---');
{
  const runId = `${Date.now()}`;
  const parentEmail = `smoke-parent-${runId}@bacong.gov.ph`;
  const workerSession = await supabaseAuth('worker@bacong.gov.ph', 'Password123!');
  const workerCk = cookieFor(workerSession);
  check('worker login (verify phase)', !!workerSession.access_token);

  // Parent creates an account with two child profiles (one to approve, one to reject).
  const signupRes = await fetch(`${appUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'parent',
      fullName: `Smoke Parent ${runId}`,
      email: parentEmail,
      password: 'Str0ng!Pass123',
      phone: `0917-${runId.slice(-8)}`,
      children: [
        {
          firstName: 'Smoke',
          lastName: `ChildA${runId.slice(-4)}`,
          birthDate: '2021-06-15',
          sex: 'Male',
          barangay: 'Bacong',
          municipality: 'Bongabong',
          province: 'Oriental Mindoro',
          region: 'IV-B',
          handedness: 'right',
          currentlyStudying: true,
          schoolName: 'Bacong Daycare Center',
          relationship: 'Mother',
          fatherName: 'Juan Smoke',
          fatherAge: 34,
          fatherOccupation: 'Farmer',
          fatherEducation: 'High School Graduate',
          motherName: `Smoke Parent ${runId}`,
          motherAge: 32,
          motherOccupation: 'Housewife',
          motherEducation: 'College Graduate',
          siblingsCount: 2,
          birthOrder: '2nd',
        },
        {
          firstName: 'Smoke',
          lastName: `ChildB${runId.slice(-4)}`,
          birthDate: '2023-01-20',
          sex: 'Female',
          barangay: 'Bacong',
          municipality: 'Bongabong',
          province: 'Oriental Mindoro',
          region: 'IV-B',
          handedness: 'left',
          currentlyStudying: false,
          relationship: 'Mother',
        },
      ],
    }),
  });
  const signupJson = await signupRes.json().catch(() => ({}));
  check('parent signup with 2 child profiles -> success', signupRes.status === 200 && signupJson.success === true, `HTTP ${signupRes.status} ${JSON.stringify(signupJson).slice(0, 200)}`);

  const parentSession = await supabaseAuth(parentEmail, 'Str0ng!Pass123');
  const parentCk = cookieFor(parentSession);
  check('new parent can sign in', !!parentSession.access_token);

  // Parent sees BOTH children as pending (linked via guardians).
  const parentPupils = await api(parentCk, '/api/pupils?status=pending,rejected');
  const parentSeen = (parentPupils.json?.pupils || []).filter((p) =>
    p.first_name === 'Smoke' && String(p.last_name).includes(runId.slice(-4))
  );
  check('parent sees own pending children', parentPupils.status === 200 && parentSeen.length === 2, `seen=${parentSeen.length}`);

  // Worker sees the pending queue.
  const workerQueue = await api(workerCk, '/api/pupils?status=pending');
  const workerPending = (workerQueue.json?.pupils || []).filter((p) =>
    p.first_name === 'Smoke' && String(p.last_name).includes(runId.slice(-4))
  );
  check('worker sees pending queue with profile', workerQueue.status === 200 && workerPending.length === 2 && !!workerPending[0]?.sociodemographic, `pending=${workerPending.length}`);

  // Worker approves ChildA.
  const childA = parentSeen.find((p) => p.last_name.startsWith('ChildA'));
  const approved = await api(workerCk, '/api/pupils/verify', 'POST', {
    pupil_id: childA.id,
    action: 'approve',
  });
  check('worker approves ChildA -> enrolled', approved.status === 200 && approved.json?.pupil?.enrollmentStatus === 'enrolled', `HTTP ${approved.status}`);

  // Worker rejects ChildB with a reason.
  const childB = parentSeen.find((p) => p.last_name.startsWith('ChildB'));
  // Reject without a reason must fail (ChildB still pending).
  const noReason = await api(workerCk, '/api/pupils/verify', 'POST', {
    pupil_id: childB.id,
    action: 'reject',
  });
  check('reject without reason -> 400', noReason.status === 400, `HTTP ${noReason.status}`);

  const rejected = await api(workerCk, '/api/pupils/verify', 'POST', {
    pupil_id: childB.id,
    action: 'reject',
    reason: 'Missing birth certificate; please submit it to the daycare.',
  });
  check('worker rejects ChildB with reason -> rejected', rejected.status === 200 && rejected.json?.pupil?.enrollmentStatus === 'rejected', `HTTP ${rejected.status}`);

  // Parent sees the updated statuses: ChildA enrolled, ChildB rejected with reason.
  const after = await api(parentCk, '/api/pupils?status=pending,enrolled,rejected');
  const smokeAfter = (after.json?.pupils || []).filter((p) =>
    p.first_name === 'Smoke' && String(p.last_name).includes(runId.slice(-4))
  );
  const childAAfter = smokeAfter.find((p) => p.last_name.startsWith('ChildA'));
  const childBAfter = smokeAfter.find((p) => p.last_name.startsWith('ChildB'));
  check(
    'parent sees ChildA enrolled + ChildB rejected with reason',
    after.status === 200 &&
      childAAfter?.enrollment_status === 'enrolled' &&
      childBAfter?.enrollment_status === 'rejected' &&
      String(childBAfter?.rejection_reason || '').includes('birth certificate'),
    JSON.stringify(smokeAfter.map((p) => ({ id: p.id, status: p.enrollment_status, reason: p.rejection_reason })))
  );
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
