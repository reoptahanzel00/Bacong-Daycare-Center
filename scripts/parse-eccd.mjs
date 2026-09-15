/**
 * Generator: parses the official ECCD Checklist, Child's Record 2 Word template
 * (src/templates/eccd-child-record-2.docx) into src/data/eccdChecklist.ts.
 *
 * Usage: node scripts/parse-eccd.mjs [path-to-docx]
 *
 * The template is the single source of truth for the checklist: the same file
 * is filled in by src/lib/eccdDocx.ts when a record is downloaded, so item
 * numbers here must match the numbered rows of its seven domain tables. A row
 * whose first cell is an integer is an item; header, sub-domain and TOTAL SCORE
 * rows are skipped.
 */
import fs from 'fs';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const docxPath = process.argv[2] || new URL('../src/templates/eccd-child-record-2.docx', import.meta.url);

const DOMAIN_META = {
  'Gross Motor': { id: 'gross_motor', label: 'Gross Motor Domain', color: '#3B82F6', idPrefix: 'GM' },
  'Fine Motor': { id: 'fine_motor', label: 'Fine Motor Domain', color: '#8B5CF6', idPrefix: 'FM' },
  'Self-Help': { id: 'self_help', label: 'Self-Help Domain', color: '#F59E0B', idPrefix: 'SH' },
  'Receptive Language': { id: 'receptive_language', label: 'Receptive Language Domain', color: '#10B981', idPrefix: 'RL' },
  'Expressive Language': { id: 'expressive_language', label: 'Expressive Language Domain', color: '#06B6D4', idPrefix: 'EL' },
  'Cognitive': { id: 'cognitive', label: 'Cognitive Domain', color: '#F97316', idPrefix: 'COG' },
  'Social-Emotional': { id: 'socio_emotional', label: 'Social-Emotional Domain', color: '#EC4899', idPrefix: 'SE' },
};

const kids = (el, name) =>
  Array.from(el.childNodes).filter((n) => n.nodeType === 1 && n.namespaceURI === W && n.localName === name);

function paragraphText(p) {
  return Array.from(p.getElementsByTagNameNS(W, 't')).map((t) => t.textContent).join('');
}

/** Cell paragraphs joined into one sentence-punctuated line. */
function cellText(tc) {
  return kids(tc, 'p')
    .map((p) => paragraphText(p).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((s, i, arr) => (i < arr.length - 1 && !/[.?!:]["”)]?$/.test(s) ? `${s}.` : s))
    .join(' ');
}

const zip = await JSZip.loadAsync(fs.readFileSync(docxPath));
const xml = await zip.file('word/document.xml').async('string');
const doc = new DOMParser().parseFromString(xml, 'text/xml');
const body = doc.getElementsByTagNameNS(W, 'body')[0];

const domains = [];
for (const tbl of kids(body, 'tbl')) {
  const rows = kids(tbl, 'tr');
  const heading = cellText(kids(rows[0], 'tc')[1] || rows[0]).trim();
  const meta = DOMAIN_META[heading];
  if (!meta) continue;
  const items = [];
  for (const tr of rows.slice(1)) {
    const tcs = kids(tr, 'tc');
    const n = cellText(tcs[0]).trim();
    if (!/^\d+$/.test(n)) continue;
    const number = Number(n);
    if (number !== items.length + 1) {
      throw new Error(`${heading}: expected item ${items.length + 1}, found ${number}`);
    }
    const procedure = cellText(tcs[2]);
    items.push({
      id: `${meta.idPrefix}-${String(number).padStart(2, '0')}`,
      number,
      description: cellText(tcs[1]),
      ...(procedure ? { procedure } : {}),
    });
  }
  domains.push({ heading, meta, items });
}

if (domains.length !== Object.keys(DOMAIN_META).length) {
  throw new Error(`Expected ${Object.keys(DOMAIN_META).length} domain tables, found ${domains.length}`);
}

const output = [];
output.push(`// GENERATED from src/templates/eccd-child-record-2.docx by scripts/parse-eccd.mjs - do not edit by hand.`);
output.push(`// Item ids follow the official numbering (SE-05 is Social-Emotional item 5), and`);
output.push(`// src/lib/eccdDocx.ts relies on that to fill the same rows of the template.`);
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
for (const { heading, meta, items } of domains) {
  total += items.length;
  output.push(`  {`);
  output.push(`    id: '${meta.id}',`);
  output.push(`    label: '${meta.label}',`);
  output.push(`    shortLabel: '${heading}',`);
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

console.log(`Generated src/data/eccdChecklist.ts with ${total} items across ${domains.length} domains:`);
for (const { heading, items } of domains) console.log(`  ${heading}: ${items.length}`);
