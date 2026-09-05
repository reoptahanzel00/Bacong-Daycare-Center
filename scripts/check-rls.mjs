// Row Level Security contract check.
//
// Guards against the class of bug found in the 2026-09-05 audit: a table added
// to supabase/schema.sql without RLS. Supabase grants the anon and
// authenticated roles full DML on tables in the public schema by default, and
// RLS is the only thing that takes it back -- so a table with RLS off is
// readable AND writable by anyone holding the anon key, which ships in the
// browser bundle by design and is therefore public.
//
// school_years and progress_domains were shipped that way. Nothing announced
// it: the app worked, the build passed, and the tests passed, because the
// application layer never tried the thing that was allowed. That is why this is
// a static check rather than a review habit.
//
// Two rules, per table:
//   1. ENABLE ROW LEVEL SECURITY is present.
//   2. At least one policy exists. RLS on with no policy denies everyone,
//      which fails closed but breaks the feature -- worth catching too.
//
// A table that genuinely needs neither can be listed in EXEMPT with a reason.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const schemaSql = readFileSync(join(root, 'supabase', 'schema.sql'), 'utf8');

/** Tables deliberately without RLS. Add a reason; an empty reason is rejected. */
const EXEMPT = new Map([
  // e.g. ['migration_log', 'internal bookkeeping, never exposed through PostgREST'],
]);

function declaredTables(sql) {
  const tables = [];
  const re = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(/g;
  let match;
  while ((match = re.exec(sql))) tables.push(match[1]);
  return tables;
}

function tablesWithRls(sql) {
  const enabled = new Set();
  const re = /ALTER TABLE\s+(?:public\.)?(\w+)\s+ENABLE ROW LEVEL SECURITY/gi;
  let match;
  while ((match = re.exec(sql))) enabled.add(match[1]);
  return enabled;
}

function policyCounts(sql) {
  const counts = new Map();
  // CREATE POLICY "name" ON <table>  -- the schema writes the table unqualified,
  // but accept a public. prefix so a qualified policy is not miscounted as zero.
  const re = /CREATE POLICY\s+"[^"]+"\s+ON\s+(?:public\.)?(\w+)/gi;
  let match;
  while ((match = re.exec(sql))) {
    const table = match[1];
    counts.set(table, (counts.get(table) ?? 0) + 1);
  }
  return counts;
}

const tables = declaredTables(schemaSql);
const rlsEnabled = tablesWithRls(schemaSql);
const policies = policyCounts(schemaSql);

const failures = [];

for (const table of tables) {
  if (EXEMPT.has(table)) {
    const reason = (EXEMPT.get(table) ?? '').trim();
    if (!reason) failures.push(`${table}: listed in EXEMPT without a reason`);
    continue;
  }
  if (!rlsEnabled.has(table)) {
    failures.push(
      `${table}: no "ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY" — the public anon key can read and write it`
    );
    continue;
  }
  if (!policies.has(table)) {
    failures.push(`${table}: RLS is enabled but no policy is defined — every client read and write is denied`);
  }
}

if (failures.length > 0) {
  console.error('[rls] FAIL: row level security contract violated\n');
  for (const failure of failures) console.error('  - ' + failure);
  console.error(
    '\n  Add the policy to supabase/schema.sql AND ship it as a numbered migration,' +
    '\n  so a fresh project and a migrated one end up identical. If a table genuinely' +
    '\n  needs no RLS, add it to EXEMPT in this script with a reason.'
  );
  process.exit(1);
}

console.log(
  `[rls] OK: all ${tables.length} tables have RLS enabled and at least one policy` +
  (EXEMPT.size > 0 ? ` (${EXEMPT.size} exempt)` : '')
);
