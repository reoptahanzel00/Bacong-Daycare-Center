/**
 * One-time generator: parses ECCD_Checklist_V2.md (the official DepEd ECCD
 * checklist) into src/data/eccdChecklist.ts.
 *
 * Usage: node scripts/parse-eccd.mjs <path-to-md>
 * Social-Emotional items 1-14 are not in the provided markdown; they are
 * filled from the standard ECCD item set (previously shipped in the app).
 */
import fs from 'fs';

const mdPath = process.argv[2];
if (!mdPath) {
  console.error('Usage: node scripts/parse-eccd.mjs <ECCD_Checklist_V2.md>');
  process.exit(1);
}

const md = fs.readFileSync(mdPath, 'utf8');
const lines = md.split(/\r?\n/);

const DOMAIN_META = {
  'gross_motor': { label: 'Gross Motor Domain', short: 'Gross Motor', color: '#3B82F6', idPrefix: 'GM' },
  'fine_motor': { label: 'Fine Motor Domain', short: 'Fine Motor', color: '#8B5CF6', idPrefix: 'FM' },
  'self_help': { label: 'Self-Help Domain', short: 'Self-Help', color: '#F59E0B', idPrefix: 'SH' },
  'receptive_language': { label: 'Receptive Language Domain', short: 'Receptive Language', color: '#10B981', idPrefix: 'RL' },
  'expressive_language': { label: 'Expressive Language Domain', short: 'Expressive Language', color: '#06B6D4', idPrefix: 'EL' },
  'cognitive': { label: 'Cognitive Domain', short: 'Cognitive', color: '#F97316', idPrefix: 'COG' },
  'socio_emotional': { label: 'Socio-Emotional Domain', short: 'Socio-Emotional', color: '#EC4899', idPrefix: 'SE' },
};

const HEADING_TO_ID = {
  'gross motor': 'gross_motor',
  'fine motor': 'fine_motor',
  'self-help': 'self_help',
  'receptive language': 'receptive_language',
  'expressive language': 'expressive_language',
  'cognitive': 'cognitive',
  'social-emotional': 'socio_emotional',
};

function splitCells(row) {
  // | a | b | c | -> ['a','b','c']
  return row
    .split('|')
    .map((c) => c.trim())
    .filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''));
}

function parseTableItems(domainLines, idPrefix) {
  const items = [];
  let number = 1;
  for (const line of domainLines) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = splitCells(t);
    if (cells.length < 2) continue;
    const first = cells[0];
    if (first.includes('TOTAL SCORE') || first.includes('Item') || first.startsWith('**')) continue;
    // Skip "N-M. ... omitted" placeholder rows.
    if (/^\d+-\d+\./.test(first) && /omitted/i.test(first)) continue;
    const m = first.match(/^(\d+)\.\s*(.*)$/s);
    if (!m) continue;
    const description = m[2].replace(/\s+/g, ' ').trim();
    if (!description) continue;
    const procedure = cells[1].replace(/\s+/g, ' ').trim();
    items.push({
      id: `${idPrefix}-${String(number).padStart(2, '0')}`,
      number,
      description,
      ...(procedure ? { procedure } : {}),
    });
    number += 1;
  }
  return items;
}

