/**
 * Seeds one account per role into a STAGING Supabase project, so the E2E suite
 * can exercise authenticated paths.
 *
 * Everything the current suite proves is that signed-out users are locked out.
 * It cannot prove that a signed-in parent sees only their own child, because in
 * offline demo mode every route answers 401 before an RLS policy is consulted.
 * These accounts close that gap.
 *
 * Usage (staging credentials only — it refuses to touch a project that looks
 * like production):
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   E2E_PASSWORD=... node scripts/seed-test-users.mjs
 *
 * Idempotent: re-running updates the existing accounts rather than failing.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

/**
 * Loads .env.staging.local if present, so the staging service-role key lives in
 * a gitignored file rather than in a shell command that lands in history.
 * Values already in the environment win, so CI can override.
 */
function loadStagingEnv(file = '.env.staging.local') {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    // An explicit environment variable wins, so CI can override the file.
    if (process.env[key]) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
  console.log(`Loaded ${file}`);
}

loadStagingEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.E2E_PASSWORD;

if (!url || !serviceKey || !password) {
  console.error(
    'Missing environment. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_PASSWORD.'
  );
  process.exit(1);
}

// A guard, not a formality. These accounts have known passwords; creating them
// in the project that holds real children's records would be the worst possible
// outcome of a convenience script.
if (!process.env.E2E_ALLOW_NON_STAGING && !/staging|test|dev/i.test(url)) {
  console.error(
    `Refusing to seed test accounts into ${url}\n` +
    'The project URL does not look like staging. If this really is a staging\n' +
    'project, re-run with E2E_ALLOW_NON_STAGING=1.'
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Test accounts, one per role. Emails are stable so runs are repeatable. */
const ACCOUNTS = [
  { email: 'e2e-worker@example.test',   role: 'worker',         fullName: 'E2E Daycare Worker' },
  { email: 'e2e-official@example.test', role: 'official',       fullName: 'E2E Barangay Official' },
  { email: 'e2e-admin@example.test',    role: 'barangay_admin', fullName: 'E2E Barangay Admin' },
  { email: 'e2e-parent@example.test',   role: 'parent',         fullName: 'E2E Parent' },
  // Used to prove a disabled account is refused even with valid credentials.
  { email: 'e2e-disabled@example.test', role: 'worker',         fullName: 'E2E Disabled Worker', status: 'disabled' },
];

async function findUserByEmail(email) {
  // listUsers is paginated; the staging project is small enough for one page.
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

async function upsertAccount({ email, role, fullName, status = 'active' }) {
  let user = await findUserByEmail(email);

  if (user) {
    await admin.auth.admin.updateUserById(user.id, {
      password,
      ban_duration: status === 'disabled' ? '876000h' : 'none',
    });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    user = data.user;
    if (status === 'disabled') {
      await admin.auth.admin.updateUserById(user.id, { ban_duration: '876000h' });
    }
  }

  const { error: profileError } = await admin.from('users').upsert({
    id: user.id,
    email,
    full_name: fullName,
    role,
    status,
    privacy_consent_at: new Date().toISOString(),
    privacy_consent_version: 'e2e-seed',
  });
  if (profileError) throw new Error(`profile ${email}: ${profileError.message}`);

  return user;
}

async function main() {
  const created = {};
  for (const account of ACCOUNTS) {
    const user = await upsertAccount(account);
    created[account.role === 'worker' && account.status === 'disabled' ? 'disabled' : account.role] = user.id;
    console.log(`  ${account.status === 'disabled' ? 'disabled' : account.role.padEnd(14)}  ${account.email}`);
  }

  // Link the parent to exactly one pupil. The point of the RLS tests is that
  // this parent sees this child and no other, so there must be others.
  const { data: pupils, error: pupilError } = await admin
    .from('pupils')
    .select('id')
    .eq('enrollment_status', 'enrolled')
    .order('id')
    .limit(2);
  if (pupilError) throw new Error(`pupils: ${pupilError.message}`);

  if (!pupils?.length) {
    console.warn('\n  No enrolled pupils found — run supabase/seed.sql first.');
    return;
  }
  if (pupils.length < 2) {
    console.warn('\n  Only one enrolled pupil: the "sees only their own child" test cannot fail meaningfully.');
  }

  const linkedPupilId = pupils[0].id;
  const { error: guardianError } = await admin
    .from('guardians')
    .upsert(
      {
        pupil_id: linkedPupilId,
        user_id: created.parent,
        full_name: 'E2E Parent',
        relationship: 'Mother',
        phone: '0900-000-0000',
        is_primary_contact: true,
      },
      { onConflict: 'pupil_id,phone' }
    );
  if (guardianError) throw new Error(`guardian: ${guardianError.message}`);

  console.log(`\n  parent linked to pupil ${linkedPupilId}`);
  console.log(`  ${pupils.length - 1} other enrolled pupil(s) they must NOT see\n`);
}

main().catch((e) => {
  console.error('\nSeeding failed:', e.message);
  process.exit(1);
});
