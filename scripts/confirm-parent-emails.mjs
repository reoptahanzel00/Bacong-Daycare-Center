/**
 * Confirms the email address of parent accounts that were created unconfirmed,
 * so they can sign in again.
 *
 * Why this exists
 * ---------------
 * /api/auth/signup created every self-registered parent with
 * `email_confirm: false`, in the belief that Supabase would send a verification
 * link. It does not: `auth.admin.createUser()` creates the account directly and
 * sends nothing — a confirmation mail only goes out through the public
 * `signUp()` flow, `inviteUserByEmail()` or `generateLink()`, none of which this
 * app calls.
 *
 * So on a project with email confirmation enabled, every parent who registered
 * themselves ended up with an account that could never sign in and no link to
 * fix it. Sign-in answers every failure with the same message, by design, so
 * they were simply told their password was wrong.
 *
 * The signup route now confirms on creation, which matches the worker-driven
 * paths (users/create and users/link-parent) that always did. That fixes new
 * registrations only — the accounts already in this state need this script.
 *
 * Usage
 * -----
 * Reports what it would change, and changes nothing:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/confirm-parent-emails.mjs
 *
 * Applies the change:
 *
 *   ... node scripts/confirm-parent-emails.mjs --apply
 *
 * Only accounts whose profile row says role = 'parent' are touched, and only
 * those that are currently unconfirmed. Worker and official accounts are left
 * alone: they are provisioned confirmed, so an unconfirmed one is not something
 * this script should quietly decide about. Idempotent — a second run finds
 * nothing to do.
 */

import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing environment. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.'
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Every auth user, one page at a time. */
async function allAuthUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers page ${page}: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 200) return users;
  }
}

async function main() {
  console.log(`Project: ${url}`);
  console.log(apply ? 'Mode:    APPLY\n' : 'Mode:    dry run (pass --apply to make changes)\n');

  const authUsers = await allAuthUsers();

  // The users table is the source of truth for role; user_metadata is
  // user-editable and must not decide who gets touched here.
  const { data: profiles, error: profileError } = await admin
    .from('users')
    .select('id, email, role');
  if (profileError) throw new Error(`users select: ${profileError.message}`);

  const parentIds = new Set(
    (profiles ?? []).filter((p) => p.role === 'parent').map((p) => p.id)
  );

  const stuck = authUsers.filter((u) => parentIds.has(u.id) && !u.email_confirmed_at);

  if (stuck.length === 0) {
    console.log('No unconfirmed parent accounts. Nothing to do.');
    return;
  }

  console.log(`${stuck.length} unconfirmed parent account(s):`);
  for (const user of stuck) console.log(`  ${user.email}  (created ${user.created_at})`);
  console.log('');

  if (!apply) {
    console.log('Dry run — nothing changed. Re-run with --apply to confirm these accounts.');
    return;
  }

  let confirmed = 0;
  for (const user of stuck) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
    if (error) {
      console.error(`  FAILED ${user.email}: ${error.message}`);
      continue;
    }
    confirmed += 1;
    console.log(`  confirmed ${user.email}`);
  }

  console.log(`\nConfirmed ${confirmed} of ${stuck.length} account(s).`);
  if (confirmed !== stuck.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