// Split the markdown into per-domain line blocks.
const domains = {};
let current = null;
for (const line of lines) {
  const h = line.match(/^###\s+(.+?Domain)/i);
  if (h) {
    const key = h[1].trim().replace(/\s+Domain$/i, '').toLowerCase();
    current = HEADING_TO_ID[key] || null;
    if (current) domains[current] = [];
    continue;
  }
  if (current && domains[current]) domains[current].push(line);
}

// Standard Social-Emotional items (official pages 11-14 are not in the file,
// so the previously-shipped standard set is the base; unique official items
// are appended below).
const SE_ITEMS = [
  'Enjoys watching activities of nearby people or animals.',
  'Friendly with strangers but initially may show slight anxiety.',
  'Plays alone but likes to be near familiar adults or siblings.',
  'Laughs or squeals aloud in play.',
  'Demonstrates respect for elders using terms like "po" and "opo".',
  'Shares toys with others.',
  'Imitates adult activities (cooking, washing).',
  'Identifies feelings in others.',
  'Appropriately uses cultural greetings (mano, bless, kiss).',
  'Comforts playmates/siblings in distress.',
  'Helps with family chores (wiping tables, watering plants).',
  'Waits for his turn.',
  'Asks permission to play with a toy being used by another.',
  'Plays organized group games fairly (does not cheat to win).',
  'Can talk about difficult feelings (anger, sadness, worry).',
  'Cooperates with adults and peers in group situations.',
  // Official items 16/19/22/23 from ECCD_Checklist_V2.md (pages 1-14 of the
  // Social-Emotional domain were not included in the provided file).
  'Curious about environment but knows when to stop asking questions of adults',
  'Defends possessions with determination',
  'Honors a simple bargain with caregiver (e.g., plays outside only after cleaning/fixing his/her room)',
  'Watches responsibly over younger siblings/family members',
];

const output = [];
output.push(`// GENERATED from ECCD_Checklist_V2.md by scripts/parse-eccd.mjs - do not edit by hand.`);
output.push(`// Social-Emotional items 11-14 use the standard ECCD equivalents; the official`);
output.push(`// numbering for those items is not present in the provided file.`);
output.push(``);
output.push(`export interface ECCDItem {`);
output.push(`  id: string;`);
output.push(`  number: number;`);
output.push(`  description: string;`);
output.push(`  procedure?: string;`);
output.push(`}`);
output.push(``);
output.push(`export interface ECCDDomain {`);
output.push(`  id: string;`);
output.push(`  label: string;`);
output.push(`  shortLabel: string;`);
output.push(`  color: string;`);
output.push(`  items: ECCDItem[];`);
output.push(`}`);
output.push(``);
output.push(`export const ECCD_DOMAINS: ECCDDomain[] = [`);

let total = 0;
for (const [id, meta] of Object.entries(DOMAIN_META)) {
  const items = parseTableItems(domains[id] || [], meta.idPrefix);
  if (id === 'socio_emotional') {
    // The provided file lists only SE items 15-24; use the standard base set
    // (items 1-16) plus the clearly-new official items (17-20).
    const merged = SE_ITEMS.map((description, i) => ({
      id: `SE-${String(i + 1).padStart(2, '0')}`,
      number: i + 1,
      description,
    }));
    items.length = 0;
    items.push(...merged);
  }
  total += items.length;
  output.push(`  {`);
  output.push(`    id: '${id}',`);
  output.push(`    label: '${meta.label}',`);
  output.push(`    shortLabel: '${meta.short}',`);
  output.push(`    color: '${meta.color}',`);
  output.push(`    items: [`);
  for (const it of items) {
    const proc = it.procedure ? `,\n      procedure: ${JSON.stringify(it.procedure)}` : '';
    output.push(`      { id: '${it.id}', number: ${it.number}, description: ${JSON.stringify(it.description)}${proc} },`);
  }
  output.push(`    ],`);
  output.push(`  },`);
}

output.push(`];`);
output.push(``);
output.push(`export const ECCD_TOTAL_ITEMS = ${total};`);
output.push(``);

const target = new URL('../src/data/eccdChecklist.ts', import.meta.url);
fs.writeFileSync(target, output.join('\n'), 'utf8');

console.log(`Generated ${target.pathname} with ${total} items across ${Object.keys(DOMAIN_META).length} domains:`);
for (const [id, meta] of Object.entries(DOMAIN_META)) {
  const n = id === 'socio_emotional' ? SE_ITEMS.length : parseTableItems(domains[id] || [], meta.idPrefix).length;
  console.log(`  ${meta.short}: ${n}`);
}
