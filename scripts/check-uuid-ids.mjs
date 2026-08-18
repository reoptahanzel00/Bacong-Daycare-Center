// Schema-to-route contract check.
//
// Guards against the class of bug where an API route inserts a human-readable
// string id (e.g. "PROG-<hex>") into a table whose PK is defined as UUID in
// supabase/schema.sql. Postgres rejects that with "invalid input syntax for
// type uuid", silently breaking the feature. Fails the build if any route
// references such a table AND assigns a non-UUID string literal to id.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (extname(full) === '.ts') acc.push(full);
  }
  return acc;
}

function uuidPkTables(schemaSql) {
  const tables = new Set();
  const re = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\n\);/g;
  let m;
  while ((m = re.exec(schemaSql))) {
    const [, name, body] = m;
    if (/^\s*id\s+UUID/gm.test(body)) tables.add(name);
  }
  return tables;
}

// A route violates the contract when it inserts/upserts into a UUID-PK table
// and assigns a prefixed string id (e.g. "PROG-..."). Routes that leave id to
// gen_random_uuid() or use crypto.randomUUID() are allowed.
const PREFIXED_ID_RE = /\bid\s*:\s*[`'"]([A-Z]+)-\$\{?[`'"]?/;
const UUID_LITERAL_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

let failed = false;
let checked = 0;
const schemaSql = readFileSync(join(root, 'supabase', 'schema.sql'), 'utf8');
const uuidTables = uuidPkTables(schemaSql);
const routes = walk(join(root, 'src', 'app', 'api'));

for (const file of routes) {
  const src = readFileSync(file, 'utf8');
  for (const table of uuidTables) {
    const refSingle = src.includes(".from('" + table + "')");
    const refDouble = src.includes('.from("' + table + '")');
    if (!refSingle && !refDouble) continue;
    checked += 1;
    const assignsPrefixedId = PREFIXED_ID_RE.test(src);
    const usesRandomUuid = src.includes('crypto.randomUUID()');
    const hasUuidLiteral = UUID_LITERAL_RE.test(src);
    if (assignsPrefixedId && !usesRandomUuid && !hasUuidLiteral) {
      console.error('[contract] ' + file + ': assigns a string id like "PROG-<hex>" to table ' + table + ' (PK is UUID).');
      failed = true;
    }
  }
}

if (failed) {
  console.error('[contract] FAIL: schema/route id contract violated');
  process.exit(1);
}
console.log('[contract] OK: no non-UUID string ids assigned to UUID-PK tables (' + checked + ' routes checked)');
